import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../components/ui/AppLogo'
import { useToast } from '../contexts/ToastContext'
import { useError } from '../context/ErrorContext'
import {
  ApiError,
  analyzeCv,
  analyzePersonalized,
  getPersonalizationOptions,
} from '../services/api'
import type {
  PersonalizationOptions,
  PersonalizationWeights,
  RecommendationMode,
  SkillOption,
} from '../services/api'
import './PersonalizationScreen.css'

const INPUT_KEY = 'personalizationInput'
const RESULT_KEY = 'analysisResult'
const MAX_FOCUS_SKILLS = 5

interface PersonalizationInput {
  canonicalTitle: string
  detectedTitle?: string
  cvText: string
  cvFileName: string
  jobDescription: string
  isPostingMode: boolean
  excludeCvId?: string
}

type WeightKey = keyof PersonalizationWeights

const PRESETS: Record<Exclude<RecommendationMode, 'custom'>, PersonalizationWeights> = {
  stable: { stable: 60, trending: 15, personalMatch: 25 },
  balanced: { stable: 33, trending: 33, personalMatch: 34 },
  trending: { stable: 15, trending: 60, personalMatch: 25 },
}

const MODE_LABELS: Record<RecommendationMode, string> = {
  stable: 'Stable',
  balanced: 'Balanced',
  trending: 'Trending',
  custom: 'Custom',
}

const MODE_HINTS: Record<RecommendationMode, string> = {
  stable: 'Favor skills that stay in demand over time.',
  balanced: 'An even mix of stability, trends, and personal fit.',
  trending: 'Lean into skills on the rise in recent postings.',
  custom: 'Set your own balance with the sliders below.',
}

const WEIGHT_LABELS: Record<WeightKey, string> = {
  stable: 'Stable',
  trending: 'Trending',
  personalMatch: 'Personal Match',
}

/** Move one weight to `value` and rebalance the other two so the sum stays 100. */
function rebalanceWeights(
  weights: PersonalizationWeights,
  key: WeightKey,
  value: number
): PersonalizationWeights {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const others = (Object.keys(weights) as WeightKey[]).filter((k) => k !== key)
  const remaining = 100 - clamped
  const otherSum = others.reduce((sum, k) => sum + weights[k], 0)

  const next = { ...weights, [key]: clamped }
  if (otherSum === 0) {
    next[others[0]] = Math.floor(remaining / 2)
    next[others[1]] = remaining - next[others[0]]
  } else {
    next[others[0]] = Math.round((remaining * weights[others[0]]) / otherSum)
    next[others[1]] = remaining - next[others[0]]
  }
  return next
}

function readInput(): PersonalizationInput | null {
  try {
    const raw = sessionStorage.getItem(INPUT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersonalizationInput
  } catch {
    return null
  }
}

export default function PersonalizationScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { reportError } = useError()

  const input = useMemo(readInput, [])

  const [options, setOptions] = useState<PersonalizationOptions | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [mode, setMode] = useState<RecommendationMode>('balanced')
  const [weights, setWeights] = useState<PersonalizationWeights>(PRESETS.balanced)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [notImplemented, setNotImplemented] = useState(false)
  const submittedRef = useRef(false)

  // No carried input (e.g. direct navigation / refresh) → send back to upload.
  useEffect(() => {
    if (!input) {
      navigate('/upload', { replace: true })
    }
  }, [input, navigate])

  useEffect(() => {
    if (!input) return
    let cancelled = false
    setLoadingOptions(true)
    getPersonalizationOptions({
      canonicalTitle: input.canonicalTitle,
      cvText: input.cvText,
      jobDescription: input.jobDescription || undefined,
      isPostingMode: input.isPostingMode,
    })
      .then((data) => {
        if (cancelled) return
        setOptions(data)
        setSelectedIds(
          data.roleDerivedSkills.filter((s) => s.selectedByDefault).slice(0, MAX_FOCUS_SKILLS).map((s) => s.id)
        )
      })
      .catch((err) => {
        if (cancelled) return
        reportError(err)
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [input, reportError])

  function selectPreset(next: RecommendationMode) {
    setMode(next)
    if (next !== 'custom') setWeights(PRESETS[next])
  }

  function changeWeight(key: WeightKey, value: number) {
    setMode('custom')
    setWeights((prev) => rebalanceWeights(prev, key, value))
  }

  function toggleSkill(skill: SkillOption) {
    setSelectedIds((prev) => {
      if (prev.includes(skill.id)) return prev.filter((id) => id !== skill.id)
      if (prev.length >= MAX_FOCUS_SKILLS) {
        showToast(`You can select up to ${MAX_FOCUS_SKILLS} skills only`, 'info')
        return prev
      }
      return [...prev, skill.id]
    })
  }

  async function handleContinue() {
    if (!input || submitting || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const result = await analyzePersonalized({
        canonicalTitle: input.canonicalTitle,
        cvText: input.cvText,
        jobDescription: input.jobDescription || undefined,
        excludeCvId: input.excludeCvId || undefined,
        personalization: { mode, weights, selectedSkillIds: selectedIds },
      })
      sessionStorage.setItem(
        RESULT_KEY,
        JSON.stringify({ ...result, cvText: input.cvText, cvFileName: input.cvFileName })
      )
      sessionStorage.setItem('jobDescription', input.isPostingMode ? input.jobDescription : '')
      sessionStorage.setItem('cvFileName', input.cvFileName)
      sessionStorage.setItem('excludeCvId', input.excludeCvId ?? '')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      submittedRef.current = false
      if (err instanceof ApiError && err.code === 'PERSONALIZATION_NOT_IMPLEMENTED') {
        setNotImplemented(true)
        return
      }
      reportError(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function continueWithStandard() {
    if (!input || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const result = await analyzeCv(
        input.canonicalTitle,
        input.cvText,
        input.isPostingMode ? input.jobDescription : '',
        0.0,
        { skipGibberish: !input.isPostingMode, excludeCvId: input.excludeCvId || undefined }
      )
      sessionStorage.setItem(
        RESULT_KEY,
        JSON.stringify({ ...result, cvText: input.cvText, cvFileName: input.cvFileName })
      )
      sessionStorage.setItem('jobDescription', input.isPostingMode ? input.jobDescription : '')
      sessionStorage.setItem('cvFileName', input.cvFileName)
      sessionStorage.setItem('excludeCvId', input.excludeCvId ?? '')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      submittedRef.current = false
      reportError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!input) return null

  const detectedTitle = options?.detectedTitle ?? input.detectedTitle ?? input.canonicalTitle
  const selectedCount = selectedIds.length
  const showFocusSkills = input.isPostingMode

  return (
    <section className="upload-section upload-section--visible">
      <div className="upload-wrapper">
        <div className="upload-app-header upload-app-header--standalone">
          <div className="upload-app-nav">
            <Link to="/upload" className="btn-nav-pill btn-nav-pill--back">
              ← Back to upload
            </Link>
            <Link to="/" className="btn-nav-pill">Home</Link>
            <Link to="/account" className="btn-nav-pill">Account</Link>
          </div>
          <AppLogo size="sm" />
        </div>

        <div className="upload-card personalize-card">
          <div className="personalize-intro">
            <h1 className="personalize-title">Tailor your recommendations</h1>
            <p className="personalize-detected">
              Detected role: <strong>{detectedTitle}</strong>
              <span className="personalize-detected-note"> · optional step — skip anytime with standard results</span>
            </p>
          </div>

          {/* ── Area 1: Recommendation Balance ───────────────────────── */}
          <section className="personalize-section">
            <h2 className="personalize-section-title">Recommendation Balance</h2>
            <p className="personalize-section-sub">
              How the <strong>model</strong> balances its recommendations — between skills that
              stay in demand over time (<strong>Stable</strong>), skills rising in recent job
              postings (<strong>Trending</strong>), and how closely they fit your CV and role
              (<strong>Personal Match</strong>).
            </p>

            <div className="preset-grid">
            {(Object.keys(MODE_LABELS) as RecommendationMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`preset-btn${mode === m ? ' preset-btn--active' : ''}`}
                onClick={() => selectPreset(m)}
                aria-pressed={mode === m}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="personalize-hint">{MODE_HINTS[mode]}</p>

          {mode === 'custom' && (
            <div className="weights-body">
              {(Object.keys(weights) as WeightKey[]).map((key) => (
                <div className="weight-control" key={key}>
                  <div className="slider-row">
                    <span className="slider-label-end">{WEIGHT_LABELS[key]}</span>
                    <input
                      className="pref-slider"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={weights[key]}
                      onChange={(e) => changeWeight(key, Number(e.target.value))}
                      aria-label={`${WEIGHT_LABELS[key]} weight`}
                    />
                    <span className="slider-label-end weight-value">{weights[key]}%</span>
                  </div>
                </div>
              ))}
              <p className="slider-hint">Total: {weights.stable + weights.trending + weights.personalMatch}%</p>
            </div>
          )}
        </section>

        {showFocusSkills && (
          <section className="personalize-section">
            <h2 className="personalize-section-title">Focus Skills</h2>
            <p className="personalize-section-sub">
              Top dynamic skills extracted from this job posting. Pick up to{' '}
              {MAX_FOCUS_SKILLS} to focus on — only the selected ones move to your results.{' '}
              <span className="focus-count">({selectedCount}/{MAX_FOCUS_SKILLS} selected)</span>
            </p>

            {loadingOptions ? (
              <p className="personalize-loading">Loading skills…</p>
            ) : options && options.roleDerivedSkills.length > 0 ? (
              <div className="focus-skill-grid">
                {options.roleDerivedSkills.map((skill) => {
                  const checked = selectedIds.includes(skill.id)
                  const atLimit = !checked && selectedCount >= MAX_FOCUS_SKILLS
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      className={`focus-skill-chip${checked ? ' focus-skill-chip--selected' : ''}${atLimit ? ' focus-skill-chip--disabled' : ''}`}
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={checked}
                    >
                      <span className="focus-skill-name">{skill.name}</span>
                      <span className={`focus-skill-source focus-skill-source--${skill.source}`}>
                        {skill.source === 'cv' ? 'from CV' : 'from posting'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="personalize-loading">No dynamic skills available for this posting.</p>
            )}
          </section>
        )}

        {/* ── Footer / actions ─────────────────────────────────────── */}
        {notImplemented ? (
          <div className="personalize-notice">
            <p className="personalize-notice-text">
              Personalized recommendations are coming soon. You can continue with standard results for now.
            </p>
            <div className="personalize-actions">
              <button
                type="button"
                className="btn-back"
                onClick={() => navigate('/upload')}
                disabled={submitting}
              >
                Back to upload
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={continueWithStandard}
                disabled={submitting}
              >
                {submitting ? 'Analyzing…' : 'Continue to standard results'}
              </button>
            </div>
          </div>
        ) : (
          <div className="personalize-actions">
            <button
              type="button"
              className="btn-back"
              onClick={() => navigate('/upload')}
              disabled={submitting}
            >
              Back to upload
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleContinue}
              disabled={submitting || loadingOptions}
            >
              {submitting ? 'Submitting…' : 'Analyse with preferences'}
            </button>
            <button
              type="button"
              className="btn-ghost personalize-skip"
              onClick={continueWithStandard}
              disabled={submitting}
            >
              {submitting ? 'Analyzing…' : 'Skip — use standard results'}
            </button>
          </div>
        )}
        </div>
      </div>
    </section>
  )
}
