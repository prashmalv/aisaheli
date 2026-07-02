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

const app = express()
app.use(express.json({ limit: '1mb' }))

// --- Health / config ---------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: hasKey ? 'live' : 'scripted',
    model: hasKey ? DEPLOYMENT : null,
    starters: STARTERS,
  })
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
  if (!fs.existsSync(distDir)) {
    console.log(`      Frontend: run "npm run dev" (Vite on :5173) or "npm run build" first.\n`)
  } else {
    console.log(`      Open http://localhost:${PORT}\n`)
  }
})
