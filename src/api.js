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

// Streams the assistant reply. Calls onChunk(text) as tokens arrive.
export async function streamChat(messages, onChunk, signal) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })
  if (!r.ok || !r.body) throw new Error('chat failed')

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onChunk(full)
  }
  return full
}
