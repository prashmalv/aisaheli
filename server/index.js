import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import OpenAI from 'openai'
import { systemPrompt, STARTERS } from './knowledge.js'
import { scriptedReply } from './fallback.js'
import { dashboardData } from './dashboard.js'

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

// --- Chat (streaming plain text) --------------------------------------------
// Body: { messages: [{ role:'user'|'assistant', content:string }] }
app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || ''

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Saheli-Mode', hasKey ? 'live' : 'scripted')

  // Fallback path: no Azure OpenAI credentials configured.
  if (!client) {
    await streamText(res, scriptedReply(lastUser))
    return res.end()
  }

  try {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content || '') }))
    // Drop any leading assistant (UI greeting) so the turn starts cleanly.
    while (history.length && history[0].role === 'assistant') history.shift()

    const stream = await client.chat.completions.create({
      model: DEPLOYMENT,
      max_tokens: 1024,
      temperature: 0.4,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt() }, ...history],
    })

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) res.write(delta)
    }
    res.end()
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
