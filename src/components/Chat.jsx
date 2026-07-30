import { useEffect, useRef, useState } from 'react'
import { streamChat } from '../api.js'
import { T, tr, SCHEMES } from '../data.js'
import { loadConv, saveConv } from '../storage.js'

export default function Chat({ lang, health, seed, userId }) {
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
      await streamChat(
        next.map(({ role, content }) => ({ role, content })),
        (full) => {
          setMessages((cur) => {
            const copy = [...cur]
            copy[copy.length - 1] = { role: 'assistant', content: full }
            return copy
          })
        },
      )
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
          <Bubble key={i} role={m.role} content={m.content} pending={m.pending && !m.content} lang={lang} />
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

function Bubble({ role, content, pending, lang }) {
  const isUser = role === 'user'
  return (
    <div className={`bubble-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && <div className="bot-avatar" aria-hidden>🤝</div>}
      <div className={`bubble ${isUser ? 'user' : 'bot'}`}>
        {pending ? <Typing /> : <Rich text={content} />}
      </div>
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
