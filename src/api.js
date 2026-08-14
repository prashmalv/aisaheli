// Small fetch helpers for the AI Saheli backend.

export async function getHealth() {
  const r = await fetch('/api/health')
  if (!r.ok) throw new Error('health failed')
  return r.json()
}

export async function getDashboard() {
  const r = await fetch('/api/dashboard')
  if (!r.ok) throw new Error('dashboard failed')
  return r.json()
}

// Government/admin audit log — recent interactions + the sources that backed them.
export async function getAudit() {
  const r = await fetch('/api/audit')
  if (!r.ok) throw new Error('audit failed')
  return r.json()
}

// Register of all official sources the assistant can cite (counts by programme).
export async function getSources() {
  const r = await fetch('/api/sources')
  if (!r.ok) throw new Error('sources failed')
  return r.json()
}

// Synthesises speech via the backend (Azure neural voice) and returns an
// object-URL for an <audio> element. Throws if TTS is unavailable (503/502),
// so callers can fall back to the browser's speechSynthesis.
export async function synthesizeTTS(text, lang, signal) {
  const r = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
    signal,
  })
  if (!r.ok) throw new Error('tts ' + r.status)
  const blob = await r.blob()
  return URL.createObjectURL(blob)
}

// U+001F separates the streamed answer from the trailing citations JSON.
const CITE_SEP = String.fromCharCode(31)

// Streams the assistant reply. Calls onChunk(text) as tokens arrive (answer
// text only — citations are stripped out). Returns { text, citations, grounded, state }.
// opts.channel = 'voice' asks for a TTS-friendly reply; opts.state scopes RAG.
export async function streamChat(messages, onChunk, signal, opts = {}) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      channel: opts.channel || 'text',
      state: opts.state || 'all',
      scheme: opts.scheme || null,
      role: opts.role || 'citizen',
      userId: opts.userId || null,
    }),
    signal,
  })
  if (!r.ok || !r.body) throw new Error('chat failed')

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
    const text = raw.split(CITE_SEP)[0]
    onChunk(text)
  }
  const [text, meta] = raw.split(CITE_SEP)
  let citations = [], grounded = false, state = opts.state || 'all'
  if (meta) {
    try { const j = JSON.parse(meta); citations = j.citations || []; grounded = !!j.grounded; state = j.state || state } catch {}
  }
  return { text: text || '', citations, grounded, state }
}
