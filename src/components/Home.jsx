import { SCHEMES, HELPLINES, T, tr } from '../data.js'

export default function Home({ lang, onScheme, onTalk }) {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-avatar" aria-hidden>🤝</div>
        <h1 className="hero-title">{tr(T.greetTitle, lang)}</h1>
        <p className="hero-body">{tr(T.greetBody, lang)}</p>
        <div className="hero-ctas">
          <button className="cta" onClick={() => onScheme(null)}>
            💬 {tr(T.askSaheli, lang)}
          </button>
          <button className="cta cta-voice" onClick={() => onTalk?.()}>
            🎙️ {tr(T.tabVoice, lang)}
          </button>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{tr(T.chooseHelp, lang)}</h2>
        <div className="scheme-list">
          {Object.values(SCHEMES).map((s) => (
            <button
              key={s.id}
              className="scheme-card"
              style={{ '--c': s.color, '--tint': s.tint }}
              onClick={() => onScheme(s.id)}
            >
              <span className="scheme-icon" aria-hidden>{s.icon}</span>
              <span className="scheme-text">
                <span className="scheme-name">{tr(s.name, lang)}</span>
                <span className="scheme-tag">{tr(s.tag, lang)}</span>
                <span className="scheme-blurb">{tr(s.blurb, lang)}</span>
              </span>
              <span className="scheme-arrow" aria-hidden>›</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{tr(T.helplines, lang)}</h2>
        <div className="helpline-grid">
          {HELPLINES.map((h) => (
            <a key={h.num} className="helpline" href={`tel:${h.num}`} style={{ '--c': h.color }}>
              <span className="helpline-num">{h.num}</span>
              <span className="helpline-label">{tr(h.label, lang)}</span>
              <span className="helpline-call" aria-hidden>📞</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        {tr({ en: 'A demonstration for the Ministry of Women & Child Development', hi: 'महिला एवं बाल विकास मंत्रालय के लिए प्रदर्शन' }, lang)}
      </footer>
    </div>
  )
}
