import { useEffect, useRef, useState } from 'react'
import { streamChat } from '../api.js'
import { T, tr, SCHEMES } from '../data.js'
import { loadConv, saveConv } from '../storage.js'

export default function Chat({ lang, health, seed, userId, loc, scheme, showCitations = false, role = 'citizen' }) {
  const [messages, setMessages] = useState(() => {
    const saved = loadConv('chat', userId)
    return saved && saved.length ? saved : [{ role: 'assistant', content: tr(T.chatIntro, lang) }]
  })
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const listRef = useRef(null)
  const recogRef = useRef(null)
  const seededRef = useRef(null)

  const starters = health?.starters || null
  const showStarters = messages.length <= 1 && !busy

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  // Persist this user's conversation so it's restored on next login.
  useEffect(() => {
    if (!busy && messages.length > 1) saveConv('chat', userId, messages)
  }, [messages, busy, userId])

  // Send a seeded question coming from the Home screen scheme cards.
  useEffect(() => {
    if (seed && seed.q && seededRef.current !== seed.at) {
      seededRef.current = seed.at
      send(seed.q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setInput('')
    stopListening()

    const next = [...messages, { role: 'user', content }]
    setMessages([...next, { role: 'assistant', content: '', pending: true }])
    setBusy(true)

    try {
      const res = await streamChat(
        next.map(({ role, content }) => ({ role, content })),
        (full) => {
          setMessages((cur) => {
            const copy = [...cur]
            copy[copy.length - 1] = { role: 'assistant', content: full }
            return copy
          })
        },
        undefined,
        { channel: 'text', state: loc || 'all', scheme: scheme || null, role, userId, lang },
      )
      setMessages((cur) => {
        const copy = [...cur]
        copy[copy.length - 1] = { role: 'assistant', content: res.text || copy[copy.length - 1].content, citations: res.citations }
        return copy
      })
    } catch {
      setMessages((cur) => {
        const copy = [...cur]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: tr(
            { en: 'Sorry, I could not respond just now. Please try again.', hi: 'क्षमा करें, अभी उत्तर नहीं दे सकी। कृपया फिर प्रयास करें।' },
            lang,
          ),
        }
        return copy
      })
    } finally {
      setBusy(false)
    }
  }

  // --- Voice input (Web Speech API) ---
  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert(tr({ en: 'Voice input is not supported in this browser. Please type.', hi: 'इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। कृपया टाइप करें।' }, lang))
      return
    }
    const recog = new SR()
    recog.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    recog.interimResults = true
    recog.continuous = false
    recog.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('')
      setInput(text)
    }
    recog.onend = () => setListening(false)
    recog.onerror = () => setListening(false)
    recogRef.current = recog
    setListening(true)
    recog.start()
  }
  function stopListening() {
    if (recogRef.current) {
      try { recogRef.current.stop() } catch {}
    }
    setListening(false)
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} citations={showCitations ? m.citations : null} pending={m.pending && !m.content} lang={lang} />
        ))}

        {showStarters && starters && (
          <div className="starters">
            <div className="starters-title">{tr(T.suggested, lang)}</div>
            {Object.keys(SCHEMES).flatMap((k) =>
              (starters[k] || []).slice(0, 2).map((s, i) => (
                <button key={k + i} className="starter-chip" style={{ '--c': SCHEMES[k].color }} onClick={() => send(s[lang] || s.en)}>
                  <span aria-hidden>{SCHEMES[k].icon}</span> {s[lang] || s.en}
                </button>
              )),
            )}
          </div>
        )}
      </div>

      <div className="composer">
        <button
          className={`mic ${listening ? 'on' : ''}`}
          onClick={listening ? stopListening : startListening}
          aria-label="Voice input"
          title="Voice input"
        >
          {listening ? '⏺' : '🎤'}
        </button>
        <input
          className="composer-input"
          value={input}
          placeholder={listening ? tr(T.listening, lang) : tr(T.inputPlaceholder, lang)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={busy}
        />
        <button className="send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send">
          ➤
        </button>
      </div>
    </div>
  )
}

function Bubble({ role, content, citations, pending, lang }) {
  const isUser = role === 'user'
  return (
    <div className={`bubble-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && <div className="bot-avatar" aria-hidden>🤝</div>}
      <div className={`bubble ${isUser ? 'user' : 'bot'}`}>
        {pending ? <Typing /> : <Rich text={content} />}
        {!isUser && <Citations items={citations} lang={lang} />}
      </div>
    </div>
  )
}

// Verifiable sources under an answer — links to the exact WCD page/PDF.
export function Citations({ items, lang }) {
  const [open, setOpen] = useState(false)
  if (!items || !items.length) return null
  const host = (u) => { try { return new URL(u).host } catch { return u } }
  const path = (u) => { try { const x = new URL(u); return decodeURIComponent(x.pathname) } catch { return '' } }
  const sim = (c) => (typeof c.similarity === 'number' ? Math.round(c.similarity * 100) : null)

  return (
    <div className="cites">
      <div className="cites-head">
        <span className="cites-title">📎 {tr(T.sourcesLabel, lang)} · {items.length}</span>
        <button className="cites-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? tr(T.hideDetails, lang) : tr(T.showDetails, lang)}
        </button>
      </div>

      {/* Compact: one small button per source → opens the highlighted spot */}
      <div className="cite-chips">
        {items.map((c) => (
          <a
            key={c.n}
            className="cite-chip"
            data-type={c.type}
            href={c.locator || c.url}
            target="_blank"
            rel="noreferrer"
            title={`${c.title}${c.type === 'pdf' && c.page ? ` — page ${c.page}` : ''}\n“${c.quote || ''}”`}
          >
            <span className="chip-n">{c.n}</span>
            <span className="chip-type">{c.type === 'pdf' ? 'PDF' : 'WEB'}{c.type === 'pdf' && c.page ? ` p${c.page}` : ''}</span>
            {sim(c) != null && <span className="chip-sim">{sim(c)}%</span>}
          </a>
        ))}
      </div>

      {/* Detailed: exact passage, page, cosine similarity, jump/open */}
      {open && items.map((c) => (
        <div key={c.n} className="cite">
          <div className="cite-row">
            <span className="cite-badge" data-type={c.type}>{c.type === 'pdf' ? 'PDF' : 'WEB'}</span>
            <span className="cite-text">
              <span className="cite-title">
                [{c.n}] {c.title}
                {c.type === 'pdf' && c.page ? <span className="cite-page">{tr(T.pageLabel, lang)} {c.page}</span> : null}
                {sim(c) != null && <span className="cite-sim" title="cosine similarity">{tr(T.matchLabel, lang)} {sim(c)}%</span>}
              </span>
              <span className="cite-host">{host(c.url)}{c.year ? ` · ${c.year}` : ''}</span>
              {c.section && <span className="cite-section">§ {tr(T.sectionLabel, lang)}: {c.section}</span>}
              {c.type === 'pdf' && c.page && <span className="cite-section">§ {tr(T.pageLabel, lang)} {c.page}</span>}
              <span className="cite-path">{path(c.url)}</span>
            </span>
          </div>
          {c.quote && <div className="cite-quote">“{c.quote}”</div>}
          <div className="cite-actions">
            {c.type === 'pdf' ? (
              <a className="cite-jump" href={c.locator || c.url} target="_blank" rel="noreferrer">
                📄 {c.page ? `${tr(T.openPdfPage, lang)} ${c.page}` : tr(T.openPdf, lang)}
              </a>
            ) : (
              <>
                {c.locator && <a className="cite-jump" href={c.locator} target="_blank" rel="noreferrer">🔎 {tr(T.jumpToText, lang)}</a>}
                <a className="cite-open" href={c.url} target="_blank" rel="noreferrer">↗ {tr(T.openPage, lang)}</a>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Typing() {
  return (
    <div className="typing" aria-label="typing">
      <span /><span /><span />
    </div>
  )
}

// Minimal, safe markdown-ish renderer: **bold**, line breaks, and • / - bullets.
function Rich({ text }) {
  const lines = String(text).split('\n')
  const out = []
  let bullets = []
  const flush = (key) => {
    if (bullets.length) {
      out.push(<ul key={'ul' + key} className="rich-ul">{bullets}</ul>)
      bullets = []
    }
  }
  lines.forEach((line, i) => {
    const t = line.trim()
    const heading = t.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      flush(i)
      // Render markdown headings as a bold heading line (strip the # markers).
      out.push(<p key={'h' + i} className="rich-h">{bold(heading[1].trim())}</p>)
    } else if (t.startsWith('•') || t.startsWith('- ') || t.startsWith('* ')) {
      bullets.push(<li key={'li' + i}>{bold(t.replace(/^[•\-*]\s?/, ''))}</li>)
    } else {
      flush(i)
      if (t) out.push(<p key={'p' + i} className="rich-p">{bold(line)}</p>)
    }
  })
  flush('end')
  return <div className="rich">{out}</div>
}

function bold(str) {
  const parts = String(str).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  )
}
