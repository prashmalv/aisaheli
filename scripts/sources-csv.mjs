// Export the exact list of official sources the assistant can cite → CSV.
// Reads data/index.json and writes wcd-sources.csv (one row per page/PDF),
// so the Ministry can see which sites/documents back the answers.
//
// Usage:  node scripts/sources-csv.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const GROUP = {
  shakti: 'Mission Shakti',
  vatsalya: 'Mission Vatsalya',
  poshan: 'Poshan Abhiyaan',
  national: 'National (MoWCD)',
  delhi: 'Delhi',
}

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'index.json'), 'utf8'))

// One row per unique document (dedupe chunks by URL).
const seen = new Map()
for (const c of idx.chunks) {
  if (seen.has(c.url)) continue
  // Prefer a scheme scope (so Poshan pages show as Poshan, not National).
  const scheme = (c.scopes || []).find((s) => ['vatsalya', 'shakti', 'poshan'].includes(s))
  const group = scheme || (c.scopes && c.scopes[0]) || c.state || 'national'
  seen.set(c.url, {
    group: GROUP[group] || group,
    site: c.site || '',
    host: (() => { try { return new URL(c.url).host } catch { return '' } })(),
    type: (c.type || '').toUpperCase(),
    title: c.title || '',
    year: c.year || '',
    url: c.url,
  })
}
const rows = [...seen.values()].sort((a, b) => (a.group + a.site + a.title).localeCompare(b.group + b.site + b.title))

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const header = ['Programme / Group', 'Source Site', 'Host', 'Type', 'Document / Page Title', 'Year', 'URL']
const lines = [header.map(esc).join(',')]
for (const r of rows) lines.push([r.group, r.site, r.host, r.type, r.title, r.year, r.url].map(esc).join(','))

const out = path.join(ROOT, 'wcd-sources.csv')
fs.writeFileSync(out, '﻿' + lines.join('\r\n')) // BOM so Excel reads Unicode/Devanagari

// Summary by group
const counts = {}
for (const r of rows) counts[r.group] = (counts[r.group] || 0) + 1
console.log(`Wrote ${rows.length} sources → ${out}`)
for (const [g, n] of Object.entries(counts).sort()) console.log(`  ${g}: ${n}`)
