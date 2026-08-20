import { useEffect, useState } from 'react'
import { getHealth } from './api.js'
import { T, tr, LOCATIONS, SCHEMES } from './data.js'
import Home from './components/Home.jsx'
import Chat from './components/Chat.jsx'
import Voice from './components/Voice.jsx'
import Dashboard from './components/Dashboard.jsx'
import Audit from './components/Audit.jsx'
import Login from './components/Login.jsx'
import Overview from './components/Overview.jsx'

const AUTH_KEY = 'saheli_auth'
const OVERVIEW_PATH = /^\/(overview|showcase)\/?$/i

export default function App() {
  const [lang, setLang] = useState('hi')
  const [health, setHealth] = useState(null)
  const [seed, setSeed] = useState(null)
  const [scheme, setScheme] = useState(null) // null=generic, or 'poshan'|'vatsalya'|'shakti'
  const [loc, setLoc] = useState(() => localStorage.getItem('saheli_loc') || 'all')
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
  })
  const isOfficer = auth?.role === 'officer'
  const [tab, setTab] = useState('home')

  useEffect(() => { getHealth().then(setHealth).catch(() => setHealth({ mode: 'scripted' })) }, [])
  useEffect(() => { try { localStorage.setItem('saheli_loc', loc) } catch {} }, [loc])

  function handleLogin(a) {
    setAuth(a)
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)) } catch {}
    setTab(a.role === 'officer' ? 'dashboard' : 'home')
  }
  function handleLogout() {
    setAuth(null)
    try { localStorage.removeItem(AUTH_KEY) } catch {}
    setTab('home'); setScheme(null)
  }
  function chooseScheme(id) { setScheme(id || null); setSeed(null); setTab('chat') }

  // Standalone big-screen overview page (/overview) — no login, no phone frame.
  if (typeof window !== 'undefined' && OVERVIEW_PATH.test(window.location.pathname)) {
    return <Overview lang={lang} setLang={setLang} />
  }

  if (!auth) {
    return (
      <div className="app-bg">
        <div className="device"><div className="tricolor" /><Login lang={lang} setLang={setLang} onLogin={handleLogin} /></div>
      </div>
    )
  }

  // Normalise the active tab to one valid for the current role. Officers (govt)
  // see only Insights + Audit — no chat/assistant.
  const officerTabs = ['dashboard', 'audit']
  const citizenTabs = ['home', 'chat', 'voice']
  const view = isOfficer
    ? (officerTabs.includes(tab) ? tab : 'dashboard')
    : (citizenTabs.includes(tab) ? tab : 'home')

  return (
    <div className="app-bg">
      <div className={`device ${isOfficer ? 'device-admin' : ''}`}>
        <div className="tricolor" />
        <Header lang={lang} setLang={setLang} auth={auth} onLogout={handleLogout} isOfficer={isOfficer} />

        {!isOfficer && (view === 'chat' || view === 'voice') && (
          <ContextBar lang={lang} scheme={scheme} setScheme={setScheme} loc={loc} setLoc={setLoc} officer={isOfficer} />
        )}

        <main className="screen">
          {!isOfficer && view === 'home' && <Home lang={lang} onScheme={chooseScheme} onTalk={() => setTab('voice')} />}
          {!isOfficer && view === 'chat' && <Chat lang={lang} health={health} seed={seed} userId={auth.id} loc={loc} scheme={scheme} showCitations={false} role="citizen" />}
          {!isOfficer && view === 'voice' && <Voice lang={lang} health={health} userId={auth.id} loc={loc} scheme={scheme} role="citizen" />}

          {isOfficer && view === 'dashboard' && <Dashboard lang={lang} />}
          {isOfficer && view === 'audit' && <Audit lang={lang} />}
        </main>

        <TabBar lang={lang} tab={view} setTab={setTab} isOfficer={isOfficer} />
      </div>
    </div>
  )
}

function maskId(auth) {
  if (!auth) return ''
  if (auth.role === 'citizen') return '•••••' + String(auth.id).slice(-4)
  const [name] = String(auth.id).split('@')
  return name.length > 12 ? name.slice(0, 12) + '…' : name
}

function Header({ lang, setLang, auth, onLogout, isOfficer }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="emblem" aria-hidden>🇮🇳</div>
        <div className="brand-text">
          <div className="brand-name">{tr(T.appName, lang)}{isOfficer && <span className="admin-tag">ADMIN</span>}</div>
          <div className="brand-sub">{isOfficer ? tr(T.adminSub, lang) : tr(T.appSub, lang)}</div>
        </div>
      </div>
      <div className="header-right">
        <span className="user-chip" title={auth?.id}>
          <span aria-hidden>{isOfficer ? '🏛️' : '👩'}</span>
          <span className="user-id">{maskId(auth)}</span>
        </span>
        <a className="icon-btn" href="/overview" target="_blank" rel="noreferrer" title={tr(T.bigScreen, lang)} aria-label={tr(T.bigScreen, lang)}>🖥️</a>
        <button className="lang-toggle" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')} aria-label="Switch language">
          {lang === 'hi' ? 'EN' : 'हिं'}
        </button>
        <button className="icon-btn" onClick={onLogout} title={tr(T.logout, lang)} aria-label={tr(T.logout, lang)}>⏻</button>
      </div>
    </header>
  )
}

// Scheme + location scope selector (shown on chat/voice/assistant).
function ContextBar({ lang, scheme, setScheme, loc, setLoc, officer }) {
  return (
    <div className="ctxbar">
      <div className="ctx-schemes">
        <button className={`ctx-chip ${!scheme ? 'on' : ''}`} onClick={() => setScheme(null)}>
          {tr(T.generic, lang)}
        </button>
        {Object.values(SCHEMES).map((s) => (
          <button key={s.id} className={`ctx-chip ${scheme === s.id ? 'on' : ''}`} style={{ '--c': s.color }} onClick={() => setScheme(s.id)}>
            <span aria-hidden>{s.icon}</span> {tr(s.name, lang)}
          </button>
        ))}
      </div>
      <label className="ctx-loc">
        <span aria-hidden>📍</span>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} aria-label={tr(T.locLabel, lang)}>
          {LOCATIONS.map((l) => <option key={l.code} value={l.code}>{tr(l, lang)}</option>)}
        </select>
      </label>
    </div>
  )
}

function TabBar({ lang, tab, setTab, isOfficer }) {
  const items = isOfficer
    ? [
        { id: 'dashboard', icon: '📊', label: T.tabInsights },
        { id: 'audit', icon: '📎', label: T.tabAudit },
      ]
    : [
        { id: 'home', icon: '🏠', label: T.tabHome },
        { id: 'chat', icon: '💬', label: T.tabChat },
        { id: 'voice', icon: '🎙️', label: T.tabVoice },
      ]
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <button key={it.id} className={`tab ${tab === it.id ? 'active' : ''}`} onClick={() => setTab(it.id)}>
          <span className="tab-icon">{it.icon}</span>
          <span className="tab-label">{tr(it.label, lang)}</span>
        </button>
      ))}
    </nav>
  )
}
