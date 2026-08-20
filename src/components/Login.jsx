import { useState } from 'react'
import { T, tr, SCHEMES } from '../data.js'

// Shown at login: the three programmes this assistant covers, in order.
const COVERS = ['shakti', 'vatsalya', 'poshan']

// Demo-only login. No real auth backend — citizens sign in with a mobile number
// + (simulated) OTP, ministry/officers with an official email + password.
export default function Login({ lang, setLang, onLogin }) {
  const [role, setRole] = useState('citizen')
  const [mobile, setMobile] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const validMobile = /^[6-9]\d{9}$/.test(mobile)
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  function switchRole(r) {
    setRole(r)
    setErr('')
    setOtpSent(false)
    setOtp('')
  }

  function sendOtp() {
    if (!validMobile) return setErr(tr(T.errMobile, lang))
    setErr('')
    setOtpSent(true)
  }

  function submit(e) {
    e.preventDefault()
    if (role === 'citizen') {
      if (!validMobile) return setErr(tr(T.errMobile, lang))
      if (!otpSent) return sendOtp()
      if (!/^\d{4,6}$/.test(otp)) return setErr(tr(T.errOtp, lang))
      onLogin({ role: 'citizen', id: mobile })
    } else {
      if (!validEmail) return setErr(tr(T.errEmail, lang))
      if (!password.trim()) return setErr(tr(T.errPassword, lang))
      onLogin({ role: 'officer', id: email })
    }
  }

  return (
    <div className="login">
      <button
        className="login-lang"
        onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        aria-label="Switch language"
      >
        {lang === 'hi' ? 'EN' : 'हिं'}
      </button>

      <div className="login-hero">
        <div className="login-emblem" aria-hidden>🤝</div>
        <h1 className="login-name">{tr(T.appName, lang)}</h1>
        <div className="login-flag" aria-hidden>🇮🇳</div>
        <p className="login-ministry">{tr(T.appSub, lang)}</p>
        <p className="login-tagline">{tr(T.loginTagline, lang)}</p>

        <div className="login-covers">
          <div className="covers-label">{tr(T.coversLabel, lang)}</div>
          <div className="covers-list">
            {COVERS.map((id, i) => (
              <span className="cover-chip" key={id} style={{ '--c': SCHEMES[id].color }}>
                <span className="cover-num">{i + 1}</span>
                <span aria-hidden>{SCHEMES[id].icon}</span> {tr(SCHEMES[id].name, lang)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="login-card">
        <div className="role-switch" role="tablist">
          <button
            className={`role-btn ${role === 'citizen' ? 'on' : ''}`}
            onClick={() => switchRole('citizen')}
          >
            👩 {tr(T.roleCitizen, lang)}
          </button>
          <button
            className={`role-btn ${role === 'officer' ? 'on' : ''}`}
            onClick={() => switchRole('officer')}
          >
            🏛️ {tr(T.roleOfficer, lang)}
          </button>
        </div>

        <form onSubmit={submit} className="login-form">
          {role === 'citizen' ? (
            <>
              <label className="field-label">{tr(T.mobileLabel, lang)}</label>
              <div className="mobile-input">
                <span className="cc">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={mobile}
                  placeholder={tr(T.mobilePlaceholder, lang)}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  disabled={otpSent}
                />
              </div>

              {otpSent && (
                <>
                  <div className="otp-sent">
                    {tr(T.otpSentTo, lang)} +91 {mobile}
                    <button type="button" className="link" onClick={() => setOtpSent(false)}>
                      {tr(T.changeNumber, lang)}
                    </button>
                  </div>
                  <label className="field-label">{tr(T.otpLabel, lang)}</label>
                  <input
                    className="text-input otp-field"
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    placeholder={tr(T.otpPlaceholder, lang)}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                  <p className="demo-hint">🔑 {tr(T.demoOtpHint, lang)}</p>
                </>
              )}

              {err && <p className="login-err">{err}</p>}
              <button className="login-submit" type="submit">
                {otpSent ? tr(T.verify, lang) : tr(T.getOtp, lang)}
              </button>
            </>
          ) : (
            <>
              <label className="field-label">{tr(T.emailLabel, lang)}</label>
              <input
                className="text-input"
                type="email"
                value={email}
                placeholder={tr(T.emailPlaceholder, lang)}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="field-label">{tr(T.passwordLabel, lang)}</label>
              <input
                className="text-input"
                type="password"
                value={password}
                placeholder={tr(T.passwordPlaceholder, lang)}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="demo-hint">🔑 {tr(T.demoOfficerHint, lang)}</p>
              {err && <p className="login-err">{err}</p>}
              <button className="login-submit" type="submit">
                {tr(T.signIn, lang)}
              </button>
            </>
          )}
        </form>
        <p className="login-consent">{tr(T.consent, lang)}</p>
      </div>

      <a className="login-bigscreen" href="/overview" target="_blank" rel="noreferrer">
        🖥️ {tr(T.bigScreen, lang)} →
      </a>
    </div>
  )
}
