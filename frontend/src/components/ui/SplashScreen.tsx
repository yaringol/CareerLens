import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onDone: () => void
}

const SplashScreen = ({ onDone }: SplashScreenProps) => {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')

  useEffect(() => {
    // Hold splash for 2.2s then exit
    const exitTimer = setTimeout(() => setPhase('exit'), 2200)
    // Notify parent after exit animation completes (400ms)
    const doneTimer = setTimeout(() => onDone(), 2600)
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div className={`splash${phase === 'exit' ? ' splash--exit' : ''}`} aria-hidden="true">
      <div className="splash-content">

        {/* Animated icon */}
        <div className="splash-icon">
          <svg
            viewBox="0 0 80 90"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="splash-svg"
          >
            <defs>
              <linearGradient id="sp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b7cf6" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>

            {/* Document body */}
            <path
              className="sp-doc"
              d="M10 8 C10 5 12 3 15 3 L48 3 L65 20 L65 82 C65 85 63 87 60 87 L15 87 C12 87 10 85 10 82 Z"
              stroke="#1e1b6e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Document fold */}
            <path
              className="sp-fold"
              d="M48 3 L48 20 L65 20"
              stroke="#1e1b6e"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Document lines */}
            <line className="sp-line sp-line-1" x1="20" y1="35" x2="55" y2="35" stroke="#1e1b6e" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
            <line className="sp-line sp-line-2" x1="20" y1="44" x2="55" y2="44" stroke="#1e1b6e" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
            <line className="sp-line sp-line-3" x1="20" y1="53" x2="42" y2="53" stroke="#1e1b6e" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />

            {/* Magnifying glass circle */}
            <circle
              className="sp-lens"
              cx="50" cy="56" r="18"
              stroke="url(#sp-grad)"
              strokeWidth="3"
              fill="rgba(139,124,246,0.08)"
            />
            {/* Lens handle */}
            <line
              className="sp-handle"
              x1="63" y1="69" x2="73" y2="79"
              stroke="#1e1b6e"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Chart bars inside lens */}
            <rect className="sp-bar sp-bar-1" x="38" y="57" width="5" height="9"  rx="1.5" fill="url(#sp-grad)" />
            <rect className="sp-bar sp-bar-2" x="46" y="52" width="5" height="14" rx="1.5" fill="url(#sp-grad)" />
            <rect className="sp-bar sp-bar-3" x="54" y="47" width="5" height="19" rx="1.5" fill="url(#sp-grad)" />

            {/* Arrow */}
            <polyline
              className="sp-arrow"
              points="54,47 59,41 64,47"
              stroke="url(#sp-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="splash-wordmark">
          <span className="splash-career">Career</span>
          <span className="splash-lens">Lens</span>
        </div>

        {/* Tagline */}
        <p className="splash-tagline">Data-driven skill insights</p>

        {/* Progress bar */}
        <div className="splash-progress">
          <div className="splash-progress-fill" />
        </div>
      </div>
    </div>
  )
}

export default SplashScreen
