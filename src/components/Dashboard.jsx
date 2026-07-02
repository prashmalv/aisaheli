import { useEffect, useState } from 'react'
import { getDashboard } from '../api.js'
import { SCHEMES, T, tr } from '../data.js'

export default function Dashboard({ lang }) {
  const [d, setD] = useState(null)
  useEffect(() => { getDashboard().then(setD).catch(() => {}) }, [])

  if (!d) return <div className="dash-loading">Loading insights…</div>

  const nf = new Intl.NumberFormat('en-IN')

  return (
    <div className="dash">
      <div className="dash-head">
        <h1>{tr(T.dashTitle, lang)}</h1>
        <p>{tr(T.dashSub, lang)}</p>
      </div>

      <div className="kpi-grid">
        <Kpi label={{ en: 'Total interactions', hi: 'कुल संवाद' }} value={nf.format(d.kpis.totalInteractions)} lang={lang} accent="#b0138e" />
        <Kpi label={{ en: 'Unique citizens', hi: 'अद्वितीय नागरिक' }} value={nf.format(d.kpis.uniqueCitizens)} lang={lang} accent="#2e9e5b" />
        <Kpi label={{ en: 'Resolution rate', hi: 'समाधान दर' }} value={`${Math.round(d.kpis.resolutionRate * 100)}%`} lang={lang} accent="#f08a24" />
        <Kpi label={{ en: 'Avg. response', hi: 'औसत उत्तर' }} value={`${d.kpis.avgResponseSec}s`} lang={lang} accent="#3b82f6" />
        <Kpi label={{ en: 'Languages served', hi: 'भाषाएँ' }} value={d.kpis.languagesServed} lang={lang} accent="#7c3aed" />
        <Kpi label={{ en: 'Safety escalations', hi: 'सुरक्षा रेफ़रल' }} value={nf.format(d.kpis.escalations)} lang={lang} accent="#d92d20" />
      </div>

      <Card title={{ en: 'Interactions over time', hi: 'समय के साथ संवाद' }} lang={lang}>
        <Sparkline trend={d.trend} />
      </Card>

      <div className="dash-row">
        <Card title={{ en: 'By scheme', hi: 'योजना अनुसार' }} lang={lang} grow>
          <Donut data={d.byScheme} lang={lang} />
        </Card>
        <Card title={{ en: 'By language', hi: 'भाषा अनुसार' }} lang={lang} grow>
          <BarList data={d.byLanguage} color="#b0138e" />
        </Card>
      </div>

      <Card title={{ en: 'Query intent', hi: 'प्रश्न की प्रकृति' }} lang={lang}>
        <StackBar data={d.urgencyBreakdown} />
      </Card>

      <Card title={{ en: 'Top questions', hi: 'शीर्ष प्रश्न' }} lang={lang}>
        <ol className="tq-list">
          {d.topQuestions.map((q, i) => (
            <li key={i}>
              <span className="tq-dot" style={{ background: SCHEMES[q.scheme].color }} />
              <span className="tq-text">{q.q}</span>
              <span className="tq-count">{new Intl.NumberFormat('en-IN').format(q.count)}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={{ en: 'Regional hotspots', hi: 'क्षेत्रीय केंद्र' }} lang={lang}>
        <div className="region-list">
          {d.regions.map((r) => (
            <div key={r.state} className="region">
              <div className="region-main">
                <span className="region-state">{r.state}</span>
                <span className={`urg urg-${r.urgency}`}>{r.urgency}</span>
              </div>
              <div className="region-concern">{r.topConcern}</div>
              <div className="region-count">{new Intl.NumberFormat('en-IN').format(r.interactions)} interactions</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={{ en: 'Emerging concerns', hi: 'उभरती चिंताएँ' }} lang={lang}>
        <div className="concern-list">
          {d.emergingConcerns.map((c) => (
            <div key={c.label} className="concern">
              <span className={`concern-sent s-${c.sentiment}`} />
              <span className="concern-label">{c.label}</span>
              <span className={`concern-change ${c.change >= 0 ? 'up' : 'down'}`}>
                {c.change >= 0 ? '▲' : '▼'} {Math.abs(c.change)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <p className="dash-note">
        {tr({ en: '● Sample data for demonstration. Live deployment draws from anonymised interaction logs.', hi: '● प्रदर्शन हेतु नमूना डेटा। वास्तविक परिनियोजन अनामीकृत लॉग से डेटा लेता है।' }, lang)}
      </p>
    </div>
  )
}

function Kpi({ label, value, lang, accent }) {
  return (
    <div className="kpi" style={{ '--a': accent }}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{tr(label, lang)}</div>
    </div>
  )
}

function Card({ title, lang, children, grow }) {
  return (
    <div className={`card ${grow ? 'grow' : ''}`}>
      <div className="card-title">{tr(title, lang)}</div>
      {children}
    </div>
  )
}

function Sparkline({ trend }) {
  const w = 300, h = 90, pad = 6
  const vals = trend.map((t) => t.interactions)
  const max = Math.max(...vals), min = Math.min(...vals)
  const x = (i) => pad + (i * (w - pad * 2)) / (trend.length - 1)
  const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = `${x(0)},${h - pad} ${line} ${x(vals.length - 1)},${h - pad}`
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b0138e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#b0138e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)" />
      <polyline points={line} fill="none" stroke="#b0138e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.6" fill="#b0138e" />)}
    </svg>
  )
}

function Donut({ data, lang }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 42, c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 110 110" className="donut">
        <g transform="translate(55,55) rotate(-90)">
          {data.map((d) => {
            const frac = d.value / total
            const dash = frac * c
            const seg = (
              <circle key={d.key} r={r} fill="none" stroke={d.color} strokeWidth="16"
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
            )
            offset += dash
            return seg
          })}
        </g>
        <text x="55" y="52" textAnchor="middle" className="donut-c1">100%</text>
        <text x="55" y="66" textAnchor="middle" className="donut-c2">schemes</text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.key}><span className="sw" style={{ background: d.color }} />{tr(SCHEMES[d.key]?.name, lang) || d.label}<b>{d.value}%</b></li>
        ))}
      </ul>
    </div>
  )
}

function BarList({ data, color }) {
  const max = Math.max(...data.map((d) => d.value))
  return (
    <div className="barlist">
      {data.map((d) => (
        <div key={d.label} className="barrow">
          <span className="barlabel">{d.label}</span>
          <span className="bartrack"><span className="barfill" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></span>
          <span className="barval">{d.value}%</span>
        </div>
      ))}
    </div>
  )
}

function StackBar({ data }) {
  return (
    <div className="stack">
      <div className="stack-bar">
        {data.map((d) => (
          <span key={d.label} className="stack-seg" style={{ width: `${d.value}%`, background: d.color }} title={`${d.label}: ${d.value}%`} />
        ))}
      </div>
      <ul className="stack-legend">
        {data.map((d) => (
          <li key={d.label}><span className="sw" style={{ background: d.color }} />{d.label} <b>{d.value}%</b></li>
        ))}
      </ul>
    </div>
  )
}
