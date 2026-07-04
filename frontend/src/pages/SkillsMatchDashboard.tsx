import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import HalfCircleGauge, { getStrength } from '../components/ui/HalfCircleGauge'
import AppLogo from '../components/ui/AppLogo'
import AdminNavLink from '../components/admin/AdminNavLink'
import { useError } from '../context/ErrorContext'
import type { AnalyzeResponse, CompareSavedResponse } from '../services/api'
import { getCvText } from '../services/api'
import './SkillsMatchDashboard.css'


const RESULT_KEY = 'analysisResult'
const CV_FILENAME_KEY = 'cvFileName'

type StoredAnalysisResult = AnalyzeResponse & {
  cvText?: string
  cvFileName?: string
  bestSavedCv?: CompareSavedResponse['bestSavedCv']
}

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
    // RAF ensures width=0 is painted before we schedule the fill animation;
    // without it React may batch the 0→pct update into the same frame and
    // the CSS transition never fires.
    let raf: number
    let timer: ReturnType<typeof setTimeout>
    raf = requestAnimationFrame(() => {
      timer = setTimeout(() => setWidth(pct), delay)
    })
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
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

// ─── Mock data for instant preview ───────────────────────────────────
// Usage: /dashboard?mock=<key>
// Keys and their purpose are listed below for easy browsing.
type MockEntry = Omit<AnalyzeResponse, 'id'>

const SKILLS_SE = ['Backend Development', 'Cloud Infrastructure', 'Python', 'Programming', 'Linux',
                   'REST and API Design', 'Relational Database Modeling', 'Unit & Integration Testing',
                   'Observability & Logging', 'Secure Coding Awareness']

const SKILLS_DS = ['Machine Learning', 'Statistical Analysis', 'Python', 'Data Visualization',
                   'SQL & Databases', 'Feature Engineering', 'Model Evaluation', 'Deep Learning',
                   'Data Wrangling', 'Experiment Design']

const SKILLS_DEVOPS = ['CI/CD Pipelines', 'Kubernetes & Docker', 'Infrastructure as Code', 'Cloud Platforms (AWS/GCP)',
                       'Linux Administration', 'Monitoring & Alerting', 'Networking & Security',
                       'Shell Scripting', 'Database Operations', 'Incident Response']

const SKILLS_PM = ['Product Strategy', 'Stakeholder Management', 'Data-Driven Decision Making', 'Roadmap Planning',
                   'User Research & UX', 'Agile / Scrum', 'Cross-Functional Collaboration',
                   'KPI Definition', 'Go-to-Market Execution', 'Competitive Analysis']

const SKILLS_FE = ['React / Component Architecture', 'TypeScript', 'CSS & Responsive Design', 'Performance Optimization',
                   'Accessibility (WCAG)', 'State Management', 'Browser APIs & Web Standards',
                   'Testing (Jest / Cypress)', 'Build Tooling (Vite / Webpack)', 'Design System Implementation']

const SKILLS_ML = ['Model Training & Fine-Tuning', 'PyTorch / TensorFlow', 'MLOps & Model Serving',
                   'Data Pipeline Engineering', 'Experiment Tracking', 'NLP & Transformers',
                   'Computer Vision', 'Hyperparameter Optimization', 'Evaluation Metrics & Benchmarks',
                   'Research Paper Implementation']

const SKILLS_QA = ['Test Planning & Strategy', 'Manual Testing', 'Automated Testing (Selenium / Playwright)',
                   'API Testing (Postman / REST)', 'Performance & Load Testing', 'Bug Reporting & Triage',
                   'CI/CD Integration', 'Mobile Testing', 'Security Testing Basics', 'Test Coverage Analysis']

const SKILLS_LEAD = ['Technical Architecture Decisions', 'Code Review & Mentorship', 'Cross-Team Coordination',
                     'Incident Management', 'Roadmap Contribution', 'Hiring & Onboarding',
                     'System Design', 'Engineering Metrics & OKRs', 'Vendor & Tool Evaluation',
                     'Documentation & ADRs']

const MOCK_DATA: Record<string, MockEntry> = {
  // ── Baseline SE levels ──────────────────────────────────────────────
  // Test: score distribution correctness per level
  weak: {
    jobTitle: 'Software Engineer',
    matchScore: 1.1,
    skills: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  mid: {
    jobTitle: 'Software Engineer',
    matchScore: 5.5,
    skills: [6, 4, 7, 6, 4, 7, 6, 5, 3, 4].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  strong: {
    jobTitle: 'Software Engineer',
    matchScore: 8.5,
    skills: [9, 8, 10, 9, 8, 10, 8, 9, 7, 8].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },

  // ── Gauge edge cases ────────────────────────────────────────────────
  // Test: gauge renders correctly at 100% (full circle, green)
  perfect: {
    jobTitle: 'Software Engineer',
    matchScore: 10,
    skills: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: gauge renders correctly at 0% (empty circle, all bars absent)
  zero: {
    jobTitle: 'Software Engineer',
    matchScore: 0,
    skills: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: gauge at exactly 50%, all three badge types visible in one view
  mixed: {
    jobTitle: 'Software Engineer',
    matchScore: 5.0,
    skills: [10, 0, 9, 1, 8, 2, 7, 3, 6, 4].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },

  // ── Different job roles ─────────────────────────────────────────────
  // Test: Data Scientist role with DS-specific skill names
  'data-scientist': {
    jobTitle: 'Data Scientist',
    matchScore: 6.8,
    skills: [8, 7, 9, 6, 7, 5, 8, 4, 7, 6].map((score, i) => ({ name: SKILLS_DS[i], score })),
  },
  // Test: DevOps role — longer skill names, ops terminology
  devops: {
    jobTitle: 'DevOps Engineer',
    matchScore: 3.9,
    skills: [5, 3, 4, 3, 6, 2, 4, 5, 3, 4].map((score, i) => ({ name: SKILLS_DEVOPS[i], score })),
  },
  // Test: Product Manager role — non-technical skills
  'product-manager': {
    jobTitle: 'Product Manager',
    matchScore: 7.2,
    skills: [8, 7, 6, 9, 7, 8, 6, 7, 8, 6].map((score, i) => ({ name: SKILLS_PM[i], score })),
  },

  // ── Text overflow ───────────────────────────────────────────────────
  // Test: very long job title doesn't break the header layout
  'long-title': {
    jobTitle: 'Senior Full-Stack Software Engineer — Platform & Infrastructure (Remote, EMEA)',
    matchScore: 6.1,
    skills: [7, 5, 8, 6, 5, 7, 6, 5, 4, 6].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: long skill names don't overflow the skill row
  'long-skills': {
    jobTitle: 'Software Engineer',
    matchScore: 5.3,
    skills: [
      { name: 'Distributed Systems & Microservices Architecture', score: 7 },
      { name: 'Cloud-Native Development (AWS / GCP / Azure)', score: 5 },
      { name: 'Asynchronous & Event-Driven Programming', score: 8 },
      { name: 'Infrastructure as Code (Terraform / Pulumi)', score: 4 },
      { name: 'Observability, Tracing & Structured Logging', score: 6 },
      { name: 'GraphQL API Design & Federation', score: 3 },
      { name: 'End-to-End & Contract Testing Strategies', score: 7 },
      { name: 'Zero-Downtime Deployment Pipelines', score: 5 },
      { name: 'Database Performance Tuning & Query Optimization', score: 6 },
      { name: 'Security-by-Design & OWASP Compliance', score: 4 },
    ],
  },

  // ── More roles ──────────────────────────────────────────────────────
  // Test: Frontend Developer — UI/CSS skill names, strong profile
  'frontend-dev': {
    jobTitle: 'Frontend Developer',
    matchScore: 7.6,
    skills: [9, 8, 7, 8, 6, 7, 8, 6, 7, 8].map((score, i) => ({ name: SKILLS_FE[i], score })),
  },
  // Test: ML Engineer — research-heavy terminology, mid-level
  'ml-engineer': {
    jobTitle: 'ML Engineer',
    matchScore: 4.7,
    skills: [6, 5, 4, 7, 4, 3, 2, 5, 6, 4].map((score, i) => ({ name: SKILLS_ML[i], score })),
  },
  // Test: QA Engineer — testing-specific skills, weak profile
  'qa-engineer': {
    jobTitle: 'QA Engineer',
    matchScore: 2.3,
    skills: [3, 2, 2, 3, 1, 3, 2, 2, 1, 3].map((score, i) => ({ name: SKILLS_QA[i], score })),
  },
  // Test: Tech Lead — management + technical mix, strong profile
  'tech-lead': {
    jobTitle: 'Tech Lead',
    matchScore: 8.1,
    skills: [9, 8, 9, 7, 8, 9, 8, 7, 8, 9].map((score, i) => ({ name: SKILLS_LEAD[i], score })),
  },

  // ── Score patterns ──────────────────────────────────────────────────
  // Test: staircase descending — 10 down to 1, checks every bar width renders correctly
  descending: {
    jobTitle: 'Software Engineer',
    matchScore: 5.5,
    skills: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: staircase ascending — 1 up to 10, reverse of above
  ascending: {
    jobTitle: 'Software Engineer',
    matchScore: 5.5,
    skills: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: all skills exactly 5 — everything moderate, no badge variety
  'all-moderate': {
    jobTitle: 'Software Engineer',
    matchScore: 5.0,
    skills: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: core card full (excellent), dynamic card empty (0) — split scenario
  'core-strong-dynamic-zero': {
    jobTitle: 'Software Engineer',
    matchScore: 5.0,
    skills: [10, 9, 10, 9, 10, 0, 0, 0, 0, 0].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: core card empty (0), dynamic card full — reverse split
  'core-zero-dynamic-strong': {
    jobTitle: 'Software Engineer',
    matchScore: 5.0,
    skills: [0, 0, 0, 0, 0, 10, 9, 10, 9, 10].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },

  // ── Structural edge cases ───────────────────────────────────────────
  // Test: only 1 skill — core card has 1 row, dynamic card is empty
  'one-skill': {
    jobTitle: 'Software Engineer',
    matchScore: 7.0,
    skills: [{ name: 'Backend Development', score: 7 }],
  },
  // Test: exactly 5 skills — core card full, dynamic card completely empty
  'only-core': {
    jobTitle: 'Software Engineer',
    matchScore: 6.0,
    skills: [8, 7, 6, 5, 4].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: 3 skills — sparse core card, empty dynamic card
  'few-skills': {
    jobTitle: 'Software Engineer',
    matchScore: 4.0,
    skills: [{ name: 'Backend Development', score: 5 }, { name: 'Python', score: 4 }, { name: 'Linux', score: 3 }],
  },

  // ── Realistic career scenarios ──────────────────────────────────────
  // Test: career changer — all skills 1-3, realistic mismatch
  'career-change': {
    jobTitle: 'Software Engineer',
    matchScore: 1.8,
    skills: [2, 1, 3, 2, 1, 2, 1, 2, 1, 3].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: almost perfect — one gap skill, tests near-miss visual
  'one-gap': {
    jobTitle: 'Software Engineer',
    matchScore: 8.7,
    skills: [10, 10, 10, 10, 10, 10, 10, 10, 10, 1].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },
  // Test: exactly 2 skills strong, rest terrible — spiky profile
  'spiky': {
    jobTitle: 'Software Engineer',
    matchScore: 2.4,
    skills: [10, 1, 10, 1, 1, 1, 1, 1, 1, 1].map((score, i) => ({ name: SKILLS_SE[i], score })),
  },

  // ── Threshold boundary ──────────────────────────────────────────────
  // Test: scores sitting exactly on weak/moderate/strong thresholds
  'threshold': {
    jobTitle: 'Software Engineer',
    matchScore: 4.5,
    skills: [
      { name: 'Strong skill (9/10)', score: 9 },
      { name: 'Strong boundary (7/10)', score: 7 },
      { name: 'Moderate skill (5/10)', score: 5 },
      { name: 'Moderate boundary (4/10)', score: 4 },
      { name: 'Weak skill (3/10)', score: 3 },
      { name: 'Weak boundary (1/10)', score: 1 },
      { name: 'Zero score (0/10)', score: 0 },
      { name: 'Max score (10/10)', score: 10 },
      { name: 'Moderate (6/10)', score: 6 },
      { name: 'Weak (2/10)', score: 2 },
    ],
  },
}

// ─── Main dashboard ──────────────────────────────────────────────────
const SkillsMatchDashboard = () => {
  const navigate = useNavigate()
  const { reportError } = useError()
  const [params] = useSearchParams()
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [betterSavedCv, setBetterSavedCv] = useState<CompareSavedResponse['bestSavedCv']>(null)
  const [displayedCvFileName, setDisplayedCvFileName] = useState<string | null>(null)
  const leavingRef = useRef(false)

  useEffect(() => {
    if (leavingRef.current) return
    const mock = params.get('mock')
    if (mock && MOCK_DATA[mock]) {
      setResult(MOCK_DATA[mock] as AnalyzeResponse)
      setDisplayedCvFileName(null)
      return
    }
    const raw = sessionStorage.getItem(RESULT_KEY)
    if (!raw) {
      navigate('/upload', { replace: true })
      return
    }
    try {
      const parsed = JSON.parse(raw) as StoredAnalysisResult
      setResult(parsed)
      setBetterSavedCv(parsed.bestSavedCv ?? null)
      setDisplayedCvFileName(
        parsed.cvFileName
        ?? sessionStorage.getItem(CV_FILENAME_KEY)
        ?? 'cv.pdf',
      )
    }
    catch { setParseError('Invalid results data') }
  }, [navigate, params])

  const handleGoHome = () => {
    leavingRef.current = true
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/')
  }

  const handleTryAnotherRole = () => {
    leavingRef.current = true
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/upload')
  }

  const handleBackToUpload = () => {
    leavingRef.current = true
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/upload')
  }

  async function handleViewBetterCv() {
    if (!betterSavedCv || !result) return

    const saved = betterSavedCv
    const analysis: AnalyzeResponse = {
      id: saved.analysisId,
      jobTitle: saved.jobTitle,
      skills: saved.skills,
      matchScore: saved.matchScore,
      cvOnlyMode: saved.cvOnlyMode,
      isEstimated: saved.isEstimated,
    }

    sessionStorage.setItem('excludeCvId', saved.cvId)
    sessionStorage.setItem(CV_FILENAME_KEY, saved.fileName)

    setBetterSavedCv(null)
    setResult(analysis)
    setDisplayedCvFileName(saved.fileName)

    try {
      const { cvText } = await getCvText(saved.cvId)
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({
        ...analysis,
        cvText,
        cvFileName: saved.fileName,
        bestSavedCv: null,
      }))
    } catch (err) {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({
        ...analysis,
        cvFileName: saved.fileName,
        bestSavedCv: null,
      }))
      reportError(err)
    }
  }

  if (parseError) return (
    <div className="dashboard-screen">
      <p className="dashboard-error">{parseError}</p>
      <button className="btn-back" onClick={handleTryAnotherRole}>← Back</button>
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
  const analyzedSkillCount = result.cvOnlyMode ? 5 : 10

  return (
    <div className="dashboard-screen">
      <div className="dashboard-nav">
        <div className="dashboard-nav-left">
          <button className="btn-nav-pill" onClick={handleGoHome}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </button>
          <button className="btn-nav-pill" onClick={() => navigate('/account')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Account
          </button>
          <AdminNavLink className="btn-nav-pill btn-nav-pill--admin" />
        </div>
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
          <div className="step-line" />
          <div className="step">
            <div className="step-dot">3</div>
            <span className="step-label">Improve</span>
          </div>
        </div>
        <AppLogo size="sm" />
      </div>

      <h1 className="dashboard-title">{result.jobTitle}</h1>

      {/* Cards */}
      <CounterProvider key={result.id}>
        <div className="cards-grid">

          {/* ── Overall score card ── */}
          <ScoreCard className="score-card--main">
            <div className="card-eyebrow-row">
              <p className="card-eyebrow">Overall match</p>
              {result.cvOnlyMode && (
                <span className="cv-only-badge">CV-only analysis (5 skills)</span>
              )}
              {result.isEstimated && !result.cvOnlyMode && (
                <span
                  className="estimated-badge"
                  title="Scores were computed with keyword matching because the AI service was unavailable"
                >
                  Estimated score (AI unavailable)
                </span>
              )}
            </div>
            <HalfCircleGauge key={result.id} value={matchPercent} max={100} animate />
            <div className="card-results-summary">
              {displayedCvFileName && (
                <p className="card-cv-filename" title={displayedCvFileName}>
                  {displayedCvFileName}
                </p>
              )}
              <p className="card-description">
                Your CV matches <strong>{result.jobTitle}</strong> requirements
                based on <strong>{analyzedSkillCount}</strong> analyzed skills.
              </p>
            </div>
            {betterSavedCv && (
              <div className="saved-cv-banner" role="status">
                <div className="saved-cv-banner__header">
                  <span className="saved-cv-banner__star" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                  <p className="saved-cv-banner__title">Better match in your library</p>
                </div>
                <p className="saved-cv-banner__filename" title={betterSavedCv.fileName}>
                  {betterSavedCv.fileName}
                </p>
                <div className="saved-cv-banner__scores" aria-label={`Saved CV score ${betterSavedCv.matchScore.toFixed(1)} versus current ${result.matchScore.toFixed(1)}`}>
                  <span className="saved-cv-banner__score saved-cv-banner__score--better">
                    {betterSavedCv.matchScore.toFixed(1)}
                  </span>
                  <span className="saved-cv-banner__vs">vs</span>
                  <span className="saved-cv-banner__score saved-cv-banner__score--current">
                    {result.matchScore.toFixed(1)}
                  </span>
                  <span className="saved-cv-banner__scale">/10</span>
                </div>
                  <button
                    type="button"
                    className="saved-cv-banner__btn"
                    onClick={handleViewBetterCv}
                  >
                    Switch to this CV
                  </button>
              </div>
            )}
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
          {!result.cvOnlyMode && (
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
          )}

        </div>

        <div className="dashboard-bottom-actions">
          <button className="btn-card-action btn-back-standalone" onClick={handleBackToUpload}>
            ← Back to upload
          </button>
          <button
            className="btn-improve"
            onClick={() => navigate('/improve')}
          >
            Improve your CV →
          </button>
        </div>
      </CounterProvider>
    </div>
  )
}

export default SkillsMatchDashboard
