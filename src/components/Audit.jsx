import { useEffect, useState } from 'react'
import { getAudit } from '../api.js'
import { T, tr, SCHEMES } from '../data.js'
import { Citations } from './Chat.jsx'

// Government/admin audit: recent citizen answers with the official sources that
// backed each one, so the department can verify correct sourcing.
export default function Audit({ lang }) {
  const [items, setItems] = useState(null)

  function load() { getAudit().then((d) => setItems(d.interactions || [])).catch(() => setItems([])) }
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [])

  const fmt = (ts) => { try { return new Date(ts).toLocaleString('en-IN', { hour12: true }) } catch { return ts } }
  const clean = (s) => String(s || '').replace(/\*\*/g, '').replace(/[*_`#]/g, '').trim()

  return (
    <div className="audit">
      <div className="audit-head">
        <div>
          <h1>{tr(T.auditTitle, lang)}</h1>
          <p>{tr(T.auditSub, lang)}</p>
        </div>
        <button className="audit-refresh" onClick={load} aria-label="Refresh">⟳</button>
      </div>

      {items && items.length === 0 && <p className="audit-empty">{tr(T.auditEmpty, lang)}</p>}
      {!items && <p className="audit-empty">Loading…</p>}

      <div className="audit-list">
        {(items || []).map((it, i) => (
          <div className="audit-card" key={i}>
            <div className="audit-meta">
              <span className="audit-time">{fmt(it.ts)}</span>
              <span className={`audit-role r-${it.role}`}>{it.role === 'officer' ? '🏛️ officer' : '👩 citizen'} · {it.user}</span>
              {it.scheme && SCHEMES[it.scheme] && (
                <span className="audit-scheme" style={{ '--c': SCHEMES[it.scheme].color }}>{SCHEMES[it.scheme].icon} {tr(SCHEMES[it.scheme].name, lang)}</span>
              )}
              {it.state && it.state !== 'all' && <span className="audit-loc">📍 {it.state}</span>}
              <span className={`audit-ch ch-${it.channel}`}>{it.channel === 'voice' ? '🎙️' : '💬'}</span>
            </div>
            <div className="audit-q"><b>{tr(T.auditQ, lang)}:</b> {it.question}</div>
            <div className="audit-a"><b>{tr(T.auditA, lang)}:</b> {clean(it.answer)}</div>
            {it.citations && it.citations.length
              ? <Citations items={it.citations} lang={lang} />
              : <div className="audit-nocite">⚠️ {tr(T.auditNoCite, lang)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
