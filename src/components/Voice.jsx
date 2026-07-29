import { useEffect, useRef, useState } from 'react'
import { streamChat, synthesizeTTS } from '../api.js'
import { T, tr } from '../data.js'

// Strip markdown / bullets so the TTS voice doesn't read out symbols.
function forSpeech(text) {
  return String(text)
    .replace(/[*#_`>•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSR() {
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

// Pick a natural hi-IN / en-IN voice for the browser fallback.
function pickVoice(lang) {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const want = lang === 'hi' ? 'hi-IN' : 'en-IN'
  const prefs = [
    (v) => v.lang === want && /swara|neerja|female|google/i.test(v.name),
    (v) => v.lang === want,
    (v) => v.lang?.startsWith(lang === 'hi' ? 'hi' : 'en'),
  ]
  for (const p of prefs) {
    const m = voices.find(p)
    if (m) return m
  }
  return null
}

export default function Voice({ lang }) {
  const [status, setStatus] = useState('idle') // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [handsFree, setHandsFree] = useState(false)
  const supported = Boolean(getSR())

  const recRef = useRef(null)
  const audioRef = useRef(null)
  const historyRef = useRef([])
  const handsFreeRef = useRef(false)
  const lastReplyRef = useRef('')
  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])
  useEffect(() => { handsFreeRef.current = handsFree }, [handsFree])

  // Prime the speech-synthesis voice list (some browsers load it lazily).
  useEffect(() => {
    window.speechSynthesis?.getVoices?.()
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cleanup() {
    try { recRef.current?.abort?.() } catch {}
    recRef.current = null
    stopAudio()
    window.speechSynthesis?.cancel?.()
  }
  function stopAudio() {
    if (audioRef.current) {
      try { audioRef.current.pause() } catch {}
      audioRef.current = null
    }
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
    u.onend = onSpeakEnd
    u.onerror = onSpeakEnd
    window.speechSynthesis.speak(u)
  }

  async function speak(text) {
    const clean = forSpeech(text)
    lastReplyRef.current = text
    if (!clean) return onSpeakEnd()
    setStatus('speaking')
    try {
      const url = await synthesizeTTS(clean, langRef.current)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); onSpeakEnd() }
      audio.onerror = () => { URL.revokeObjectURL(url); browserSpeak(clean) }
      await audio.play()
    } catch {
      // No Azure TTS (503) or playback blocked → browser voice.
      browserSpeak(clean)
    }
  }

  async function handleUser(text) {
    const clean = text.trim()
    if (!clean) return setStatus('idle')
    setTranscript(clean)
    setReply('')
    setStatus('thinking')
    const history = [...historyRef.current, { role: 'user', content: clean }]
    historyRef.current = history
    let full = ''
    try {
      full = await streamChat(history.map((m) => ({ role: m.role, content: m.content })), (f) => setReply(f))
    } catch {
      full = tr({ en: 'Sorry, I could not respond just now. Please try again.', hi: 'क्षमा करें, अभी उत्तर नहीं दे सकी। कृपया फिर प्रयास करें।' }, langRef.current)
      setReply(full)
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
    rec.onresult = (e) => {
      let text = ''
      for (const r of e.results) text += r[0].transcript
      latest = text
      setTranscript(text.trim())
    }
    rec.onerror = () => { recRef.current = null; setStatus('idle') }
    rec.onend = () => {
      recRef.current = null
      const t = latest.trim()
      if (t) handleUser(t)
      else setStatus('idle')
    }
    recRef.current = rec
    setTranscript('')
    setReply('')
    setStatus('listening')
    try { rec.start() } catch { setStatus('idle') }
  }

  function stopListening() {
    try { recRef.current?.stop?.() } catch {}
  }

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

  function replay() {
    if (lastReplyRef.current) speak(lastReplyRef.current)
  }

  const statusText = {
    idle: tr(T.vTapToSpeak, lang),
    listening: tr(T.vListening, lang),
    thinking: tr(T.vThinking, lang),
    speaking: tr(T.vSpeaking, lang),
  }[status]

  return (
    <div className="voice">
      <div className={`avatar-stage ${status}`}>
        <span className="avatar-halo" aria-hidden />
        <div className="avatar-orb">
          <img className="avatar-img base" src="/ai-saheli-avatar.png" alt="AI Saheli avatar" />
          <img
            className={`avatar-img speak ${status === 'speaking' ? 'talking' : ''}`}
            src="/ai-saheli-avatar-speaking.png"
            alt=""
            aria-hidden
          />
        </div>
      </div>

      <div className="voice-name">{tr(T.voiceName, lang)}</div>
      <div className={`voice-status s-${status}`}>{statusText}</div>

      <div className="voice-transcript">
        {transcript && (
          <p className="v-said"><b>{tr(T.vYouSaid, lang)}:</b> {transcript}</p>
        )}
        <p className="v-reply">{reply || tr(T.voiceIntro, lang)}</p>
      </div>

      {!supported && <p className="v-unsupported">{tr(T.vUnsupported, lang)}</p>}

      <div className="voice-controls">
        <button
          className={`mic-big ${status}`}
          onClick={onMainButton}
          disabled={!supported || status === 'thinking'}
          aria-label={statusText}
        >
          {status === 'listening' ? '⏹' : status === 'speaking' ? '⏸' : '🎤'}
        </button>
      </div>

      <div className="voice-actions">
        <button className={`chip-btn ${handsFree ? 'on' : ''}`} onClick={toggleHandsFree} disabled={!supported}>
          🔁 {tr(T.vHandsFree, lang)}
        </button>
        <button className="chip-btn" onClick={replay} disabled={!lastReplyRef.current}>
          🔊 {tr(T.vReplay, lang)}
        </button>
      </div>

      <p className="voice-privacy">{tr(T.vPrivacy, lang)}</p>
    </div>
  )
}
