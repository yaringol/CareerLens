import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HalfCircleGauge, { getStrength } from '../components/ui/HalfCircleGauge'
import type { AnalyzeResponse } from '../services/api'
import './SkillsMatchDashboard.css'

const RESULT_KEY = 'pocAnalysisResult'

// ─── Stagger context (CounterProvider pattern from reference) ────────
const CounterCtx = createContext<(() => number) | null>(null)

function CounterProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef(0)
  const get = useCallback(() => ref.current++, [])
  return <CounterCtx.Provider value={get}>{children}</CounterCtx.Provider>
}

function useStaggerIndex() {
  const get = useContext(CounterCtx)
  if (!get) throw new Error('Must be inside CounterProvider')
  const idx = useRef<number | null>(null)
  if (idx.current === null) idx.current = get()
  return idx.current
}

// ─── Glass card with staggered entrance ─────────────────────────────
function ScoreCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const idx = useStaggerIndex()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300 + idx * 180)
    return () => clearTimeout(t)
  }, [idx])

  return (
    <div className={`score-card${visible ? ' score-card--visible' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ─── Skill row ───────────────────────────────────────────────────────
function SkillRow({ name, score, max, delay }: { name: string; score: number; max: number; delay: number }) {
  const [width, setWidth] = useState(0)
  const strength = getStrength(score, max)
  const pct = (score / max) * 100

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 200)
    return () => clearTimeout(t)
  }, [pct, delay])

  const LABEL: Record<string, string> = {
    strong: 'Excellent', moderate: 'Good', weak: 'Poor', none: '-',
  }
  const badgeCls: Record<string, string> = {
    strong: 'skill-badge--excellent', moderate: 'skill-badge--good',
    weak: 'skill-badge--poor', none: 'skill-badge--none',
  }

  return (
    <div className="skill-row" data-tooltip={name}>
      <div className="skill-row-header">
        <span className="skill-row-name">{name}</span>
        <div className="skill-row-right">
          <span className={`skill-badge ${badgeCls[strength]}`}>{LABEL[strength]}</span>
          <span className="skill-row-score">{score}<span className="skill-row-max">/{max}</span></span>
        </div>
      </div>
      <div className="skill-track">
        <div
          className={`skill-fill skill-fill--${strength}`}
          style={{ width: `${width}%`, transition: 'width 0.65s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
    </div>
  )
}

// ─── Main dashboard ──────────────────────────────────────────────────
const SkillsMatchDashboard = () => {
  const navigate = useNavigate()
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(RESULT_KEY)
    if (!raw) { navigate('/', { replace: true }); return }
    try { setResult(JSON.parse(raw) as AnalyzeResponse) }
    catch { setParseError('Invalid results data') }
  }, [navigate])

  const handleBack = () => {
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/')
  }

  if (parseError) return (
    <div className="dashboard-screen">
      <p className="dashboard-error">{parseError}</p>
      <button className="btn-back" onClick={handleBack}>← Back</button>
    </div>
  )

  if (!result) return (
    <div className="dashboard-screen dashboard-screen--loading">
      {[0, 1, 2].map(i => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  )

  const coreSkills    = result.skills.slice(0, 5)
  const dynamicSkills = result.skills.slice(5, 10)
  const matchPercent  = Math.round((result.matchScore / 10) * 100)

  return (
    <div className="dashboard-screen">
      {/* Nav */}
      <div className="dashboard-nav">
        <button className="btn-back" onClick={handleBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>
        <div className="step-indicator">
          <div className="step step--done">
            <div className="step-dot">✓</div>
            <span className="step-label">Upload</span>
          </div>
          <div className="step-line" />
          <div className="step step--active">
            <div className="step-dot">2</div>
            <span className="step-label">Results</span>
          </div>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Job title */}
      <h1 className="dashboard-title">{result.jobTitle}</h1>

      {/* Cards */}
      <CounterProvider>
        <div className="cards-grid">

          {/* ── Overall score card ── */}
          <ScoreCard className="score-card--main">
            <p className="card-eyebrow">Overall match</p>
            <HalfCircleGauge value={matchPercent} max={100} animate />
            <p className="card-description">
              Your CV matches <strong>{result.jobTitle}</strong> requirements
              based on <strong>10</strong> analyzed skills.
            </p>
          </ScoreCard>

          {/* ── Core skills card ── */}
          <ScoreCard>
            <p className="card-eyebrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Core Skills
            </p>
            <div className="skills-list">
              {coreSkills.map((s, i) => (
                <SkillRow key={s.name} name={s.name} score={s.score} max={10} delay={300 + i * 80} />
              ))}
            </div>
            <p className="card-hint">Based on continuously scraped job market data for this role.</p>
          </ScoreCard>

          {/* ── Dynamic skills card ── */}
          <ScoreCard>
            <p className="card-eyebrow">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Dynamic Skills
            </p>
            <div className="skills-list">
              {dynamicSkills.map((s, i) => (
                <SkillRow key={s.name} name={s.name} score={s.score} max={10} delay={500 + i * 80} />
              ))}
            </div>
            <p className="card-hint">Extracted from the job description you provided.</p>
          </ScoreCard>

        </div>

        <button className="btn-card-action btn-back-standalone" onClick={handleBack}>
          ← Try another role
        </button>
      </CounterProvider>
    </div>
  )
}

export default SkillsMatchDashboard
