// Vector retrieval over the crawled WCD corpus (data/index.json).
// Loads the base64 Float32 embeddings once, embeds queries via Azure OpenAI,
// and returns the most relevant chunks (optionally scoped to a state) along
// with citation metadata so every answer is traceable to an official source.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_PATH = path.join(__dirname, '..', 'data', 'index.json')
const DEAD_PATH = path.join(__dirname, '..', 'data', 'dead-urls.json')

// URLs found to be unreachable/broken by scripts/check-links.mjs — never cited.
let DEAD = null
function deadSet() {
  if (DEAD) return DEAD
  DEAD = new Set()
  try { if (fs.existsSync(DEAD_PATH)) JSON.parse(fs.readFileSync(DEAD_PATH, 'utf8')).forEach((u) => DEAD.add(u)) } catch {}
  return DEAD
}

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

// Unique list of documents the assistant can cite (one per URL) — for the
// government "which sources back the answers" export.
export function listSources() {
  const idx = loadIndex()
  if (!idx) return []
  const dead = deadSet()
  const seen = new Map()
  for (const c of idx.chunks) {
    if (seen.has(c.url) || dead.has(c.url)) continue
    const scheme = (c.scopes || []).find((s) => ['vatsalya', 'shakti', 'poshan'].includes(s))
    const group = scheme || (c.scopes && c.scopes[0]) || c.state || 'national'
    seen.set(c.url, { group, site: c.site || '', type: c.type || 'page', title: c.title || '', year: c.year || '', url: c.url })
  }
  return [...seen.values()]
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

  const dead = deadSet()
  const scored = []
  for (const c of idx.chunks) {
    if (dead.has(c.url)) continue // skip sources verified unreachable
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

// Site chrome that appears on every WCD page (skip-links, accessibility bar,
// social/login menus, footer policies). Stripped from citation quotes so the
// passage shown to the Ministry is real content, not navigation.
const BOILER = /(skip to main cont?ent|accessibility menu(\s*close)?|screen reader access|stakeholder login|public app|an asterisk\s*\(?\s*\*?\s*\)?\s*indicates? a required field|indicates a required field|required field|important notifications? for|text size|high contrast|last updated|visitors?\s*count|hit counter|website content (?:managed|owned)|content owned|nodal officer|terms (?:&|and) conditions|privacy policy|copyright policy|hyperlink(?:ing)? policy|sitemap|main menu|toggle navigation)/gi
const SOCIAL = /\b(twitter|facebook|instagram|youtube|linkedin|koo app|koo)\b/gi

// True when a passage reads like real content (enough multi-letter words), not
// form UI / navigation chrome ("An asterisk ( * ) HSR Waiting Detail").
function looksLikeContent(s) {
  return (String(s).match(/[A-Za-zऀ-ॿ]{4,}/g) || []).length >= 8
}

// Section headings that are UI chrome, not real content sections — hidden from
// citations (query-time, so no re-index needed).
const BOILER_SECTION = /^(select language|are you sure|sign ?in|log ?in|logout|close|search|menu|share|print|subscribe|feedback|related links|quick links|useful links|important links|skip to|accessibility|language|text size|font size|contrast|home|back to top)\b/i
function cleanSection(s) {
  const t = String(s || '').trim()
  if (!t || t.length > 90 || BOILER_SECTION.test(t)) return null
  return t
}

function cleanText(t) {
  let s = String(t || '')
    .replace(BOILER, ' ')
    .replace(SOCIAL, ' ')
    .replace(/[•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Drop a leading partial word left by a chunk boundary ("istanceis provided…").
  if (/^[a-z]/.test(s)) {
    const sp = s.indexOf(' ')
    if (sp > 0 && sp <= 22) s = s.slice(sp + 1).trim()
  }
  return s
}

// A short, clean excerpt of the exact passage used (the "where it came from").
function makeQuote(text, max = 260) {
  let t = cleanText(text)
  if (t.length <= max) return t
  t = t.slice(0, max)
  const cut = t.lastIndexOf(' ')
  return (cut > 100 ? t.slice(0, cut) : t) + '…'
}

// Chrome/Edge "scroll to text fragment" deep link — jumps to the exact text on
// the page. Uses a distinctive phrase from the passage (pages only).
function textFragmentUrl(url, quote) {
  const phrase = quote.replace(/[…]+$/, '').split(' ').slice(0, 12).join(' ').replace(/[.,;:]+$/, '').trim()
  if (phrase.length < 15) return null
  return `${url}#:~:text=${encodeURIComponent(phrase)}`
}

// Build the grounded context string + a precise, per-passage citation list.
// Each citation carries the exact quoted passage and, for web pages, a
// jump-to-text locator so the department can see exactly where a fact came from.
export function buildContext(chunks) {
  const citations = []
  const blocks = []
  const seen = new Set()
  for (const c of chunks) {
    const quote = makeQuote(c.text)
    // Skip citations whose passage is (almost) entirely site chrome/navigation
    // or form UI once cleaned — they look wrong to a reviewer and add no
    // verifiable value; the clean PDFs/pages carry the real content.
    const bare = quote.replace(/…$/, '')
    if (bare.length < 40 || !looksLikeContent(bare)) continue
    const key = c.url + '|' + quote.slice(0, 60)
    if (seen.has(key)) continue
    seen.add(key)
    const n = citations.length + 1
    const isPdf = c.type === 'pdf'
    const locator = isPdf
      ? (c.page ? `${c.url}#page=${c.page}` : null)   // open the PDF at the exact page
      : textFragmentUrl(c.url, quote)                  // scroll the web page to the text
    citations.push({
      n, title: c.title, url: c.url, state: c.state, site: c.site, type: c.type,
      year: c.year || null,
      page: c.page || null,
      section: cleanSection(c.section),
      similarity: typeof c.score === 'number' ? Math.round(c.score * 1000) / 1000 : null,
      quote,
      locator,
    })
    const yr = c.year ? ` (published ${c.year})` : ''
    const pg = c.page ? `, page ${c.page}` : ''
    blocks.push(`[Source ${n}] ${c.site}${yr} — ${c.title}${pg}\nURL: ${c.url}\n${c.text}`)
    if (citations.length >= 5) break
  }
  return { context: blocks.join('\n\n---\n\n'), citations }
}
