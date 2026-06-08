import { useEffect } from 'react'
import { useError } from '../../context/ErrorContext'
import './ErrorToast.css'

const AUTO_DISMISS_MS = 8000

const ErrorToast = () => {
  const { error, clearError } = useError()

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => clearError(), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [error, clearError])

  if (!error) return null

  return (
    <div className="error-toast" role="alert" aria-live="assertive">
      <div className="error-toast__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="error-toast__body">
        <p className="error-toast__title">Something went wrong</p>
        <p className="error-toast__message">{error.message}</p>
      </div>
      <button
        type="button"
        className="error-toast__close"
        onClick={clearError}
        aria-label="Dismiss error"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

export default ErrorToast
