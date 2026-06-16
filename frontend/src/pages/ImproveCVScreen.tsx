import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  prepareImprovement,
  getSuggestion,
  mergeCv,
  reanalyzeCv,
  saveImprovementSession,
  type Proficiency,
  type SkillContext,
} from '../services/api'
import './ImproveCVScreen.css'

const RESULT_KEY = 'pocAnalysisResult'
const JD_KEY = 'pocJobDescription'
const CV_FILENAME_KEY = 'pocCvFileName'

type Phase = 'proficiency' | 'improvement' | 'result'

interface OccurrenceEdit {
  suggestedText: string | null
  finalText: string | null
  isLoading: boolean
  isEditing: boolean
  editDraft: string
}

const emptyEdit = (): OccurrenceEdit => ({
  suggestedText: null, finalText: null, isLoading: false, isEditing: false, editDraft: '',
})

interface SkillState extends SkillContext {
  proficiency: Proficiency | null
  // one entry per occurrence (found: true) or one entry for the "add" suggestion (found: false)
  occurrenceEdits: OccurrenceEdit[]
  activeOccurrenceTab: number
  skipped: boolean
}

function getActiveEdit(s: SkillState): OccurrenceEdit {
  return s.occurrenceEdits[s.activeOccurrenceTab] ?? emptyEdit()
}

function updateOccEdit(
  prev: SkillState[],
  skillIdx: number,
  occIdx: number,
  patch: Partial<OccurrenceEdit>
): SkillState[] {
  return prev.map((s, i) => {
    if (i !== skillIdx) return s
    const edits = s.occurrenceEdits.map((e, j) => j === occIdx ? { ...e, ...patch } : e)
    return { ...s, occurrenceEdits: edits }
  })
}

const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  no_knowledge: 'No knowledge',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  proficient: 'Proficient',
  expert: 'Expert',
}

const PROFICIENCY_ORDER: Proficiency[] = ['no_knowledge', 'beginner', 'intermediate', 'proficient', 'expert']

// ── Mock data for URL-driven testing (?mock=<key> or ?phase=result) ──
const MOCK_CV_DEVOPS = `John Smith — DevOps Engineer
john.smith@email.com | linkedin.com/in/johnsmith

EXPERIENCE
Senior Engineer — Acme Corp (2021–present)
  Worked on backend systems and deployments in a fast-paced environment.
  Managed AWS infrastructure for production services.
  Collaborated with development teams on release processes.

Junior Engineer — StartupXYZ (2019–2021)
  Built CI pipelines using Jenkins for automated testing.
  Maintained Linux servers and handled on-call incidents.

SKILLS
AWS, Linux, Jenkins, Python, Bash, Git

EDUCATION
B.Sc. Computer Science — Tel Aviv University 2019`

const MOCK_CV_DS = `Maya Cohen — Data Scientist
maya@email.com | github.com/mayacohen

EXPERIENCE
Data Scientist — FinTech Ltd (2022–present)
  Developed analytical models and dashboards for business stakeholders.
  Worked with large datasets to extract business insights.
  Participated in A/B testing and experimentation design.

Analyst — Analytics Co (2020–2022)
  Produced weekly reports and visualizations using Excel and Python basics.

SKILLS
Python, SQL, Excel, Tableau, Statistics

EDUCATION
M.Sc. Industrial Engineering — Technion 2020`

const MOCK_JD_DEVOPS = `We are looking for a DevOps Engineer to join our platform team.
Requirements: Docker, Kubernetes, CI/CD pipelines, MongoDB, Test Automation, AWS, Linux.
Experience with containerization and orchestration is mandatory.
Strong understanding of monitoring and alerting tools.`

const MOCK_JD_DS = `Looking for a Data Scientist with experience in Machine Learning, TensorFlow/PyTorch,
SQL, feature engineering, model deployment (MLOps), statistical analysis, and Python.
Must have experience with deep learning frameworks and model evaluation.`

interface MockEntry {
  jobTitle: string
  skills: Array<{ name: string; score: number }>
  matchScore: number
  id: string
  cvText: string
  jd: string
}

const MOCK_IMPROVE_DATA: Record<string, MockEntry> = {
  devops: {
    jobTitle: 'DevOps Engineer',
    matchScore: 3.8,
    id: 'mock-devops-001',
    skills: [
      { name: 'Docker', score: 2 },
      { name: 'Kubernetes', score: 1 },
      { name: 'CI/CD Pipelines', score: 3 },
      { name: 'MongoDB', score: 0 },
      { name: 'Test Automation', score: 2 },
      { name: 'AWS', score: 6 },
      { name: 'Linux Administration', score: 7 },
      { name: 'Monitoring & Alerting', score: 4 },
      { name: 'Shell Scripting', score: 5 },
      { name: 'Incident Response', score: 4 },
    ],
    cvText: MOCK_CV_DEVOPS,
    jd: MOCK_JD_DEVOPS,
  },
  'data-scientist': {
    jobTitle: 'Data Scientist',
    matchScore: 4.2,
    id: 'mock-ds-001',
    skills: [
      { name: 'Machine Learning', score: 3 },
      { name: 'TensorFlow / PyTorch', score: 1 },
      { name: 'SQL & Databases', score: 4 },
      { name: 'Feature Engineering', score: 2 },
      { name: 'Model Deployment (MLOps)', score: 0 },
      { name: 'Python', score: 6 },
      { name: 'Statistical Analysis', score: 7 },
      { name: 'Data Visualization', score: 6 },
      { name: 'Experiment Design', score: 5 },
      { name: 'Deep Learning', score: 2 },
    ],
    cvText: MOCK_CV_DS,
    jd: MOCK_JD_DS,
  },
}

const MOCK_RESULT_CV = `John Smith — DevOps Engineer
john.smith@email.com | linkedin.com/in/johnsmith

EXPERIENCE
Senior Engineer — Acme Corp (2021–present)
  Worked on backend systems and deployments using Docker to containerize services,
  managing AWS infrastructure for production environments.
  Collaborated with development teams on release processes, building CI/CD pipelines
  with automated testing and Kubernetes-based deployment workflows.

Junior Engineer — StartupXYZ (2019–2021)
  Built CI pipelines using Jenkins for automated testing and test automation frameworks.
  Maintained Linux servers and handled on-call incidents, including MongoDB administration.

SKILLS
AWS, Linux, Jenkins, Python, Bash, Git, Docker, Kubernetes, MongoDB

EDUCATION
B.Sc. Computer Science — Tel Aviv University 2019`

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444'
  return (
    <div className="improve-score-bar">
      <div className="improve-score-track">
        <div className="improve-score-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="improve-score-label">{score}/10</span>
    </div>
  )
}

interface ReanalyzeResult {
  jobTitle: string
  skills: Array<{ name: string; score: number }>
  matchScore: number
  id: string
  cvText: string
}

interface ImproveCVScreenProps {
  onClose?: () => void
  onReanalyze?: (result: ReanalyzeResult) => void
}

export default function ImproveCVScreen({ onClose, onReanalyze }: ImproveCVScreenProps = {}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [phase, setPhase] = useState<Phase>('proficiency')
  const [activeTab, setActiveTab] = useState(0)
  const [skills, setSkills] = useState<SkillState[]>([])
  const [jobTitle, setJobTitle] = useState('')
  const [analysisId, setAnalysisId] = useState('')
  const [originalCvText, setOriginalCvText] = useState('')
  const [mergedCvText, setMergedCvText] = useState('')
  const [isMerging, setIsMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPreparing, setIsPreparing] = useState(true)

  // Load from sessionStorage and call /prepare on mount
  useEffect(() => {
    // ── Mock mode: ?phase=result → skip straight to result screen ──
    const mockPhase = searchParams.get('phase')
    if (mockPhase === 'result') {
      setJobTitle('DevOps Engineer (mock)')
      setOriginalCvText(MOCK_CV_DEVOPS)
      setMergedCvText(MOCK_RESULT_CV)
      setPhase('result')
      setIsPreparing(false)
      return
    }

    // ── Mock mode: ?mock=<key> → inject fake analysis data ──
    const mockKey = searchParams.get('mock')
    if (mockKey && MOCK_IMPROVE_DATA[mockKey]) {
      const m = MOCK_IMPROVE_DATA[mockKey]
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({ jobTitle: m.jobTitle, skills: m.skills, matchScore: m.matchScore, id: m.id, cvText: m.cvText }))
      sessionStorage.setItem(JD_KEY, m.jd)
      sessionStorage.setItem(CV_FILENAME_KEY, `mock_${mockKey}.pdf`)
    }

    const raw = sessionStorage.getItem(RESULT_KEY)
    if (!raw) { navigate('/', { replace: true }); return }

    let result: { jobTitle: string; skills: Array<{ name: string; score: number }>; matchScore: number; id: string; cvText?: string }
    try { result = JSON.parse(raw) } catch { navigate('/', { replace: true }); return }

    const cvText = result.cvText ?? ''
    if (!cvText || !Array.isArray(result.skills) || result.skills.length === 0) {
      navigate('/', { replace: true }); return
    }

    setJobTitle(result.jobTitle)
    setAnalysisId(result.id)
    setOriginalCvText(cvText)

    // Pick the 5 weakest skills (sorted ascending by score)
    const sorted = [...result.skills].sort((a, b) => a.score - b.score)
    const weakest = sorted.slice(0, 5).map((s) => ({ skill: s.name, score: s.score }))

    setIsPreparing(true)
    prepareImprovement(cvText, weakest)
      .then((prepared) => {
        setSkills(
          prepared.skills.map((ctx) => ({
            ...ctx,
            proficiency: null,
            occurrenceEdits: (ctx.found && ctx.occurrences.length > 0)
              ? ctx.occurrences.map(() => emptyEdit())
              : [emptyEdit()],
            activeOccurrenceTab: 0,
            skipped: false,
          }))
        )
      })
      .catch(() => {
        setSkills(
          weakest.map((s) => ({
            skill: s.skill,
            score: s.score,
            found: false,
            occurrences: [],
            primaryOccurrence: null,
            sharedWith: [],
            proficiency: null,
            occurrenceEdits: [emptyEdit()],
            activeOccurrenceTab: 0,
            skipped: false,
          }))
        )
      })
      .finally(() => setIsPreparing(false))
  }, [navigate])

  const setProficiency = useCallback((index: number, p: Proficiency) => {
    setSkills((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, proficiency: p, skipped: false }
          : s
      )
    )
  }, [])

  const allProficienciesSelected = skills.length > 0 && skills.every((s) => s.proficiency !== null)

  const fetchSuggestion = useCallback(async (skillIdx: number, occIdx: number, skill: SkillState, jt: string) => {
    if (skill.skipped || (skill.proficiency === 'no_knowledge' && !skill.found)) {
      setSkills((prev) =>
        prev.map((s, i) => i === skillIdx
          ? { ...s, skipped: true, occurrenceEdits: s.occurrenceEdits.map(() => ({ ...emptyEdit(), finalText: '' })) }
          : s)
      )
      return
    }

    setSkills((prev) => updateOccEdit(prev, skillIdx, occIdx, { isLoading: true }))

    try {
      const oldText = skill.occurrences[occIdx]?.text ?? null
      const suggested = await getSuggestion(
        skill.skill,
        skill.proficiency!,
        oldText,
        jt,
        skill.found
      )
      setSkills((prev) => updateOccEdit(prev, skillIdx, occIdx, {
        suggestedText: suggested, finalText: suggested, isLoading: false,
      }))
    } catch {
      setSkills((prev) => updateOccEdit(prev, skillIdx, occIdx, {
        suggestedText: null, finalText: null, isLoading: false,
      }))
    }
  }, [])

  const handleContinue = useCallback(() => {
    setPhase('improvement')
    setActiveTab(0)
    // Fetch primary occurrence (index 0) only if not already loaded — preserves edits on return
    skills.forEach((skill, i) => {
      const primary = skill.occurrenceEdits[0]
      if (primary && primary.suggestedText === null && !primary.isLoading && !skill.skipped) {
        fetchSuggestion(i, 0, skill, jobTitle)
      }
    })
  }, [skills, jobTitle, fetchSuggestion])

  const handleOccurrenceTabChange = useCallback((skillIdx: number, occIdx: number) => {
    setSkills((prev) =>
      prev.map((s, i) => i === skillIdx ? { ...s, activeOccurrenceTab: occIdx } : s)
    )
    const skill = skills[skillIdx]
    const edit = skill?.occurrenceEdits[occIdx]
    if (edit && edit.suggestedText === null && !edit.isLoading && !skill.skipped) {
      fetchSuggestion(skillIdx, occIdx, skill, jobTitle)
    }
  }, [skills, jobTitle, fetchSuggestion])

  const handleSkip = useCallback((index: number) => {
    setSkills((prev) =>
      prev.map((s, i) => i === index ? { ...s, skipped: true } : s)
    )
  }, [])

  const handleStartEdit = useCallback((skillIdx: number, occIdx: number) => {
    setSkills((prev) => {
      const s = prev[skillIdx]
      const e = s.occurrenceEdits[occIdx]
      return updateOccEdit(prev, skillIdx, occIdx, {
        isEditing: true,
        editDraft: e.finalText ?? e.suggestedText ?? '',
      })
    })
  }, [])

  const handleSaveEdit = useCallback((skillIdx: number, occIdx: number) => {
    setSkills((prev) => {
      const draft = prev[skillIdx]?.occurrenceEdits[occIdx]?.editDraft ?? ''
      return updateOccEdit(prev, skillIdx, occIdx, { isEditing: false, finalText: draft })
    })
  }, [])

  const handleEditDraftChange = useCallback((skillIdx: number, occIdx: number, value: string) => {
    setSkills((prev) => updateOccEdit(prev, skillIdx, occIdx, { editDraft: value }))
  }, [])

  const handleChangeProficiency = useCallback((index: number) => {
    setSkills((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              proficiency: null,
              skipped: false,
              occurrenceEdits: s.occurrenceEdits.map(() => emptyEdit()),
              activeOccurrenceTab: 0,
            }
          : s
      )
    )
    setPhase('proficiency')
  }, [])

  // Ready when no primary occurrence is still loading
  const allSuggestionsReady = skills.length > 0 &&
    skills.every((s) => s.skipped || !(s.occurrenceEdits[0]?.isLoading))

  const handleSubmit = useCallback(async () => {
    setIsMerging(true)
    setMergeError(null)
    try {
      // Collect one improvement per accepted occurrence across all skills
      const improvements: Array<{
        skill: string; proficiency: string; sectionId: string | null;
        originalText: string | null; finalText: string; found: boolean;
      }> = []

      for (const s of skills) {
        if (s.skipped) continue
        s.occurrenceEdits.forEach((edit, oi) => {
          const finalText = edit.finalText ?? edit.suggestedText
          if (!finalText?.trim()) return
          improvements.push({
            skill: s.skill,
            proficiency: s.proficiency ?? 'beginner',
            sectionId: s.occurrences[oi]?.sectionId ?? null,
            originalText: s.occurrences[oi]?.text ?? null,
            finalText,
            found: s.found,
          })
        })
      }

      const merged = await mergeCv(originalCvText, jobTitle, improvements)
      setMergedCvText(merged)
      setPhase('result')

      saveImprovementSession({
        jobTitle,
        analysisId,
        originalCvText,
        finalCvText: merged,
        improvements: skills.map((s) => ({
          skill: s.skill,
          score: s.score,
          proficiency: s.proficiency ?? '',
          sectionId: s.occurrences[0]?.sectionId ?? null,
          originalText: s.occurrences[0]?.text ?? null,
          suggestedText: s.occurrenceEdits[0]?.suggestedText ?? '',
          finalText: s.occurrenceEdits[0]?.finalText ?? '',
          found: s.found,
          skipped: s.skipped,
        })),
      }).catch(() => {/* non-critical */})
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setIsMerging(false)
    }
  }, [skills, originalCvText, jobTitle, analysisId])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(mergedCvText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [mergedCvText])

  const handleExport = useCallback(() => {
    const filename = (sessionStorage.getItem(CV_FILENAME_KEY) ?? 'cv').replace(/\.pdf$/i, '')
    const blob = new Blob([mergedCvText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_improved.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [mergedCvText])

  const handleReanalyze = useCallback(async () => {
    const jd = sessionStorage.getItem(JD_KEY) ?? ''
    if (!jd) { alert('Job description not found. Please re-analyze from the home screen.'); return }
    if (!jobTitle) { alert('Job title not found.'); return }

    setIsReanalyzing(true)
    try {
      const result = await reanalyzeCv(jobTitle, mergedCvText, jd)
      const newResult: ReanalyzeResult = { ...result, cvText: mergedCvText }
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(newResult))
      sessionStorage.setItem('pocJobDescription', jd)
      if (onReanalyze) {
        onReanalyze(newResult)   // passes result to dashboard → updates state + closes modal
      } else if (onClose) {
        onClose()
        navigate('/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Re-analysis failed')
    } finally {
      setIsReanalyzing(false)
    }
  }, [mergedCvText, jobTitle, navigate, onClose, onReanalyze])

  const handleClose = useCallback(() => {
    if (phase === 'improvement') {
      if (!window.confirm('Leave the improvement flow? Your progress will be lost.')) return
    }
    if (onClose) {
      onClose()
    } else {
      navigate('/dashboard')
    }
  }, [phase, navigate, onClose])

  // ── Shared header (shown in every phase) ─────────────────────────────
  const PHASE_TITLES: Record<Phase, string> = {
    proficiency: 'Rate your skill levels',
    improvement: `Skill ${activeTab + 1} of ${skills.length}`,
    result: 'Your improved CV is ready',
  }

  const modalHeader = (
    <div className="improve-modal-header">
      <span className="improve-modal-title">{PHASE_TITLES[phase] ?? ''}</span>
      <button className="improve-modal-close" onClick={handleClose} title="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────

  if (isPreparing) {
    return (
      <div className="improve-overlay">
        <div className="improve-modal">
          {modalHeader}
          <div className="improve-modal-body improve-modal-body--center">
            <div className="improve-spinner" />
            <p className="improve-loading-text">Analyzing your CV…</p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'proficiency') {
    return (
      <div className="improve-overlay">
        <div className="improve-modal">
          {modalHeader}
          <div className="improve-modal-body">
            <p className="improve-subtitle">
              We found <strong>{skills.length}</strong> skills to work on. Tell us your actual level for each.
            </p>

            <div className="improve-skills-list">
              {skills.map((skill, i) => (
                <div key={skill.skill} className="improve-skill-card">
                  <div className="improve-skill-header">
                    <span className="improve-skill-name">{skill.skill}</span>
                    <ScoreBar score={skill.score} />
                  </div>
                  <div className="improve-proficiency-row">
                    {PROFICIENCY_ORDER.map((p) => (
                      <button
                        key={p}
                        className={`improve-prof-btn${skill.proficiency === p ? ' improve-prof-btn--active' : ''}`}
                        onClick={() => setProficiency(i, p)}
                      >
                        {PROFICIENCY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="improve-modal-footer">
              <button
                className="improve-continue-btn"
                disabled={!allProficienciesSelected}
                onClick={handleContinue}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'improvement') {
    const skill = skills[activeTab]

    return (
      <div className="improve-overlay">
        <div className="improve-modal improve-modal--wide">
          {modalHeader}
          <div className="improve-modal-body">

            {/* Back to proficiency + skill tabs */}
            <div className="improve-phase-nav">
              <button className="improve-phase-back" onClick={() => setPhase('proficiency')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Back to skill levels
              </button>
            </div>

            {/* Skill tabs */}
            <div className="improve-tabs">
              {skills.map((s, i) => (
                <button
                  key={s.skill}
                  className={`improve-tab${activeTab === i ? ' improve-tab--active' : ''}${s.skipped ? ' improve-tab--skipped' : ''}`}
                  onClick={() => setActiveTab(i)}
                >
                  {s.skill}
                  {s.skipped && <span className="improve-tab-skip">skip</span>}
                  {s.occurrenceEdits.some(e => e.isLoading) && <span className="improve-tab-dot" />}
                </button>
              ))}
            </div>

            {/* Skill meta */}
            <div className="improve-skill-meta">
              <span className="improve-skill-meta-name">{skill.skill}</span>
              <span className="improve-skill-meta-sep">·</span>
              <span>Score: {skill.score}/10</span>
              <span className="improve-skill-meta-sep">·</span>
              <span>Level: <strong>{PROFICIENCY_LABELS[skill.proficiency!]}</strong></span>
              <button className="improve-change-level" onClick={() => handleChangeProficiency(activeTab)}>
                Change
              </button>
            </div>

            {/* no_knowledge + not found */}
            {skill.proficiency === 'no_knowledge' && !skill.found ? (
              <div className="improve-notice improve-notice--warn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <strong>{skill.skill}</strong> was not found in your CV and you marked "No knowledge". We recommend not adding it.
                  <div className="improve-notice-actions">
                    <button className="improve-link-btn" onClick={() => handleChangeProficiency(activeTab)}>Change proficiency</button>
                    <button className="improve-link-btn" onClick={() => handleSkip(activeTab)}>Skip this skill</button>
                  </div>
                </div>
              </div>
            ) : skill.skipped ? (
              <div className="improve-notice improve-notice--info">
                This skill has been skipped and will not affect your CV.
                <button className="improve-link-btn" onClick={() => handleChangeProficiency(activeTab)}>Undo</button>
              </div>
            ) : (
              <>
                {skill.sharedWith.length > 0 && (
                  <div className="improve-notice improve-notice--info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span>This section is also referenced by: <strong>{skill.sharedWith.join(', ')}</strong>. Changes will be merged into one paragraph at submit.</span>
                  </div>
                )}

                {skill.found && skill.occurrences.length > 1 && (
                  <div className="improve-occ-tabs">
                    {skill.occurrences.map((occ, oi) => {
                      const edit = skill.occurrenceEdits[oi]
                      return (
                        <button
                          key={occ.sectionId}
                          className={`improve-occ-tab${skill.activeOccurrenceTab === oi ? ' improve-occ-tab--active' : ''}`}
                          onClick={() => handleOccurrenceTabChange(activeTab, oi)}
                        >
                          Mention {oi + 1}
                          {edit?.isLoading && <span className="improve-tab-dot" />}
                          {edit?.finalText && !edit.isLoading && <span className="improve-occ-done">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}

                {(() => {
                  const occIdx = skill.activeOccurrenceTab
                  const activeOcc = skill.occurrences[occIdx] ?? null
                  const activeEdit = getActiveEdit(skill)
                  return (
                    <div className="improve-compare">
                      <div className="improve-panel improve-panel--old">
                        <p className="improve-panel-label">
                          Original
                          {skill.occurrences.length > 1 && (
                            <span className="improve-panel-count"> · mention {occIdx + 1} of {skill.occurrences.length}</span>
                          )}
                        </p>
                        {skill.found && activeOcc ? (
                          <div className="improve-panel-content">
                            <p className="improve-old-text improve-old-text--primary">{activeOcc.text}</p>
                          </div>
                        ) : (
                          <p className="improve-panel-empty">
                            No mention of <strong>{skill.skill}</strong> found in your CV.
                            {skill.proficiency !== 'no_knowledge' && (
                              <span> The improvement will be added to your Skills section.</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="improve-panel improve-panel--new">
                        <p className="improve-panel-label">Rephrased</p>
                        {activeEdit.isLoading ? (
                          <div className="improve-suggestion-loading">
                            <div className="improve-spinner improve-spinner--sm" />
                            <span>Generating suggestion…</span>
                          </div>
                        ) : activeEdit.suggestedText === null ? (
                          <div className="improve-suggestion-failed">
                            <p className="improve-panel-empty">Could not generate suggestion.</p>
                            <div className="improve-notice-actions">
                              <button className="improve-link-btn" onClick={() => fetchSuggestion(activeTab, occIdx, skill, jobTitle)}>Retry</button>
                              <button className="improve-link-btn" onClick={() => handleSkip(activeTab)}>Skip this skill</button>
                            </div>
                          </div>
                        ) : (
                          <div className="improve-panel-content">
                            {activeEdit.isEditing ? (
                              <>
                                <textarea
                                  className="improve-edit-textarea"
                                  value={activeEdit.editDraft}
                                  onChange={(e) => handleEditDraftChange(activeTab, occIdx, e.target.value)}
                                  rows={5}
                                  autoFocus
                                />
                                <button className="improve-done-btn" onClick={() => handleSaveEdit(activeTab, occIdx)}>Done</button>
                              </>
                            ) : (
                              <>
                                <p className="improve-new-text">{activeEdit.finalText ?? activeEdit.suggestedText}</p>
                                <button className="improve-edit-btn" onClick={() => handleStartEdit(activeTab, occIdx)}>Edit</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            <div className="improve-nav-row">
              <button className="improve-nav-btn" disabled={activeTab === 0} onClick={() => setActiveTab((i) => i - 1)}>
                ← Previous
              </button>
              <span className="improve-step-counter">{activeTab + 1} / {skills.length}</span>
              {activeTab < skills.length - 1 ? (
                <button className="improve-nav-btn improve-nav-btn--next" onClick={() => setActiveTab((i) => i + 1)}>
                  Next →
                </button>
              ) : (
                <button className="improve-submit-btn" disabled={!allSuggestionsReady || isMerging} onClick={handleSubmit}>
                  {isMerging ? 'Merging…' : 'Submit changes'}
                </button>
              )}
            </div>
            {mergeError && <p className="improve-error">{mergeError}</p>}
          </div>
        </div>
      </div>
    )
  }

  // Phase: result
  return (
    <div className="improve-overlay">
      <div className="improve-modal improve-modal--wide">
        {modalHeader}
        <div className="improve-modal-body">
          <p className="improve-subtitle">
            Review the changes below. You can copy, export, or send it for re-analysis.
          </p>

          <div className="improve-result-actions">
            <button className="improve-action-btn" onClick={handleCopy}>
              {copied
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
              }
            </button>
            <button className="improve-action-btn" onClick={handleExport}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
            <button className="improve-action-btn improve-action-btn--primary" onClick={handleReanalyze} disabled={isReanalyzing}>
              {isReanalyzing
                ? <><div className="improve-spinner improve-spinner--sm" /> Scoring…</>
                : 'Re-analyze →'}
            </button>
          </div>

          {/* Full-screen overlay during re-analysis */}
          {isReanalyzing && (
            <div className="improve-reanalyze-overlay">
              <div className="improve-reanalyze-card">
                <div className="improve-spinner" />
                <p className="improve-reanalyze-title">Analyzing your improved CV</p>
                <p className="improve-reanalyze-sub">Scoring skills for the selected role…</p>
              </div>
            </div>
          )}

          <div className="improve-result-cv">
            <pre className="improve-cv-text">{mergedCvText}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
