import { useEffect, useRef, useState } from 'react'
import { streamChat, synthesizeTTS } from '../api.js'
import { T, tr, SCHEMES } from '../data.js'
import { loadConv, saveConv, clearConv } from '../storage.js'

// Strip markdown symbols for clean on-screen display.
function cleanDisplay(text) {
  return String(text)
    .replace(/\*\*/g, '')
    .replace(/[*_`>#]/g, '')
    .replace(/^\s*[-•]\s?/gm, '• ')
    .trim()
}

// For TTS: also drop parenthetical English glosses so a Hindi term isn't read
// twice (e.g. "मिशन वात्सल्य (Mission Vatsalya)" → "मिशन वात्सल्य").
function forSpeech(text) {
  return String(text)
    .replace(/\([^)]*[A-Za-z][^)]*\)/g, ' ') // remove (English gloss)
    .replace(/[*#_`>•]/g, ' ')
    .replace(/\s+([।.,!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const getSR = () => window.SpeechRecognition || window.webkitSpeechRecognition

function pickVoice(lang) {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const want = lang === 'hi' ? 'hi-IN' : 'en-IN'
  const prefs = [
    (v) => v.lang === want && /swara|neerja|female|google/i.test(v.name),
    (v) => v.lang === want,
    (v) => v.lang?.startsWith(lang === 'hi' ? 'hi' : 'en'),
  ]
  for (const p of prefs) { const m = voices.find(p); if (m) return m }
  return null
}

export default function Voice({ lang, health, userId }) {
  const [turns, setTurns] = useState(() => loadConv('voice', userId) || [])
  const [status, setStatus] = useState('idle') // idle | listening | thinking | speaking
  const [handsFree, setHandsFree] = useState(false)
  const supported = Boolean(getSR())

  const recRef = useRef(null)
  const audioRef = useRef(null)
  const historyRef = useRef(
    (loadConv('voice', userId) || []).map((t) => ({
      role: t.role === 'user' ? 'user' : 'assistant',
      content: t.text,
    })),
  )
  const handsFreeRef = useRef(false)
  const lastReplyRef = useRef('')
  const langRef = useRef(lang)
  const listRef = useRef(null)

  useEffect(() => { langRef.current = lang }, [lang])
  useEffect(() => { handsFreeRef.current = handsFree }, [handsFree])
  useEffect(() => { window.speechSynthesis?.getVoices?.(); return () => cleanup() }, []) // eslint-disable-line
  useEffect(() => {
    if (turns.length) saveConv('voice', userId, turns)
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, status, userId])

  // Suggested follow-up questions (from the backend starters).
  const suggestions = (() => {
    const s = health?.starters
    if (!s) return []
    return Object.keys(SCHEMES)
      .map((k) => (s[k]?.[0] ? { icon: SCHEMES[k].icon, color: SCHEMES[k].color, text: s[k][0][lang] || s[k][0].en } : null))
      .filter(Boolean)
  })()

  function cleanup() {
    try { recRef.current?.abort?.() } catch {}
    recRef.current = null
    stopAudio()
    window.speechSynthesis?.cancel?.()
  }
  function stopAudio() {
    if (audioRef.current) { try { audioRef.current.pause() } catch {}; audioRef.current = null }
  }

  function onSpeakEnd() {
    setStatus('idle')
    if (handsFreeRef.current) setTimeout(() => startListening(), 350)
  }

  function browserSpeak(text) {
    if (!window.speechSynthesis) return onSpeakEnd()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice(langRef.current)
    if (v) u.voice = v
    u.lang = langRef.current === 'hi' ? 'hi-IN' : 'en-IN'
    u.rate = 0.98
    u.onstart = () => setStatus('speaking') // lip-sync starts with actual audio
    u.onend = onSpeakEnd
    u.onerror = onSpeakEnd
    window.speechSynthesis.speak(u)
  }

  async function speak(text) {
    const spoken = forSpeech(text)
    lastReplyRef.current = text
    if (!spoken) return onSpeakEnd()
    // Keep the "thinking" state while TTS audio is being prepared; only switch
    // to the speaking (mouth-moving) state once audio actually begins.
    try {
      const url = await synthesizeTTS(spoken, langRef.current)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplaying = () => setStatus('speaking')
      audio.onended = () => { URL.revokeObjectURL(url); onSpeakEnd() }
      audio.onerror = () => { URL.revokeObjectURL(url); browserSpeak(spoken) }
      await audio.play()
    } catch {
      browserSpeak(spoken)
    }
  }

  async function ask(text) {
    const clean = String(text || '').trim()
    if (!clean || status === 'thinking') return
    cleanup()
    setStatus('thinking')
    const history = [...historyRef.current, { role: 'user', content: clean }]
    historyRef.current = history
    setTurns((t) => [...t, { role: 'user', text: clean }, { role: 'saheli', text: '', pending: true }])

    let full = ''
    try {
      full = await streamChat(
        history.map((m) => ({ role: m.role, content: m.content })),
        (f) => setTurns((t) => {
          const copy = [...t]
          copy[copy.length - 1] = { role: 'saheli', text: cleanDisplay(f) }
          return copy
        }),
        undefined,
        { channel: 'voice' },
      )
    } catch {
      full = tr({ en: 'Sorry, I could not respond just now. Please try again.', hi: 'क्षमा करें, अभी उत्तर नहीं दे सकी। कृपया फिर प्रयास करें।' }, langRef.current)
      setTurns((t) => { const c = [...t]; c[c.length - 1] = { role: 'saheli', text: full }; return c })
    }
    historyRef.current = [...history, { role: 'assistant', content: full }]
    speak(full)
  }

  function startListening() {
    const SR = getSR()
    if (!SR) return
    cleanup()
    const rec = new SR()
    rec.lang = langRef.current === 'hi' ? 'hi-IN' : 'en-IN'
    rec.interimResults = true
    rec.continuous = false
    let latest = ''
    rec.onresult = (e) => { latest = Array.from(e.results).map((r) => r[0].transcript).join('') }
    rec.onerror = () => { recRef.current = null; setStatus('idle') }
    rec.onend = () => {
      recRef.current = null
      const t = latest.trim()
      if (t) ask(t); else setStatus('idle')
    }
    recRef.current = rec
    setStatus('listening')
    try { rec.start() } catch { setStatus('idle') }
  }

  function stopListening() { try { recRef.current?.stop?.() } catch {} }

  function onMainButton() {
    if (!supported) return
    if (status === 'listening') return stopListening()
    if (status === 'speaking') { cleanup(); return setStatus('idle') }
    if (status === 'thinking') return
    startListening()
  }

  function toggleHandsFree() {
    const next = !handsFree
    setHandsFree(next)
    if (next && status === 'idle') startListening()
  }

  function replay() { if (lastReplyRef.current) speak(lastReplyRef.current) }

  function clearHistory() {
    cleanup()
    historyRef.current = []
    setTurns([])
    clearConv('voice', userId)
    setStatus('idle')
  }

  const statusText = {
    idle: tr(T.vTapToSpeak, lang),
    listening: tr(T.vListening, lang),
    thinking: tr(T.vThinking, lang),
    speaking: tr(T.vSpeaking, lang),
  }[status]

  return (
    <div className="voice">
      <div className="voice-top">
        <div className={`avatar-stage ${status}`}>
          <span className="avatar-glow" aria-hidden />
          <div className="avatar-orb">
            <img className="avatar-img base" src="/ai-saheli-avatar.png" alt="AI Saheli avatar" />
            <img className={`avatar-img speak ${status === 'speaking' ? 'talking' : ''}`} src="/ai-saheli-avatar-speaking.png" alt="" aria-hidden />
          </div>
        </div>
        <div className="voice-meta">
          <div className="voice-name">{tr(T.voiceName, lang)}</div>
          <div className={`voice-status s-${status}`}>{statusText}</div>
        </div>
        {turns.length > 0 && (
          <button className="voice-clear" onClick={clearHistory} title={tr(T.vClear, lang)} aria-label={tr(T.vClear, lang)}>🗑</button>
        )}
      </div>

      <div className="voice-thread" ref={listRef}>
        {turns.length === 0 && (
          <div className="v-intro">{tr(T.voiceIntro, lang)}</div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`v-turn ${t.role}`}>
            {t.role === 'saheli' && t.pending && !t.text ? <span className="v-typing"><span /><span /><span /></span> : t.text}
          </div>
        ))}

        {status === 'idle' && suggestions.length > 0 && (
          <div className="v-suggest">
            <div className="v-suggest-label">{tr(T.vAskMore, lang)}</div>
            {suggestions.map((s, i) => (
              <button key={i} className="v-chip" style={{ '--c': s.color }} onClick={() => ask(s.text)}>
                <span aria-hidden>{s.icon}</span> {s.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {!supported && <p className="v-unsupported">{tr(T.vUnsupported, lang)}</p>}

      <div className="voice-dock">
        <button className={`chip-btn ${handsFree ? 'on' : ''}`} onClick={toggleHandsFree} disabled={!supported}>🔁 {tr(T.vHandsFree, lang)}</button>
        <button className={`mic-big ${status}`} onClick={onMainButton} disabled={!supported || status === 'thinking'} aria-label={statusText}>
          {status === 'listening' ? '⏹' : status === 'speaking' ? '⏸' : '🎤'}
        </button>
        <button className="chip-btn" onClick={replay} disabled={!lastReplyRef.current}>🔊 {tr(T.vReplay, lang)}</button>
      </div>
      <p className="voice-privacy">{tr(T.vPrivacy, lang)}</p>
    </div>
  )
}
