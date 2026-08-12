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

async function embedBatch(inputs) {
  const r = await fetch(`${ENDPOINT}/embeddings`, {
    method: 'POST',
    headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  })
  if (!r.ok) throw new Error(`embeddings ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  return j.data.map((d) => d.embedding)
}

function toB64(vec) {
  return Buffer.from(new Float32Array(vec).buffer).toString('base64')
}

async function main() {
  const corpus = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'corpus.json'), 'utf8'))
  console.log(`Loaded ${corpus.docs.length} docs. Chunking…`)

  const chunks = []
  for (const d of corpus.docs) {
    for (const text of chunkText(d.text)) {
      chunks.push({ url: d.url, title: d.title, state: d.state, site: d.site, type: d.type, text })
    }
  }
  console.log(`${chunks.length} chunks. Embedding via ${MODEL}…`)

  let dim = 0
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH)
    const embs = await embedBatch(slice.map((c) => c.text.slice(0, 6000)))
    slice.forEach((c, j) => { c.emb = toB64(embs[j]); dim = embs[j].length })
    process.stdout.write(`  embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`)
  }
  console.log('')

  const out = path.join(DATA_DIR, 'index.json')
  fs.writeFileSync(out, JSON.stringify({ model: MODEL, dim, count: chunks.length, builtAt: new Date().toISOString(), chunks }))
  console.log(`Saved index (${chunks.length} chunks, dim ${dim}) → ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`)
}

main()
