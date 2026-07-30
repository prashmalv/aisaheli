// Per-user conversation history (localStorage). Lets a logged-in citizen or
// officer return to their previous conversation. Keyed by kind + user id.

const KEY = (kind, userId) => `saheli_${kind}_${userId || 'guest'}`
const MAX = 60 // cap stored turns to keep localStorage small

export function loadConv(kind, userId) {
  try {
    const raw = localStorage.getItem(KEY(kind, userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveConv(kind, userId, data) {
  try {
    const trimmed = Array.isArray(data) ? data.slice(-MAX) : data
    localStorage.setItem(KEY(kind, userId), JSON.stringify(trimmed))
  } catch {}
}

export function clearConv(kind, userId) {
  try { localStorage.removeItem(KEY(kind, userId)) } catch {}
}
