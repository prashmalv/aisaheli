import { useEffect, useState } from 'react'
import { getHealth } from './api.js'
import { T, tr, LOCATIONS } from './data.js'
import Home from './components/Home.jsx'
import Chat from './components/Chat.jsx'
import Voice from './components/Voice.jsx'
import Dashboard from './components/Dashboard.jsx'
import Login from './components/Login.jsx'

const AUTH_KEY = 'saheli_auth'

export default function App() {
  const [lang, setLang] = useState('hi')
  const [tab, setTab] = useState('home')
  const [health, setHealth] = useState(null)
  const [seed, setSeed] = useState(null) // a question to seed the chat with
  const [loc, setLoc] = useState(() => localStorage.getItem('saheli_loc') || 'delhi')
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
  })

  useEffect(() => { try { localStorage.setItem('saheli_loc', loc) } catch {} }, [loc])

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ mode: 'scripted' }))
  }, [])

  function handleLogin(a) {
    setAuth(a)
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)) } catch {}
    setTab(a.role === 'officer' ? 'dashboard' : 'home')
  }

  function handleLogout() {
    setAuth(null)
    try { localStorage.removeItem(AUTH_KEY) } catch {}
    setTab('home')
  }

  function openChat(question) {
    setSeed(question ? { q: question, at: Date.now() } : null)
    setTab('chat')
  }

  return (
    <div className="app-bg">
      <div className="device">
        <div className="tricolor" />
        {!auth ? (
          <Login lang={lang} setLang={setLang} onLogin={handleLogin} />
        ) : (
          <>
            <Header lang={lang} setLang={setLang} auth={auth} onLogout={handleLogout} />
            {tab !== 'dashboard' && <LocationBar lang={lang} loc={loc} setLoc={setLoc} />}
            <main className="screen">
              {tab === 'home' && <Home lang={lang} onAsk={openChat} onTalk={() => setTab('voice')} />}
              {tab === 'chat' && <Chat lang={lang} health={health} seed={seed} userId={auth.id} loc={loc} />}
              {tab === 'voice' && <Voice lang={lang} health={health} userId={auth.id} loc={loc} />}
              {tab === 'dashboard' && <Dashboard lang={lang} />}
            </main>
            <TabBar lang={lang} tab={tab} setTab={setTab} />
          </>
        )}
      </div>
    </div>
  )
}

function maskId(auth) {
  if (!auth) return ''
  if (auth.role === 'citizen') return '•••••' + String(auth.id).slice(-4)
  const [name] = String(auth.id).split('@')
  return name.length > 10 ? name.slice(0, 10) + '…' : name
}

function Header({ lang, setLang, auth, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="emblem" aria-hidden>🇮🇳</div>
        <div className="brand-text">
          <div className="brand-name">{tr(T.appName, lang)}</div>
          <div className="brand-sub">{tr(T.appSub, lang)}</div>
        </div>
      </div>
      <div className="header-right">
        <span className="user-chip" title={auth?.id}>
          <span aria-hidden>{auth?.role === 'officer' ? '🏛️' : '👩'}</span>
          <span className="user-id">{maskId(auth)}</span>
        </span>
        <button
          className="lang-toggle"
          onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
          aria-label="Switch language"
        >
          {lang === 'hi' ? 'EN' : 'हिं'}
        </button>
        <button className="icon-btn" onClick={onLogout} title={tr(T.logout, lang)} aria-label={tr(T.logout, lang)}>
          ⏻
        </button>
      </div>
    </header>
  )
}

function LocationBar({ lang, loc, setLoc }) {
  return (
    <div className="locbar">
      <label className="locbar-loc">
        <span aria-hidden>📍</span>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} aria-label={tr(T.locLabel, lang)}>
          {LOCATIONS.map((l) => (
            <option key={l.code} value={l.code}>{tr(l, lang)}</option>
          ))}
        </select>
      </label>
      <span className="locbar-badge" title={tr(T.verifiedBadge, lang)}>
        ✅ {tr(T.verifiedBadge, lang)}
      </span>
    </div>
  )
}

function TabBar({ lang, tab, setTab }) {
  const items = [
    { id: 'home', icon: '🏠', label: T.tabHome },
    { id: 'chat', icon: '💬', label: T.tabChat },
    { id: 'voice', icon: '🎙️', label: T.tabVoice },
    { id: 'dashboard', icon: '📊', label: T.tabDash },
  ]
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <button
          key={it.id}
          className={`tab ${tab === it.id ? 'active' : ''}`}
          onClick={() => setTab(it.id)}
        >
          <span className="tab-icon">{it.icon}</span>
          <span className="tab-label">{tr(it.label, lang)}</span>
        </button>
      ))}
    </nav>
  )
}
