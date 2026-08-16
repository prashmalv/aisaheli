// Augment the existing corpus: re-fetch each PDF and attach per-page text
// (doc.pages) so citations can point to the exact page. HTML pages are left
// untouched. Much faster than a full re-crawl. Run:  node scripts/pdf-pages.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePdf } from './crawl.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CORPUS = path.join(__dirname, '..', 'data', 'corpus.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function fetchBuf(url, ms = 45000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' }, signal: ctrl.signal })
    if (!r.ok) throw new Error('http ' + r.status)
    return Buffer.from(await r.arrayBuffer())
  } finally { clearTimeout(t) }
}

const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'))
const pdfs = corpus.docs.filter((d) => d.type === 'pdf')
console.log(`${pdfs.length} PDFs to augment with page numbers…`)

let ok = 0, failed = 0, withPages = 0
for (let i = 0; i < pdfs.length; i++) {
  const d = pdfs[i]
  if (Array.isArray(d.pages) && d.pages.length) { withPages++; continue }
  try {
    const buf = await fetchBuf(d.url)
    const { text, pages } = await parsePdf(buf)
    if (pages && pages.length) { d.pages = pages; if (text && text.length > 300) d.text = text; ok++ }
    else failed++
    process.stdout.write(`  ${i + 1}/${pdfs.length} ${d.pages ? d.pages.length + 'p' : 'fail'} ${d.url.split('/').pop().slice(0, 40)}\n`)
  } catch (e) {
    failed++
    process.stdout.write(`  ${i + 1}/${pdfs.length} ERROR ${e.message} ${d.url.split('/').pop().slice(0, 40)}\n`)
  }
}

fs.writeFileSync(CORPUS, JSON.stringify({ ...corpus, docs: corpus.docs }))
console.log(`Done. paged ${ok}, already-had ${withPages}, failed ${failed}. Saved → ${CORPUS}`)
