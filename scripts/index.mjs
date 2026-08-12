// Build the vector index → data/index.json
//
// Reads data/corpus.json, splits each doc into overlapping chunks, embeds them
// with Azure OpenAI (text-embedding-3-small), and stores compact base64
// Float32 vectors alongside citation metadata (url, title, state, type).
//
// Usage:  node scripts/index.mjs
// Env:    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, EMBED_DEPLOYMENT

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '')
const KEY = process.env.AZURE_OPENAI_API_KEY || ''
const MODEL = process.env.EMBED_DEPLOYMENT || 'text-embedding-3-small'
if (!ENDPOINT || !KEY) { console.error('Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY'); process.exit(1) }

const CHUNK = 1100 // ~ chars per chunk
const OVERLAP = 150
const BATCH = 32

function chunkText(text) {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (clean.length <= CHUNK) return clean.length > 80 ? [clean] : []
  const paras = clean.split(/\n\n+/)
  const chunks = []
  let cur = ''
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > CHUNK && cur) {
      chunks.push(cur.trim())
      cur = cur.slice(Math.max(0, cur.length - OVERLAP)) + '\n\n' + p
    } else {
      cur = cur ? cur + '\n\n' + p : p
    }
    // a single huge paragraph → hard-split
    while (cur.length > CHUNK * 1.6) {
      chunks.push(cur.slice(0, CHUNK).trim())
      cur = cur.slice(CHUNK - OVERLAP)
    }
  }
  if (cur.trim().length > 80) chunks.push(cur.trim())
  return chunks
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function embedBatch(inputs, attempt = 0) {
  const r = await fetch(`${ENDPOINT}/embeddings`, {
    method: 'POST',
    headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  })
  if ((r.status === 429 || r.status >= 500) && attempt < 7) {
    const ra = Number(r.headers.get('retry-after'))
    const wait = (ra ? ra * 1000 : Math.min(30000, 1500 * 2 ** attempt))
    process.stdout.write(`\n  rate-limited (${r.status}); waiting ${Math.round(wait / 1000)}s…\n`)
    await sleep(wait)
    return embedBatch(inputs, attempt + 1)
  }
  if (!r.ok) throw new Error(`embeddings ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  return j.data.map((d) => d.embedding)
}

function toB64(vec) {
  return Buffer.from(new Float32Array(vec).buffer).toString('base64')
}

// --- Freshness helpers ------------------------------------------------------
const THIS_YEAR = 2026

// Best-effort publication year. Filename and title years are AUTHORITATIVE
// (matched even when glued to text, e.g. "…scheme2022.pdf" → 2022); only if
// none is found there do we fall back to a boundary-matched year in the body.
function extractYear(d) {
  const fname = String(d.url || '').split('/').pop() || ''
  const nameYears = [...`${fname} ${d.title || ''}`.matchAll(/(20(?:1[5-9]|2[0-6]))/g)].map((m) => Number(m[1]))
  if (nameYears.length) return Math.max(...nameYears)
  const bodyYears = [...String(d.text || '').slice(0, 500).matchAll(/\b(20(?:1[5-9]|2[0-6]))\b/g)].map((m) => Number(m[1]))
  return bodyYears.length ? Math.max(...bodyYears) : null
}
function docType(d) {
  const s = `${d.url} ${d.title}`.toLowerCase()
  if (/annual[\s_-]*report/.test(s)) return 'annual_report'
  if (/notification|gazette|circular|order/.test(s)) return 'notification'
  return d.type // 'page' | 'pdf'
}
// Normalised "series" key so different years of the same document collapse.
function seriesKey(d) {
  let s = (d.title || '').toLowerCase()
  s = s.replace(/20\d\d\s*[-–]\s*\d{2,4}/g, ' ').replace(/\b20\d\d\b/g, ' ')
  s = s.replace(/\b(vol(?:ume)?|part|no|version|v)\.?\s*\d+/g, ' ')
  s = s.replace(/[^a-zऀ-ॿ]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s
}

// Optional department exclude-list: data/exclude-urls.json = ["https://…pdf", …]
function loadExcludes() {
  try {
    const p = path.join(DATA_DIR, 'exclude-urls.json')
    if (fs.existsSync(p)) return new Set(JSON.parse(fs.readFileSync(p, 'utf8')))
  } catch {}
  return new Set()
}

// Keep only the latest version of each versioned DOCUMENT (pdf/notification/
// annual report). Pages are navigational and never de-duplicated.
function keepLatest(docs) {
  const groups = new Map()
  const kept = []
  for (const d of docs) {
    const versioned = d.type === 'pdf' || d.docType === 'annual_report' || d.docType === 'notification'
    const sk = seriesKey(d)
    // Only de-duplicate when the title yields a MEANINGFUL series key. Numeric /
    // code-named files (e.g. "1733739240") normalise to an empty/short key and
    // must NOT be collapsed together — they are distinct documents.
    if (!versioned || !d.year || sk.replace(/\s/g, '').length < 6) { kept.push(d); continue }
    const key = d.state + '|' + sk
    const g = groups.get(key)
    if (!g) groups.set(key, [d])
    else g.push(d)
  }
  for (const [, g] of groups) {
    if (g.length === 1) { kept.push(g[0]); continue }
    const maxYear = Math.max(...g.map((x) => x.year))
    const winners = g.filter((x) => x.year === maxYear)
    kept.push(winners[0]) // one representative of the latest year
    const dropped = g.filter((x) => x !== winners[0])
    dropped.forEach((x) => console.log(`  superseded: ${x.title} (${x.year}) — kept ${maxYear}`))
  }
  return kept
}

async function main() {
  const corpus = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'corpus.json'), 'utf8'))
  console.log(`Loaded ${corpus.docs.length} docs.`)

  const excludes = loadExcludes()
  let docs = corpus.docs
    .filter((d) => !excludes.has(d.url))
    .map((d) => ({ ...d, year: extractYear(d), docType: docType(d) }))
  const before = docs.length
  docs = keepLatest(docs)
  console.log(`Freshness: ${before} → ${docs.length} docs after keeping latest versions${excludes.size ? ` (excluded ${excludes.size})` : ''}. Chunking…`)

  const chunks = []
  for (const d of docs) {
    for (const text of chunkText(d.text)) {
      chunks.push({ url: d.url, title: d.title, state: d.state, site: d.site, type: d.type, docType: d.docType, year: d.year, text })
    }
  }
  console.log(`${chunks.length} chunks. Embedding via ${MODEL}…`)

  let dim = 0
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH)
    const embs = await embedBatch(slice.map((c) => c.text.slice(0, 6000)))
    slice.forEach((c, j) => { c.emb = toB64(embs[j]); dim = embs[j].length })
    process.stdout.write(`  embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`)
    await sleep(150)
  }
  console.log('')

  const out = path.join(DATA_DIR, 'index.json')
  fs.writeFileSync(out, JSON.stringify({ model: MODEL, dim, count: chunks.length, builtAt: new Date().toISOString(), chunks }))
  console.log(`Saved index (${chunks.length} chunks, dim ${dim}) → ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`)
}

main()
