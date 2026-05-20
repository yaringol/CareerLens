import { useState, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import ShaderBackground from '../components/ui/ShaderBackground'
import './LoginPage.css'

export default function LoginPage() {
  const { login, register } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleAction(action: 'login' | 'register') {
    if (!email.trim() || !password.trim()) {
      showToast('Email and password are required')
      return
    }
    setIsLoading(true)
    try {
      if (action === 'login') {
        await login(email.trim(), password)
      } else {
        await register(email.trim(), password)
      }
      const sessionRedirect = sessionStorage.getItem('auth_redirect')
      if (sessionRedirect) {
        sessionStorage.removeItem('auth_redirect')
        navigate(sessionRedirect, { replace: true })
      } else {
        navigate(from ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true })
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    handleAction('login')
  }

  return (
    <div className="login-page">
      <ShaderBackground />
      <div className="login-card">
        <div className="login-logo">
          <svg className="login-logo-icon" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="8" y="4" width="28" height="36" rx="4" fill="none" stroke="white" strokeWidth="3"/>
            <path d="M28 4 L36 12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            <path d="M28 4 L28 12 L36 12" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round"/>
            <line x1="14" y1="20" x2="26" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="14" y1="26" x2="30" y2="26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="36" cy="38" r="10" fill="none" stroke="white" strokeWidth="3"/>
            <line x1="43" y1="45" x2="50" y2="52" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx="36" cy="38" r="3" fill="rgba(192,132,252,0.9)"/>
          </svg>
          <span className="login-logo-text">Career<span className="login-logo-text--light">Lens</span></span>
        </div>

        <p className="login-subtitle">Score your CV against any job posting</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoComplete="current-password"
              disabled={isLoading}
              required
            />
          </div>

          <div className="login-actions">
            <button type="submit" className="btn-login" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Login'}
            </button>
            <button
              type="button"
              className="btn-register"
              onClick={() => handleAction('register')}
              disabled={isLoading}
            >
              {isLoading ? 'Creating account…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
