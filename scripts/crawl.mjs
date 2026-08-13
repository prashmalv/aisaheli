// WCD site crawler → data/corpus.json
//
// Crawls ONLY official Women & Child Development sites (and their subdomains)
// plus the PDFs/documents linked from those pages, so every answer can be
// traced to an official source. HTML pages are restricted to the WCD hosts
// below; PDF documents are additionally allowed when hosted on the parent
// *.gov.in domain but linked from a WCD page ("attached documents").
//
// Usage:  node scripts/crawl.mjs
// Tunables via env: MAX_PAGES_PER_SITE, MAX_PDFS_PER_SITE, CRAWL_DELAY_MS

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// Each site: host (for HTML restriction), scope tag, state, seed paths.
// scope drives which sources a citizen's selected scheme/location may use.
const SITES = [
  {
    scope: 'shakti',
    state: 'national',
    label: 'Mission Shakti',
    host: 'missionshakti.wcd.gov.in',
    seeds: ['https://missionshakti.wcd.gov.in/'],
  },
  {
    scope: 'vatsalya',
    state: 'national',
    label: 'Mission Vatsalya',
    host: 'missionvatsalya.wcd.gov.in',
    seeds: ['https://missionvatsalya.wcd.gov.in/'],
  },
  {
    scope: 'poshan',
    state: 'national',
    label: 'Poshan Abhiyaan',
    host: 'poshanabhiyaan.gov.in',
    seeds: ['https://poshanabhiyaan.gov.in/'],
  },
  {
    scope: 'national',
    state: 'national',
    label: 'MoWCD (National)',
    host: 'wcd.gov.in',
    seeds: [
      'https://wcd.gov.in/',
      'https://wcd.gov.in/schemes-listing',
      'https://wcd.gov.in/schemes',
      'https://wcd.gov.in/about-us',
      'https://wcd.gov.in/acts',
    ],
  },
  {
    scope: 'delhi',
    state: 'delhi',
    label: 'WCD Delhi',
    host: 'wcd.delhi.gov.in',
    seeds: [
      'https://wcd.delhi.gov.in/',
      'https://wcd.delhi.gov.in/our-services',
      'https://wcd.delhi.gov.in/wcd/about-us',
      'https://wcd.delhi.gov.in/faqs',
      'https://wcd.delhi.gov.in/useful-link',
      'https://wcd.delhi.gov.in/circulars-orders',
      'https://wcd.delhi.gov.in/notifications',
    ],
  },
]

const MAX_PAGES = Number(process.env.MAX_PAGES_PER_SITE || 90)
const MAX_PDFS = Number(process.env.MAX_PDFS_PER_SITE || 30)
const DELAY = Number(process.env.CRAWL_DELAY_MS || 250)
const FETCH_TIMEOUT = 25000
const MAX_PDF_BYTES = 12 * 1024 * 1024

// Some WCD sites (e.g. missionvatsalya) 403 non-browser agents, so present a
// standard browser UA. We still crawl politely (delay + caps) and only WCD hosts.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#160': ' ' }
function decodeEntities(s) {
  return s.replace(/&(#?\w+);/g, (m, e) => (ENTITIES[e] != null ? ENTITIES[e] : (e[0] === '#' ? String.fromCharCode(Number(e.slice(1))) : m)))
}

// Very light HTML → text: drop non-content tags, keep readable body text.
function htmlToText(html) {
  let s = html
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<(script|style|noscript|svg|head|nav|footer|form)\b[\s\S]*?<\/\1>/gi, ' ')
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, '\n')
  s = s.replace(/<li\b[^>]*>/gi, '\n• ')
  s = s.replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  s = s.replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').replace(/^\s+|\s+$/gm, '')
  return s.trim()
}
function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : ''
}
function extractLinks(html, baseUrl) {
  const out = []
  const re = /href\s*=\s*["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    let href = m[1].trim()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    try { out.push(new URL(href, baseUrl).href.split('#')[0]) } catch {}
  }
  return out
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...(opts.headers || {}) } })
  } finally {
    clearTimeout(t)
  }
}

const isPdf = (u) => /\.pdf(\?|$)/i.test(u)
const isAsset = (u) => /\.(css|js|png|jpe?g|gif|svg|ico|webp|mp4|mp3|zip|docx?|xlsx?|pptx?|woff2?|ttf)(\?|$)/i.test(u)

let pdfParse = null
async function parsePdf(buf) {
  // Import the lib file directly — pdf-parse's index.js has a debug block that
  // reads a bundled test PDF when run as the main module.
  if (!pdfParse) pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const r = await pdfParse(buf)
  return (r.text || '').replace(/\n{3,}/g, '\n\n').trim()
}

async function crawlSite(site, docs, seenPdf) {
  const queue = [...site.seeds]
  const visited = new Set()
  let pages = 0
  let pdfs = 0

  while (queue.length && pages < MAX_PAGES) {
    const url = queue.shift()
    if (visited.has(url)) continue
    visited.add(url)
    let host
    try { host = new URL(url).host } catch { continue }
    if (host !== site.host) continue

    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) continue
      const ctype = res.headers.get('content-type') || ''
      if (!/text\/html/i.test(ctype)) continue
      const html = await res.text()
      const title = extractTitle(html) || url
      const text = htmlToText(html)
      if (text.length > 200) {
        docs.push({ url, title, scope: site.scope, state: site.state, site: site.label, type: 'page', text })
        pages++
        process.stdout.write(`  [${site.state}] page ${pages}/${MAX_PAGES}: ${title.slice(0, 60)}\n`)
      }

      for (const link of extractLinks(html, url)) {
        if (isPdf(link)) {
          if (pdfs < MAX_PDFS && !seenPdf.has(link) && /\.gov\.in/i.test(new URL(link).host)) {
            seenPdf.add(link)
            try {
              const pr = await fetchWithTimeout(link)
              const len = Number(pr.headers.get('content-length') || 0)
              if (pr.ok && len <= MAX_PDF_BYTES) {
                const buf = Buffer.from(await pr.arrayBuffer())
                if (buf.length <= MAX_PDF_BYTES) {
                  const ptext = await parsePdf(buf)
                  if (ptext && ptext.length > 300) {
                    const pname = decodeURIComponent(link.split('/').pop() || 'document.pdf')
                    docs.push({ url: link, title: pname.replace(/[-_]/g, ' ').replace(/\.pdf$/i, ''), scope: site.scope, state: site.state, site: site.label, type: 'pdf', text: ptext })
                    pdfs++
                    process.stdout.write(`  [${site.state}] pdf ${pdfs}/${MAX_PDFS}: ${pname.slice(0, 60)}\n`)
                  }
                }
              }
            } catch (e) { /* skip bad pdf */ }
            await sleep(DELAY)
          }
        } else if (!isAsset(link) && new URL(link).host === site.host && !visited.has(link) && queue.length < 400) {
          queue.push(link)
        }
      }
    } catch (e) {
      // network hiccup — skip this URL
    }
    await sleep(DELAY)
  }
  return { pages, pdfs }
}

async function main() {
  console.log('Crawling official WCD sources (pages + linked PDFs)…\n')
  const docs = []
  const seenPdf = new Set()
  for (const site of SITES) {
    console.log(`\n=== ${site.label} (${site.host}) ===`)
    try {
      const { pages, pdfs } = await crawlSite(site, docs, seenPdf)
      console.log(`  → ${pages} pages, ${pdfs} PDFs`)
    } catch (e) {
      console.log(`  ! site failed: ${e.message}`)
    }
  }
  const out = path.join(DATA_DIR, 'corpus.json')
  fs.writeFileSync(out, JSON.stringify({ crawledAt: new Date().toISOString(), count: docs.length, docs }, null, 0))
  const chars = docs.reduce((s, d) => s + d.text.length, 0)
  console.log(`\nSaved ${docs.length} docs (${(chars / 1000).toFixed(0)}k chars) → ${out}`)
}

main()
