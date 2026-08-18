// Verify every source URL in the index is reachable; write the unreachable
// ones to data/dead-urls.json so the retriever never cites a broken link.
// Runs offline (one-time / periodic) — zero cost at query time. Run:
//   node scripts/check-links.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'data')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'))
const urls = [...new Set(idx.chunks.map((c) => c.url))]
console.log(`Checking ${urls.length} unique source URLs…`)

async function reachable(url) {
  // Try a light GET (range) with a browser UA; retry once. A 2xx/3xx = OK.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-2048', Accept: '*/*' }, redirect: 'follow', signal: ctrl.signal })
      clearTimeout(t)
      if (r.status >= 200 && r.status < 400) return true
      // Some servers reject Range/HEAD-ish; a 405/416 still means it exists.
      if (r.status === 405 || r.status === 416 || r.status === 403) return true
      return false
    } catch {
      clearTimeout(t)
      if (attempt === 1) return false
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  return false
}

const dead = []
let done = 0
const CONC = 6
async function worker(queue) {
  while (queue.length) {
    const url = queue.pop()
    const ok = await reachable(url)
    done++
    if (!ok) { dead.push(url); process.stdout.write(`  DEAD ${url}\n`) }
    if (done % 25 === 0) process.stdout.write(`  ...${done}/${urls.length}\n`)
  }
}
const queue = [...urls]
await Promise.all(Array.from({ length: CONC }, () => worker(queue)))

fs.writeFileSync(path.join(DATA, 'dead-urls.json'), JSON.stringify(dead, null, 0))
console.log(`\nChecked ${urls.length}. Dead: ${dead.length}. Wrote data/dead-urls.json`)
