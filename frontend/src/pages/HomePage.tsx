import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ShaderBackground from '../components/ui/ShaderBackground'
import CvUploadSection from '../components/upload/CvUploadSection'
import AdminNavLink from '../components/admin/AdminNavLink'
import './HomePage.css'

const HomePage = () => {
  const navigate = useNavigate()
  const uploadRef = useRef<HTMLElement>(null)
  const { logout, user } = useAuth()
  const [uploadVisible, setUploadVisible] = useState(false)

  useEffect(() => {
    const el = uploadRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setUploadVisible(true) },
      { threshold: 0.08 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scrollToUpload = () => {
    setUploadVisible(true)
    requestAnimationFrame(() => {
      uploadRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  return (
    <div className="home-page">
      {/* ── Hero section ────────────────────────────────────────── */}
      <section className="hero">
        <ShaderBackground />

        <div className="hero-content">
          <div className="hero-badge">Data-Science-Powered CV Analysis</div>
          <div className="hero-logo">
            <svg className="hero-logo-icon" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="8" y="4" width="28" height="36" rx="4" fill="none" stroke="white" strokeWidth="3"/>
              <path d="M28 4 L36 12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M28 4 L28 12 L36 12" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round"/>
              <line x1="14" y1="20" x2="26" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="14" y1="26" x2="30" y2="26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="36" cy="38" r="10" fill="none" stroke="white" strokeWidth="3"/>
              <line x1="43" y1="45" x2="50" y2="52" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              <circle cx="36" cy="38" r="3" fill="rgba(192,132,252,0.9)"/>
            </svg>
            <span className="hero-logo-text">Career<span className="hero-logo-text--light"> Lens</span></span>
          </div>

          <h1 className="hero-headline">Does your CV match today's job market?</h1>
          <p className="hero-subheadline">
            CareerLens uses a data-science model to extract the key skills from any job posting{' '}
            <br />and score your CV against them, so you know exactly what to improve.
          </p>

          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={scrollToUpload}>
              Start Analyzing
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
            </button>
            <Link to="/account" className="btn-hero-logout">My Account</Link>
            <AdminNavLink className="btn-hero-logout btn-hero-admin" />
            <button className="btn-hero-logout" onClick={() => { logout(); navigate('/login') }} title="Sign out">Sign out</button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">5</span>
              <span className="hero-stat-label">Core Skills</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">5</span>
              <span className="hero-stat-label">Dynamic Skills</span>
            </div>
          </div>

          {user && (
            <p className="hero-welcome">Signed in as <strong>{user.email}</strong></p>
          )}
        </div>

        <button className="scroll-indicator" onClick={scrollToUpload} aria-label="Analyze your CV">
          <span className="scroll-indicator-text">Analyze your CV</span>
          <div className="scroll-chevron">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="hiw-steps">
          <div className="hiw-step">
            <div className="hiw-step-num">1</div>
            <div className="hiw-step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 className="hiw-step-title">Upload CV</h3>
            <p className="hiw-step-desc">Drop your CV PDF. We extract the text and build your skill profile.</p>
          </div>
          <div className="hiw-connector">→</div>
          <div className="hiw-step">
            <div className="hiw-step-num">2</div>
            <div className="hiw-step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            </div>
            <h3 className="hiw-step-title">Paste Job Posting</h3>
            <p className="hiw-step-desc">Copy the full job description from LinkedIn or any company site and paste it.</p>
          </div>
          <div className="hiw-connector">→</div>
          <div className="hiw-step">
            <div className="hiw-step-num">3</div>
            <div className="hiw-step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3 className="hiw-step-title">Get Score</h3>
            <p className="hiw-step-desc">See your Match Score per skill and know exactly what to add to your CV.</p>
          </div>
        </div>
      </section>

      {/* ── Why CareerLens ─────────────────────────────────────── */}
      <section className="why-careerlens">
        <h2 className="section-title">Why CareerLens</h2>
        <div className="why-grid">
          <div className="why-card">
            <div className="why-pain">Sending dozens of applications with no responses?</div>
            <div className="why-solution">CareerLens shows you the skill gaps recruiters see before you apply.</div>
          </div>
          <div className="why-card">
            <div className="why-pain">Generic feedback from resume tools that ignore the actual job?</div>
            <div className="why-solution">We score your CV against the specific posting you want, not a generic template.</div>
          </div>
          <div className="why-card">
            <div className="why-pain">Not sure which skills to highlight or add?</div>
            <div className="why-solution">Get a per-skill breakdown so you can prioritize exactly what to improve.</div>
          </div>
        </div>
      </section>

      <CvUploadSection ref={uploadRef} visible={uploadVisible} />
    </div>
  )
}

export default HomePage
