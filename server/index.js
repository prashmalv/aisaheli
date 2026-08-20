import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import OpenAI from 'openai'
import { systemPrompt, groundedSystemPrompt, smallTalkPrompt, STARTERS } from './knowledge.js'
import { scriptedReply } from './fallback.js'
import { dashboardData } from './dashboard.js'
import { retrieve, buildContext, ragStatus, listSources } from './retriever.js'

// Delimiter that separates the streamed answer text from the trailing citations
// JSON. A U+001F unit separator never appears in normal model output.
const CITE_SEP = String.fromCharCode(31) // U+001F unit separator
const RAG_MIN_SCORE = 0.28

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PORT = process.env.PORT || 3001

// --- Azure OpenAI configuration ---------------------------------------------
// Uses the Azure OpenAI "v1" API surface, which is compatible with the OpenAI
// SDK: set baseURL to https://<resource>.openai.azure.com/openai/v1 and use the
// deployment name as the model. The api key is sent both as Bearer (SDK default)
// and the Azure `api-key` header for maximum compatibility.
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || ''
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY || ''
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini'
const hasKey = Boolean(AZURE_ENDPOINT && AZURE_KEY)
const client = hasKey
  ? new OpenAI({
      apiKey: AZURE_KEY,
      baseURL: AZURE_ENDPOINT.replace(/\/+$/, ''),
      defaultHeaders: { 'api-key': AZURE_KEY },
    })
  : null

// --- Azure Speech (TTS) configuration ---------------------------------------
// Reuses the same AIServices resource (kind=AIServices includes Speech). The
// Speech key defaults to the OpenAI/AIServices key; region defaults to eastus2.
const SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus2'
const SPEECH_KEY = process.env.AZURE_SPEECH_KEY || AZURE_KEY || ''
const speechEnabled = Boolean(SPEECH_KEY)
const TTS_VOICES = { hi: 'hi-IN-SwaraNeural', en: 'en-IN-NeerjaNeural' }

const app = express()
app.use(express.json({ limit: '2mb' }))

// Greetings / casual / meta questions that should NOT trigger source citations.
function isSmallTalk(q) {
  const t = String(q || '').toLowerCase().trim().replace(/[!.?]+$/, '')
  if (!t) return true
  const words = t.split(/\s+/).length
  const EN = /\b(hi|hello|hey|yo|namaste|namaskar|how are you|how r u|how's it going|what'?s up|thanks|thank you|thank u|thankyou|bye|good ?(morning|afternoon|evening|night)|who are you|what can you do|what do you do|help me)\b/
  const HI = /(नमस्ते|नमस्कार|कैसे हो|कैसी हो|कैसे हैं|कैसी हैं|क्या हाल|शुक्रिया|धन्यवाद|आप कौन|तुम कौन|कौन हो|तुम क्या|आप क्या कर|अलविदा)/
  if (words <= 5 && (EN.test(t) || HI.test(q))) return true
  if (/^(hi+|hello+|hey+|namaste+|namaskar+)$/.test(t)) return true
  return false
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// --- Health / config ---------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: hasKey ? 'live' : 'scripted',
    model: hasKey ? DEPLOYMENT : null,
    voice: speechEnabled,
    rag: ragStatus(),
    starters: STARTERS,
  })
})

// --- Text-to-speech (Azure Speech neural voices) ----------------------------
// Body: { text, lang }  -> audio/mpeg (MP3). 503 if not configured so the
// frontend can fall back to the browser's speechSynthesis.
app.post('/api/tts', async (req, res) => {
  if (!speechEnabled) return res.status(503).json({ error: 'tts_not_configured' })
  const text = String(req.body?.text || '').slice(0, 3000).trim()
  const lang = req.body?.lang === 'en' ? 'en' : 'hi'
  if (!text) return res.status(400).json({ error: 'empty_text' })

  const voice = TTS_VOICES[lang]
  const xmlLang = lang === 'en' ? 'en-IN' : 'hi-IN'
  const ssml =
    `<speak version='1.0' xml:lang='${xmlLang}'>` +
    `<voice name='${voice}'><prosody rate='-4%'>${escapeXml(text)}</prosody></voice></speak>`

  try {
    const r = await fetch(`https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'ai-saheli',
      },
      body: ssml,
    })
    if (!r.ok) throw new Error(`speech ${r.status}: ${(await r.text()).slice(0, 160)}`)
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.send(buf)
  } catch (err) {
    console.error('[tts] Azure Speech error:', err.message)
    res.status(502).json({ error: 'tts_failed' })
  }
})

// --- Dashboard analytics -----------------------------------------------------
app.get('/api/dashboard', (_req, res) => {
  res.json(dashboardData())
})

// --- Audit log (government/admin) -------------------------------------------
// In-memory record of recent citizen interactions and the sources that backed
// each answer, so the department can verify the assistant cited correctly.
const auditLog = []
const AUDIT_MAX = 300
function maskUser(id) {
  if (!id) return 'guest'
  const s = String(id)
  if (/^\d{6,}$/.test(s)) return '•••••' + s.slice(-4)
  return s
}
function logInteraction(e) {
  auditLog.push({ ts: new Date().toISOString(), ...e })
  if (auditLog.length > AUDIT_MAX) auditLog.shift()
}
app.get('/api/audit', (_req, res) => {
  res.json({ count: auditLog.length, interactions: auditLog.slice(-100).reverse() })
})

// --- Source register (government showcase) -----------------------------------
const GROUP_LABEL = { shakti: 'Mission Shakti', vatsalya: 'Mission Vatsalya', poshan: 'Poshan Abhiyaan', national: 'National (MoWCD)', delhi: 'Delhi' }
app.get('/api/sources', (_req, res) => {
  const rows = listSources()
  const byGroup = {}
  for (const r of rows) { const g = GROUP_LABEL[r.group] || r.group; byGroup[g] = (byGroup[g] || 0) + 1 }
  res.json({ total: rows.length, byGroup })
})
app.get('/api/sources.csv', (_req, res) => {
  const rows = listSources().sort((a, b) => (a.group + a.site + a.title).localeCompare(b.group + b.site + b.title))
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const host = (u) => { try { return new URL(u).host } catch { return '' } }
  const lines = [['Programme / Group', 'Source Site', 'Host', 'Type', 'Document / Page Title', 'Year', 'URL'].map(esc).join(',')]
  for (const r of rows) lines.push([GROUP_LABEL[r.group] || r.group, r.site, host(r.url), String(r.type).toUpperCase(), r.title, r.year, r.url].map(esc).join(','))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="wcd-ai-saheli-sources.csv"')
  res.send('﻿' + lines.join('\r\n'))
})

// --- Chat (streaming plain text) --------------------------------------------
// Body: { messages: [{ role:'user'|'assistant', content:string }] }
app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  const isVoice = req.body?.channel === 'voice'
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

  // Extra guidance for the voice channel: the reply is read aloud by a TTS
  // voice, so it must be clean spoken text — no markdown symbols, and no
  // English translations in parentheses after a Hindi term (the TTS would
  // read the term twice).
  const VOICE_ADDON =
    '\n\n## Voice mode (IMPORTANT)\nThis reply will be READ ALOUD by a text-to-speech voice and shown on a small screen. ' +
    'Write only plain spoken sentences. Do NOT use any markdown or symbols (no *, **, #, -, •, backticks). ' +
    'Do NOT add an English translation in brackets/parentheses after a term — say each scheme or place name ONCE, in the ' +
    "user's language, never repeated in another language. Keep it short and natural: 2–4 sentences."

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Saheli-Mode', hasKey ? 'live' : 'scripted')

  // Fallback path: no Azure OpenAI credentials configured.
  if (!client) {
    await streamText(res, scriptedReply(lastUser))
    return res.end()
  }

  const state = req.body?.state === 'delhi' ? 'delhi' : 'all'
  const scheme = ['vatsalya', 'shakti', 'poshan'].includes(req.body?.scheme) ? req.body.scheme : null
  const role = req.body?.role === 'officer' ? 'officer' : 'citizen'
  const lang = req.body?.lang === 'en' ? 'en' : req.body?.lang === 'hi' ? 'hi' : null
  const user = maskUser(req.body?.userId)

  try {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content || '') }))
    // Drop any leading assistant (UI greeting) so the turn starts cleanly.
    while (history.length && history[0].role === 'assistant') history.shift()

    // Ground the answer in the crawled official WCD sources (RAG), scoped to
    // the selected scheme + location. Falls back to the baked prompt only if
    // the index hasn't been built yet.
    let citations = []
    let systemContent
    const rag = ragStatus()
    if (isSmallTalk(lastUser)) {
      // Greetings / casual questions don't need sources — answer conversationally
      // with NO citations.
      systemContent = smallTalkPrompt(lang) + (isVoice ? VOICE_ADDON : '')
    } else if (rag.ready && lastUser.trim()) {
      let ctx = ''
      try {
        const { chunks, maxScore } = await retrieve(lastUser, { scheme, state }, 6)
        if (maxScore >= RAG_MIN_SCORE) {
          const built = buildContext(chunks)
          ctx = built.context
          citations = built.citations
        }
      } catch (e) {
        console.error('[chat] retrieval failed:', e.message)
      }
      systemContent = groundedSystemPrompt(ctx, { channel: isVoice ? 'voice' : 'text', state, scheme, lang })
    } else {
      systemContent = systemPrompt() + (isVoice ? VOICE_ADDON : '')
    }

    // Belt-and-suspenders on top of the system directive: remind the model of
    // the answer language right on the last user turn (most salient position).
    const modelMessages = [{ role: 'system', content: systemContent }, ...history]
    if (lang && modelMessages.length) {
      const li = modelMessages.length - 1
      if (modelMessages[li].role === 'user') {
        modelMessages[li] = {
          ...modelMessages[li],
          content: `${modelMessages[li].content}\n\n[Reply ONLY in ${lang === 'hi' ? 'Hindi (Devanagari)' : 'English'}.]`,
        }
      }
    }

    const stream = await client.chat.completions.create({
      model: DEPLOYMENT,
      max_tokens: 1024,
      temperature: 0.3,
      stream: true,
      messages: modelMessages,
    })

    let answer = ''
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) { answer += delta; res.write(delta) }
    }
    // Trailing citations block, split out by the frontend.
    res.write(CITE_SEP + JSON.stringify({ citations, state, scheme, grounded: citations.length > 0 }))
    res.end()

    // Record for the government/admin audit view.
    logInteraction({ role, user, channel: isVoice ? 'voice' : 'text', scheme, state, question: lastUser, answer: answer.trim(), citations })
  } catch (err) {
    console.error('[chat] Azure OpenAI error — using scripted fallback:', err.message)
    // Graceful fallback so a live demo never dies on an API hiccup.
    if (!res.headersSent) res.setHeader('X-Saheli-Mode', 'scripted-fallback')
    await streamText(res, scriptedReply(lastUser))
    res.end()
  }
})

// Type out scripted text in small chunks so the UI feels alive.
async function streamText(res, text) {
  const words = text.split(/(\s+)/)
  for (const w of words) {
    res.write(w)
    await new Promise((r) => setTimeout(r, 12))
  }
}

// --- Serve built frontend in production -------------------------------------
const distDir = path.join(ROOT, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`\n  🤝  AI Saheli server running on http://localhost:${PORT}`)
  console.log(`      Mode: ${hasKey ? `LIVE (Azure OpenAI · ${DEPLOYMENT})` : 'SCRIPTED (no AZURE_OPENAI_API_KEY / ENDPOINT set)'}`)
  console.log(`      Voice TTS: ${speechEnabled ? `Azure Speech (${SPEECH_REGION})` : 'browser speechSynthesis fallback'}`)
  if (!fs.existsSync(distDir)) {
    console.log(`      Frontend: run "npm run dev" (Vite on :5173) or "npm run build" first.\n`)
  } else {
    console.log(`      Open http://localhost:${PORT}\n`)
  }
})
