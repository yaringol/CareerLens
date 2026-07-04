import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../components/ui/AppLogo'
import { useToast } from '../contexts/ToastContext'
import { useError } from '../context/ErrorContext'
import {
  ApiError,
  analyzeCv,
  analyzePersonalized,
  clearSavedPersonalization,
  getPersonalizationOptions,
  getSavedPersonalization,
  savePersonalization,
} from '../services/api'
import type {
  PersonalizationOptions,
  PersonalizationWeights,
  RecommendationMode,
  SavedPersonalization,
  SkillOption,
} from '../services/api'
import './PersonalizationScreen.css'

const INPUT_KEY = 'personalizationInput'
const RESULT_KEY = 'analysisResult'
const PREVIOUS_RESULT_KEY = 'previousAnalysisResult'
const PREFS_KEY = 'personalizationPreferences'
const MAX_FOCUS_SKILLS = 5
/** Must match backend SKILL_POOL_SIZE — focus pool is at most 10 (fewer when core overlaps). */
const SKILL_POOL_SIZE = 10

interface PersonalizationPrefs {
  selectedSkillIds?: string[]
  selectedSkillNames?: string[]
  roleDerivedSkills?: SkillOption[]
  mode?: RecommendationMode
  weights?: PersonalizationWeights
}

interface PersonalizationInput {
  canonicalTitle: string
  detectedTitle?: string
  cvText: string
  cvFileName: string
  jobDescription: string
  isPostingMode: boolean
  excludeCvId?: string
  preferences?: PersonalizationPrefs
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

function readPersonalizationPrefs(): PersonalizationPrefs | null {
  try {
    const inputRaw = sessionStorage.getItem(INPUT_KEY)
    if (inputRaw) {
      const parsed = JSON.parse(inputRaw) as PersonalizationInput
      if (
        parsed.preferences?.selectedSkillIds?.length
        || parsed.preferences?.selectedSkillNames?.length
      ) {
        return parsed.preferences
      }
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = sessionStorage.getItem(PREFS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersonalizationPrefs
  } catch {
    return null
  }
}

function persistPreferences(prefs: PersonalizationPrefs): void {
  sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  try {
    const inputRaw = sessionStorage.getItem(INPUT_KEY)
    if (!inputRaw) return
    const parsed = JSON.parse(inputRaw) as PersonalizationInput
    sessionStorage.setItem(INPUT_KEY, JSON.stringify({ ...parsed, preferences: prefs }))
  } catch {
    /* noop */
  }
}

function readDynamicSkillNamesFromResult(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { skills?: { name: string }[] }
    return (parsed.skills ?? []).slice(5, 10).map((s) => s.name.toLowerCase())
  } catch {
    return []
  }
}

/** Names of dynamic skills currently shown on the dashboard (or the saved snapshot). */
function readSavedDynamicSkillNames(): string[] {
  const prefs = readPersonalizationPrefs()
  if (prefs?.selectedSkillNames?.length) {
    return prefs.selectedSkillNames.map((n) => n.toLowerCase())
  }
  const fromCurrent = readDynamicSkillNamesFromResult(sessionStorage.getItem(RESULT_KEY))
  if (fromCurrent.length > 0) return fromCurrent
  return readDynamicSkillNamesFromResult(sessionStorage.getItem(PREVIOUS_RESULT_KEY))
}

function normalizeSkillPool(pool: SkillOption[]): SkillOption[] {
  return pool.slice(0, SKILL_POOL_SIZE)
}

function namesToSelectedIds(pool: SkillOption[], names: string[]): string[] {
  const poolByName = new Map(pool.map((s) => [s.name.toLowerCase(), s]))
  return names
    .map((name) => poolByName.get(name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id))
    .slice(0, MAX_FOCUS_SKILLS)
}

function resolveSelectedIds(pool: SkillOption[], prefs: PersonalizationPrefs | null): string[] {
  if (prefs?.selectedSkillNames?.length) {
    const fromNames = namesToSelectedIds(pool, prefs.selectedSkillNames)
    if (fromNames.length > 0) return fromNames
  }

  if (prefs?.selectedSkillIds?.length) {
    const poolById = new Map(pool.map((s) => [s.id, s]))
    const fromIds = prefs.selectedSkillIds
      .map((id) => poolById.get(id)?.id)
      .filter((id): id is string => Boolean(id))
    if (fromIds.length > 0) return fromIds.slice(0, MAX_FOCUS_SKILLS)
  }

  const savedNames = readSavedDynamicSkillNames()
  if (savedNames.length > 0) {
    const fromNames = namesToSelectedIds(pool, savedNames)
    if (fromNames.length > 0) return fromNames
  }

  return pool
    .filter((s) => s.selectedByDefault)
    .slice(0, MAX_FOCUS_SKILLS)
    .map((s) => s.id)
}

function buildPrefsSnapshot(
  pool: SkillOption[],
  selected: string[],
  mode: RecommendationMode,
  weights: PersonalizationWeights,
  prev: PersonalizationPrefs | null = null,
): PersonalizationPrefs {
  return {
    ...prev,
    roleDerivedSkills: normalizeSkillPool(pool),
    selectedSkillIds: selected,
    selectedSkillNames: pool.filter((s) => selected.includes(s.id)).map((s) => s.name),
    mode,
    weights,
  }
}

function hasPreviousResults(): boolean {
  return Boolean(sessionStorage.getItem(PREVIOUS_RESULT_KEY))
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
  const savedPrefs = useMemo(readPersonalizationPrefs, [])

  const [options, setOptions] = useState<PersonalizationOptions | null>(() => {
    if (!savedPrefs?.roleDerivedSkills?.length) return null
    const inp = readInput()
    return {
      detectedTitle: inp?.detectedTitle ?? inp?.canonicalTitle ?? '',
      extractedCvSkills: [],
      roleDerivedSkills: normalizeSkillPool(savedPrefs.roleDerivedSkills),
    }
  })
  const [loadingOptions, setLoadingOptions] = useState(() => !savedPrefs?.roleDerivedSkills?.length)
  const [mode, setMode] = useState<RecommendationMode>(savedPrefs?.mode ?? 'balanced')
  const [weights, setWeights] = useState<PersonalizationWeights>(
    savedPrefs?.weights ?? PRESETS.balanced
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (savedPrefs?.roleDerivedSkills?.length) {
      return resolveSelectedIds(normalizeSkillPool(savedPrefs.roleDerivedSkills), savedPrefs)
    }
    return savedPrefs?.selectedSkillIds ?? []
  })
  const [submitting, setSubmitting] = useState(false)
  const [notImplemented, setNotImplemented] = useState(false)
  const [savedPreference, setSavedPreference] = useState<SavedPersonalization | null>(null)
  const [rememberPreference, setRememberPreference] = useState(false)
  const submittedRef = useRef(false)
  const showBackToResults = useMemo(hasPreviousResults, [])

  // No carried input (e.g. direct navigation / refresh) → send back to upload.
  useEffect(() => {
    if (!input) {
      navigate('/upload', { replace: true })
    }
  }, [input, navigate])

  useEffect(() => {
    let cancelled = false
    getSavedPersonalization()
      .then((preference) => {
        if (cancelled) return
        setSavedPreference(preference)
        setRememberPreference(preference !== null)
      })
      .catch(() => {
        /* no saved preference to offer — not fatal */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!input) return
    let cancelled = false
    const prefs = readPersonalizationPrefs()
    const hasCachedPool = Boolean(prefs?.roleDerivedSkills?.length)
    if (!hasCachedPool) setLoadingOptions(true)

    getPersonalizationOptions({
      canonicalTitle: input.canonicalTitle,
      cvText: input.cvText,
      jobDescription: input.jobDescription || undefined,
      isPostingMode: input.isPostingMode,
    })
      .then((data) => {
        if (cancelled) return
        const currentPrefs = readPersonalizationPrefs()
        // Keep the saved pool on return visits — do not merge with a fresh API call (that caused 13+ chips).
        const pool = currentPrefs?.roleDerivedSkills?.length
          ? normalizeSkillPool(currentPrefs.roleDerivedSkills)
          : normalizeSkillPool(data.roleDerivedSkills)
        const resolvedIds = resolveSelectedIds(pool, currentPrefs)
        setOptions({ ...data, roleDerivedSkills: pool })
        setSelectedIds(resolvedIds)
        persistPreferences(
          buildPrefsSnapshot(pool, resolvedIds, currentPrefs?.mode ?? mode, currentPrefs?.weights ?? weights, currentPrefs),
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
    const nextWeights = next !== 'custom' ? PRESETS[next] : weights
    if (next !== 'custom') setWeights(nextWeights)
    const pool = options?.roleDerivedSkills ?? []
    persistPreferences(
      buildPrefsSnapshot(pool, selectedIds, next, nextWeights, readPersonalizationPrefs()),
    )
  }

  function changeWeight(key: WeightKey, value: number) {
    setMode('custom')
    setWeights((prev) => {
      const next = rebalanceWeights(prev, key, value)
      const pool = options?.roleDerivedSkills ?? []
      persistPreferences(
        buildPrefsSnapshot(pool, selectedIds, 'custom', next, readPersonalizationPrefs()),
      )
      return next
    })
  }

  function toggleSkill(skill: SkillOption) {
    setSelectedIds((prev) => {
      let next: string[]
      if (prev.includes(skill.id)) {
        next = prev.filter((id) => id !== skill.id)
      } else if (prev.length >= MAX_FOCUS_SKILLS) {
        showToast(`You can select up to ${MAX_FOCUS_SKILLS} skills only`, 'info')
        return prev
      } else {
        next = [...prev, skill.id]
      }
      const pool = options?.roleDerivedSkills ?? []
      persistPreferences(
        buildPrefsSnapshot(pool, next, mode, weights, readPersonalizationPrefs()),
      )
      return next
    })
  }

  function restoreSavedPreference() {
    if (savedPreference === null) return
    setMode(savedPreference.mode)
    setWeights(savedPreference.weights)
    showToast('Restored your saved recommendation balance', 'info')
  }

  /** Best-effort — never blocks navigation to the results screen on failure. */
  async function syncSavedPreference() {
    try {
      if (rememberPreference) {
        await savePersonalization({ mode, weights })
      } else if (savedPreference !== null) {
        await clearSavedPersonalization()
      }
    } catch {
      /* saving the preference is a convenience, not required for analysis to proceed */
    }
  }

  async function handleContinue() {
    if (!input || submitting || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const pool = options?.roleDerivedSkills ?? []
      const selectedSkillNames = pool
        .filter((skill) => selectedIds.includes(skill.id))
        .map((skill) => skill.name)
      persistPreferences(
        buildPrefsSnapshot(pool, selectedIds, mode, weights, readPersonalizationPrefs()),
      )
      const result = await analyzePersonalized({
        canonicalTitle: input.canonicalTitle,
        cvText: input.cvText,
        jobDescription: input.jobDescription || undefined,
        isPostingMode: input.isPostingMode,
        excludeCvId: input.excludeCvId || undefined,
        personalization: { mode, weights, selectedSkillIds: selectedIds, selectedSkillNames },
      })
      await syncSavedPreference()
      sessionStorage.setItem(
        RESULT_KEY,
        JSON.stringify({ ...result, cvText: input.cvText, cvFileName: input.cvFileName })
      )
      sessionStorage.setItem('jobDescription', input.isPostingMode ? input.jobDescription : '')
      sessionStorage.setItem('cvFileName', input.cvFileName)
      sessionStorage.setItem('excludeCvId', input.excludeCvId ?? '')
      sessionStorage.removeItem(PREVIOUS_RESULT_KEY)
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
      sessionStorage.removeItem(PREVIOUS_RESULT_KEY)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      submittedRef.current = false
      reportError(err)
    } finally {
      setSubmitting(false)
    }
  }

  function handleBackToResults() {
    const raw = sessionStorage.getItem(PREVIOUS_RESULT_KEY)
    if (!raw) return
    setReturningToResults(true)
    sessionStorage.setItem(RESULT_KEY, raw)
    navigate('/dashboard', { replace: true })
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
            {showBackToResults ? (
              <button
                type="button"
                className="btn-nav-pill btn-nav-pill--back"
                onClick={handleBackToResults}
                disabled={returningToResults}
              >
                ← Back to results
              </button>
            ) : (
              <Link to="/upload" className="btn-nav-pill btn-nav-pill--back">
                ← Back to upload
              </Link>
            )}
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

          <div className="personalize-preference-row">
            <label className="save-toggle">
              <input
                type="checkbox"
                checked={rememberPreference}
                onChange={(e) => setRememberPreference(e.target.checked)}
              />
              <span className="save-toggle-track" />
              <span className="save-toggle-label">Remember this balance for next time</span>
            </label>
            {savedPreference !== null && (
              <button type="button" className="btn-ghost" onClick={restoreSavedPreference}>
                Restore saved balance
              </button>
            )}
          </div>

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
              Top skills extracted from this job posting (up to 10). Pick{' '}
              {MAX_FOCUS_SKILLS} to focus on — only the selected ones appear in your results.{' '}
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
