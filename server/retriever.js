// Vector retrieval over the crawled WCD corpus (data/index.json).
// Loads the base64 Float32 embeddings once, embeds queries via Azure OpenAI,
// and returns the most relevant chunks (optionally scoped to a state) along
// with citation metadata so every answer is traceable to an official source.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_PATH = path.join(__dirname, '..', 'data', 'index.json')

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '')
const KEY = process.env.AZURE_OPENAI_API_KEY || ''
const EMBED_MODEL = process.env.EMBED_DEPLOYMENT || 'text-embedding-3-small'
const THIS_YEAR = new Date().getFullYear()

let INDEX = null // { model, dim, chunks: [{url,title,state,site,type,text, vec:Float32Array, norm}] }

export function loadIndex() {
  if (INDEX) return INDEX
  if (!fs.existsSync(INDEX_PATH)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
    for (const c of raw.chunks) {
      const buf = Buffer.from(c.emb, 'base64')
      const vec = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
      let n = 0
      for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i]
      c.vec = vec
      c.norm = Math.sqrt(n) || 1
      delete c.emb
    }
    INDEX = raw
    return INDEX
  } catch (e) {
    console.error('[retriever] failed to load index:', e.message)
    return null
  }
}

export function ragStatus() {
  const idx = loadIndex()
  if (!idx) return { ready: false }
  const states = {}
  for (const c of idx.chunks) states[c.state] = (states[c.state] || 0) + 1
  return { ready: true, chunks: idx.chunks.length, states, builtAt: idx.builtAt }
}

async function embedQuery(text) {
  const r = await fetch(`${ENDPOINT}/embeddings`, {
    method: 'POST',
    headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 4000) }),
  })
  if (!r.ok) throw new Error(`embeddings ${r.status}`)
  const j = await r.json()
  return j.data[0].embedding
}

// Which source scopes a request may draw from.
// - a selected scheme (vatsalya/shakti/poshan) → that scheme's site only
// - no scheme (generic) → national WCD site
// - plus the citizen's state site (currently Delhi) when a location is given
export function allowedScopes({ scheme, state } = {}) {
  const a = new Set()
  a.add(['vatsalya', 'shakti', 'poshan'].includes(scheme) ? scheme : 'national')
  if (state === 'delhi') a.add('delhi')
  return a
}

// opts: { scheme, state }
export async function retrieve(query, opts = {}, k = 6) {
  const idx = loadIndex()
  if (!idx || !query?.trim()) return { chunks: [], maxScore: 0 }

  const allowed = allowedScopes(opts)
  const q = await embedQuery(query)
  let qn = 0
  for (let i = 0; i < q.length; i++) qn += q[i] * q[i]
  qn = Math.sqrt(qn) || 1

  const scored = []
  for (const c of idx.chunks) {
    const scopes = c.scopes || [c.state || 'national']
    if (!scopes.some((s) => allowed.has(s))) continue
    let dot = 0
    const v = c.vec
    for (let i = 0; i < v.length; i++) dot += v[i] * q[i]
    let score = dot / (c.norm * qn)
    // Website first: prefer live site pages over attached PDFs/documents.
    if (c.type === 'page') score += 0.02
    // Freshness: down-rank annual reports; gently prefer more recent docs.
    if (c.docType === 'annual_report') score -= 0.06
    if (c.year) score -= Math.min(0.04, 0.012 * Math.max(0, THIS_YEAR - c.year))
    scored.push({ c, score })
  }
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, k).map((s) => ({ ...s.c, score: s.score }))
  return { chunks: top, maxScore: scored.length ? scored[0].score : 0 }
}

// Build the grounded context string + a de-duplicated citation list.
export function buildContext(chunks) {
  const citations = []
  const seen = new Set()
  const blocks = chunks.map((c, i) => {
    if (!seen.has(c.url)) {
      seen.add(c.url)
      citations.push({ n: citations.length + 1, title: c.title, url: c.url, state: c.state, site: c.site, type: c.type, year: c.year || null })
    }
    const yr = c.year ? ` (published ${c.year})` : ''
    return `[Source ${i + 1}] ${c.site}${yr} — ${c.title}\nURL: ${c.url}\n${c.text}`
  })
  return { context: blocks.join('\n\n---\n\n'), citations: citations.slice(0, 4) }
}
