import './AppLogo.css'

interface AppLogoProps {
  size?: 'sm' | 'md'
}

export default function AppLogo({ size = 'md' }: AppLogoProps) {
  return (
    <div className={`app-logo app-logo--${size}`}>
      <svg
        className="app-logo-icon"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="8" y="4" width="28" height="36" rx="4" fill="none" stroke="currentColor" strokeWidth="3"/>
        <path d="M28 4 L36 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        <path d="M28 4 L28 12 L36 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
        <line x1="14" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="14" y1="26" x2="30" y2="26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="36" cy="38" r="10" fill="none" stroke="currentColor" strokeWidth="3"/>
        <line x1="43" y1="45" x2="50" y2="52" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx="36" cy="38" r="3" fill="var(--color-accent)"/>
      </svg>
      <span className="app-logo-text">
        Career<span className="app-logo-text--light"> Lens</span>
      </span>
    </div>
  )
}
