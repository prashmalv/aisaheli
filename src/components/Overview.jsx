import { useEffect, useState } from 'react'
import { getDashboard, getSources } from '../api.js'
import { SCHEMES, T, tr } from '../data.js'

// Big-screen, website-style overview for showcasing to the Ministry on a large
// display. Standalone route (/overview) — no login, no phone frame.
export default function Overview({ lang, setLang }) {
  const [dash, setDash] = useState(null)
  const [sources, setSources] = useState(null)
  useEffect(() => {
    getDashboard().then(setDash).catch(() => {})
    getSources().then(setSources).catch(() => {})
  }, [])
  const nf = new Intl.NumberFormat('en-IN')
  const k = dash?.kpis

  const steps = [
    { icon: '🗣️', t: { en: 'Citizen asks', hi: 'नागरिक पूछता है' }, d: { en: 'In any language, by text or voice — on app, web or WhatsApp.', hi: 'किसी भी भाषा में, टेक्स्ट या आवाज़ से — ऐप, वेब या व्हाट्सऐप पर।' } },
    { icon: '📚', t: { en: 'Grounded in official sources', hi: 'आधिकारिक स्रोतों पर आधारित' }, d: { en: 'Answers only from official WCD websites & their documents.', hi: 'केवल आधिकारिक WCD वेबसाइटों व दस्तावेज़ों से उत्तर।' } },
    { icon: '📎', t: { en: 'Cited & verifiable', hi: 'स्रोत सहित, सत्यापन योग्य' }, d: { en: 'Every fact shows its exact page/section and source link.', hi: 'हर तथ्य का सटीक पृष्ठ/अनुभाग व स्रोत लिंक।' } },
    { icon: '📊', t: { en: 'Insights for the Ministry', hi: 'मंत्रालय हेतु इनसाइट्स' }, d: { en: 'Real-time view of demand, top questions & regional needs.', hi: 'माँग, शीर्ष प्रश्न व क्षेत्रीय ज़रूरतों का रीयल-टाइम दृश्य।' } },
  ]
  const channels = [
    { icon: '📱', label: { en: 'Mobile App', hi: 'मोबाइल ऐप' } },
    { icon: '💬', label: { en: 'WhatsApp', hi: 'व्हाट्सऐप' } },
    { icon: '🎙️', label: { en: 'Voice / IVR', hi: 'आवाज़ / IVR' } },
    { icon: '🌐', label: { en: 'Web Portal', hi: 'वेब पोर्टल' } },
  ]

  return (
    <div className="ov">
      <div className="tricolor" />
      <header className="ov-top">
        <div className="ov-brand">
          <span className="ov-emblem" aria-hidden>🇮🇳</span>
          <div>
            <div className="ov-name">{tr(T.appName, lang)}</div>
            <div className="ov-sub">{tr(T.appSub, lang)}</div>
          </div>
        </div>
        <button className="ov-lang" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>{lang === 'hi' ? 'EN' : 'हिं'}</button>
      </header>

      <section className="ov-hero">
        <div className="ov-hero-badge">🤝 {tr(T.verifiedBadge, lang)}</div>
        <h1>{tr({ en: 'AI Saheli — a citizen-first, citation-backed AI assistant', hi: 'एआई सहेली — नागरिक-केंद्रित, स्रोत-आधारित एआई सहायक' }, lang)}</h1>
        <p>{tr({ en: 'Guiding citizens across Poshan Abhiyaan, Mission Vatsalya and Mission Shakti — grounded strictly in official WCD sources, in every Indian language, 24×7.', hi: 'पोषण अभियान, मिशन वात्सल्य और मिशन शक्ति में नागरिकों का मार्गदर्शन — केवल आधिकारिक WCD स्रोतों पर आधारित, हर भारतीय भाषा में, 24×7।' }, lang)}</p>
      </section>

      {k && (
        <section className="ov-kpis">
          <Kpi v={nf.format(k.totalInteractions)} l={{ en: 'Citizen interactions', hi: 'नागरिक संवाद' }} lang={lang} c="#b0138e" />
          <Kpi v={nf.format(k.uniqueCitizens)} l={{ en: 'Unique citizens', hi: 'अद्वितीय नागरिक' }} lang={lang} c="#2e9e5b" />
          <Kpi v={`${Math.round(k.resolutionRate * 100)}%`} l={{ en: 'Resolution rate', hi: 'समाधान दर' }} lang={lang} c="#f08a24" />
          <Kpi v={k.languagesServed} l={{ en: 'Languages', hi: 'भाषाएँ' }} lang={lang} c="#7c3aed" />
          <Kpi v={`${k.avgResponseSec}s`} l={{ en: 'Avg. response', hi: 'औसत उत्तर' }} lang={lang} c="#3b82f6" />
          {sources && <Kpi v={nf.format(sources.total)} l={{ en: 'Official sources', hi: 'आधिकारिक स्रोत' }} lang={lang} c="#0e7490" />}
        </section>
      )}

      <section className="ov-section">
        <h2>{tr({ en: 'Programmes covered', hi: 'शामिल कार्यक्रम' }, lang)}</h2>
        <div className="ov-schemes">
          {Object.values(SCHEMES).map((s) => (
            <div key={s.id} className="ov-scheme" style={{ '--c': s.color, '--tint': s.tint }}>
              <span className="ov-scheme-icon">{s.icon}</span>
              <div className="ov-scheme-name">{tr(s.name, lang)}</div>
              <div className="ov-scheme-tag">{tr(s.tag, lang)}</div>
              <div className="ov-scheme-blurb">{tr(s.blurb, lang)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="ov-section">
        <h2>{tr({ en: 'How it works', hi: 'यह कैसे काम करता है' }, lang)}</h2>
        <div className="ov-steps">
          {steps.map((s, i) => (
            <div key={i} className="ov-step">
              <span className="ov-step-icon">{s.icon}</span>
              <div className="ov-step-t">{tr(s.t, lang)}</div>
              <div className="ov-step-d">{tr(s.d, lang)}</div>
            </div>
          ))}
        </div>
      </section>

      {sources && (
        <section className="ov-section">
          <h2>{tr({ en: 'Grounded in official WCD sources', hi: 'आधिकारिक WCD स्रोतों पर आधारित' }, lang)}</h2>
          <div className="ov-sources">
            {Object.entries(sources.byGroup).map(([g, n]) => (
              <div key={g} className="ov-src"><span className="ov-src-n">{n}</span><span className="ov-src-g">{g}</span></div>
            ))}
          </div>
          <p className="ov-src-note">{tr({ en: 'Every answer is traceable to an official page or PDF — with its exact section or page number.', hi: 'हर उत्तर किसी आधिकारिक पेज या PDF तक — सटीक अनुभाग या पृष्ठ संख्या सहित — पहुँचता है।' }, lang)}</p>
        </section>
      )}

      <section className="ov-section">
        <h2>{tr({ en: 'Available across channels', hi: 'सभी माध्यमों पर उपलब्ध' }, lang)}</h2>
        <div className="ov-channels">
          {channels.map((c, i) => (
            <div key={i} className="ov-channel"><span>{c.icon}</span> {tr(c.label, lang)}</div>
          ))}
        </div>
      </section>

      <footer className="ov-footer">
        {tr({ en: 'Confidential — prepared by Uneecops Technologies for the Ministry of Women & Child Development. Scheme details are indicative for demonstration.', hi: 'गोपनीय — महिला एवं बाल विकास मंत्रालय हेतु Uneecops Technologies द्वारा तैयार। योजना विवरण प्रदर्शन हेतु सांकेतिक हैं।' }, lang)}
      </footer>
    </div>
  )
}

function Kpi({ v, l, lang, c }) {
  return (
    <div className="ov-kpi" style={{ '--a': c }}>
      <div className="ov-kpi-v">{v}</div>
      <div className="ov-kpi-l">{tr(l, lang)}</div>
    </div>
  )
}
