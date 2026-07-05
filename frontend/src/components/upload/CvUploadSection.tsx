import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../ui/AppLogo'
import { useError } from '../../context/ErrorContext'
import {
  ApiError,
  analyzeCv,
  detectCvTitle,
  getCvText,
  getMyCVs,
  MAX_JOB_DESCRIPTION_CHARS,
  matchTitle,
  MIN_JOB_DESCRIPTION_CHARS,
  setCvFavorite,
  uploadPdf,
  type SavedCv,
  type TitleMatchSuggestion,
} from '../../services/api'
import FavoriteStarButton from '../cv/FavoriteStarButton'
import AdminNavLink from '../admin/AdminNavLink'
import ScanLoader from '../ui/ScanLoader'
import { isGibberish } from '../../utils/gibberishDetector'
import { looksLikeJobUrl } from '../../utils/jobUrl'
import {
  buildUploadDraftFromSession,
  readUploadDraft,
  writeUploadDraft,
  type CachedRoleDetection,
  type UploadDraft,
  type UploadJobInputMode,
} from '../../utils/uploadDraftCache'
import '../../pages/UploadScreen.css'

const PERSONALIZATION_INPUT_KEY = 'personalizationInput'
const RESULT_KEY = 'analysisResult'
const CV_EXTRACT_ERROR = 'Could not extract text from this PDF'
// Confidence is the normalised share of the top role among the top-3 candidates
// (see /cv/role). A dominant top-1 scores ~80-100; a genuine 2-way tie ~50-55.
// 60 auto-accepts clear detections and routes real ambiguities to manual choice.
const AUTO_MATCH_CONFIDENCE_MIN = 60

type JobInputMode = UploadJobInputMode

type UploadFieldErrors = {
  jobDescription?: string
  cv?: string
}

type RoleDetection =
  | { status: 'idle' | 'detecting' }
  | {
      status: 'ready'
      detectedTitle: string
      canonicalTitle: string
      confidence: number
      source?: 'title_extraction' | 'classifier' | 'llm_fallback'
    }
  | { status: 'uncertain'; detectedTitle: string; suggestions: TitleMatchSuggestion[] }
  | { status: 'not-found' | 'error' }

function jobDescriptionError(text: string, mode: JobInputMode): string | undefined {
  if (mode === 'cv-only') return undefined
  const trimmed = text.trim()
  if (!trimmed) return 'Paste a job description or posting link'
  if (looksLikeJobUrl(trimmed)) return undefined
  if (trimmed.length < MIN_JOB_DESCRIPTION_CHARS) {
    return `Minimum ${MIN_JOB_DESCRIPTION_CHARS} characters required`
  }
  return undefined
}

function isCvExtractFailure(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  const msg = err.message.toLowerCase()
  return (
    err.status === 422
    || msg.includes('pdf')
    || msg.includes('extract')
    || msg.includes('parse')
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export interface CvUploadSectionProps {
  visible?: boolean
  showBackLink?: boolean
}

const CvUploadSection = forwardRef<HTMLElement, CvUploadSectionProps>(function CvUploadSection(
  { visible = true },
  ref,
) {
  const { reportError } = useError()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const analysisInFlightRef = useRef(false)
  const draftRestoredRef = useRef(false)

  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [roleDetection, setRoleDetection] = useState<RoleDetection>({ status: 'idle' })
  const [manualTitleQuery, setManualTitleQuery] = useState('')
  const [manualTitleSuggestions, setManualTitleSuggestions] = useState<TitleMatchSuggestion[]>([])
  const [isManualTitleSearching, setIsManualTitleSearching] = useState(false)
  const [showManualOverride, setShowManualOverride] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<UploadFieldErrors>({})
  const [jobInputMode, setJobInputMode] = useState<JobInputMode>('posting')
  const [gibberishWarning, setGibberishWarning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [cvTab, setCvTab] = useState<'upload' | 'my-cvs'>('upload')
  const [savedCVs, setSavedCVs] = useState<SavedCv[]>([])
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null)
  const [selectedCvText, setSelectedCvText] = useState<string | null>(null)
  const [selectedCvName, setSelectedCvName] = useState<string | null>(null)
  const [cvsLoading, setCvsLoading] = useState(false)
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [favoritingId, setFavoritingId] = useState<string | null>(null)

  function snapshotUploadDraft(
    overrides: Partial<UploadDraft> = {},
  ): UploadDraft {
    return {
      jobDescription,
      jobInputMode,
      cvTab,
      saveToLibrary,
      selectedCvId,
      selectedCvName,
      cvText: selectedCvText,
      roleDetection: roleDetection as CachedRoleDetection,
      manualTitleQuery,
      showManualOverride,
      ...overrides,
    }
  }

  function persistUploadDraft(overrides: Partial<UploadDraft> = {}): void {
    writeUploadDraft(snapshotUploadDraft(overrides))
  }

  useEffect(() => {
    if (draftRestoredRef.current) return
    draftRestoredRef.current = true

    const draft = readUploadDraft() ?? buildUploadDraftFromSession()
    if (!draft) return

    setJobDescription(draft.jobDescription)
    setJobInputMode(draft.jobInputMode)
    setCvTab(draft.cvTab)
    setSaveToLibrary(draft.saveToLibrary)
    setSelectedCvId(draft.selectedCvId)
    setSelectedCvName(draft.selectedCvName)
    setSelectedCvText(draft.cvText)
    setManualTitleQuery(draft.manualTitleQuery ?? '')
    setShowManualOverride(draft.showManualOverride ?? false)

    if (draft.roleDetection.status === 'ready' || draft.roleDetection.status === 'uncertain') {
      setRoleDetection(draft.roleDetection)
    } else if (draft.cvText?.trim()) {
      void detectRole(draft.cvText)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, [])

  useEffect(() => {
    if (!draftRestoredRef.current) return
    const hasContent = Boolean(
      jobDescription.trim()
      || selectedCvText
      || cvFile
      || selectedCvId
      || roleDetection.status === 'ready'
      || roleDetection.status === 'uncertain',
    )
    if (!hasContent) return

    const timer = window.setTimeout(() => {
      persistUploadDraft()
    }, 400)
    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot via persistUploadDraft
  }, [
    jobDescription,
    jobInputMode,
    cvTab,
    saveToLibrary,
    selectedCvId,
    selectedCvName,
    selectedCvText,
    cvFile,
    roleDetection,
    manualTitleQuery,
    showManualOverride,
  ])

  useEffect(() => {
    if (cvTab !== 'my-cvs') return
    setCvsLoading(true)
    getMyCVs()
      .then(setSavedCVs)
      .catch((err) => reportError(err))
      .finally(() => setCvsLoading(false))
  }, [cvTab, reportError])

  useEffect(() => {
    if (roleDetection.status !== 'not-found' && !showManualOverride) return
    const title = manualTitleQuery.trim()
    if (title.length < 2) {
      setManualTitleSuggestions([])
      setIsManualTitleSearching(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsManualTitleSearching(true)
      matchTitle(title)
        .then(({ suggestions }) => {
          if (!cancelled) setManualTitleSuggestions(suggestions)
        })
        .catch((err) => {
          if (!cancelled) {
            setManualTitleSuggestions([])
            reportError(err)
          }
        })
        .finally(() => {
          if (!cancelled) setIsManualTitleSearching(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [manualTitleQuery, reportError, roleDetection.status, showManualOverride])

  const clearCvFieldError = () => {
    setFieldErrors((prev) => (prev.cv ? { ...prev, cv: undefined } : prev))
  }

  const resetRoleDetection = () => {
    setManualTitleQuery('')
    setManualTitleSuggestions([])
    setRoleDetection({ status: 'idle' })
  }

  async function detectRole(cvText: string, headerText?: string) {
    setRoleDetection({ status: 'detecting' })
    try {
      const detected = await detectCvTitle(cvText, headerText)
      const suggestions = detected.suggestions ?? []
      const bestMatch = suggestions[0]
      if (!bestMatch) {
        setRoleDetection({ status: 'not-found' })
        return
      }

      const detectedTitle = detected.detectedTitle ?? bestMatch.matchedVariant

      if (bestMatch.confidence < AUTO_MATCH_CONFIDENCE_MIN) {
        setRoleDetection({
          status: 'uncertain',
          detectedTitle,
          suggestions,
        })
        return
      }

      setRoleDetection({
        status: 'ready',
        detectedTitle,
        canonicalTitle: bestMatch.canonicalTitle,
        confidence: bestMatch.confidence,
        source: bestMatch.source ?? (detected.source === 'none' ? undefined : detected.source),
      })
    } catch (err) {
      setRoleDetection({ status: 'error' })
      reportError(err)
    }
  }

  // An LLM-fallback pick is a single constrained answer, not a similarity
  // score - showing "70% match" would misread as a real confidence number.
  function matchLabel(suggestion: TitleMatchSuggestion) {
    return suggestion.source === 'llm_fallback' ? (
      <span className="badge-ai" title="AI matched this from your CV (no similarity score to show)">
        AI matched
      </span>
    ) : (
      `${suggestion.confidence}% match`
    )
  }

  // suggestion always comes from the closed 59-title list (auto-detection
  // suggestions or /title/normalize search results) - never free text, so the
  // resulting canonicalTitle is always one the rest of the app can act on.
  function selectSuggestedRole(suggestion: TitleMatchSuggestion) {
    if (roleDetection.status !== 'uncertain' && roleDetection.status !== 'not-found') return
    setRoleDetection({
      status: 'ready',
      detectedTitle: roleDetection.status === 'uncertain'
        ? roleDetection.detectedTitle
        : manualTitleQuery.trim(),
      canonicalTitle: suggestion.canonicalTitle,
      confidence: suggestion.confidence,
      source: suggestion.source,
    })
    setShowManualOverride(false)
    setManualTitleQuery('')
    setManualTitleSuggestions([])
  }

  async function detectRoleFromFile(file: File) {
    try {
      const { cvText, headerText } = await uploadPdf(file, false)
      setSelectedCvText(cvText)
      await detectRole(cvText, headerText)
    } catch (err) {
      setRoleDetection({ status: 'error' })
      if (isCvExtractFailure(err)) {
        setFieldErrors((prev) => ({ ...prev, cv: CV_EXTRACT_ERROR }))
        return
      }
      reportError(err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setFieldErrors((prev) => ({ ...prev, cv: 'Please upload a PDF file' }))
      e.target.value = ''
      return
    }
    setCvFile(file)
    setSelectedCvId(null)
    setSelectedCvText(null)
    setSelectedCvName(null)
    resetRoleDetection()
    clearCvFieldError()
    void detectRoleFromFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setFieldErrors((prev) => ({ ...prev, cv: 'Please upload a PDF file' }))
      return
    }
    setCvFile(file)
    setSelectedCvId(null)
    setSelectedCvText(null)
    setSelectedCvName(null)
    resetRoleDetection()
    clearCvFieldError()
    void detectRoleFromFile(file)
  }

  async function handleSelectSavedCv(cv: SavedCv) {
    try {
      const { cvText, headerText } = await getCvText(cv.cvId)
      setSelectedCvId(cv.cvId)
      setSelectedCvText(cvText)
      setSelectedCvName(cv.fileName)
      setCvFile(null)
      resetRoleDetection()
      clearCvFieldError()
      await detectRole(cvText, headerText)
    } catch (err) {
      reportError(err)
    }
  }

  async function handleToggleFavorite(cv: SavedCv) {
    setFavoritingId(cv.cvId)
    try {
      const next = !cv.isFavorite
      await setCvFavorite(cv.cvId, next)
      setSavedCVs((prev) =>
        prev.map((item) => (item.cvId === cv.cvId ? { ...item, isFavorite: next } : item)),
      )
    } catch (err) {
      reportError(err)
    } finally {
      setFavoritingId(null)
    }
  }

  const trimmedJobDescription = jobDescription.trim()
  const isPostingMode = jobInputMode === 'posting'
  const isJobUrlInput = isPostingMode && looksLikeJobUrl(trimmedJobDescription)
  const hasEnoughDescription =
    !isPostingMode
    || isJobUrlInput
    || trimmedJobDescription.length >= MIN_JOB_DESCRIPTION_CHARS
  const hasGibberishDescription = useMemo(
    () =>
      isPostingMode
      && !isJobUrlInput
      && hasEnoughDescription
      && isGibberish(trimmedJobDescription),
    [hasEnoughDescription, isJobUrlInput, isPostingMode, trimmedJobDescription],
  )

  useEffect(() => {
    setGibberishWarning(hasGibberishDescription)
  }, [hasGibberishDescription])

  function switchJobInputMode(mode: JobInputMode) {
    setJobInputMode(mode)
    setGibberishWarning(false)
    setFieldErrors((prev) => ({ ...prev, jobDescription: undefined }))
  }

  const jdError = fieldErrors.jobDescription
  const hasCv = !!(cvFile || selectedCvText)

  function validateAnalysisForm(): boolean {
    if (isLoading || analysisInFlightRef.current || roleDetection.status !== 'ready') return false
    const nextErrors: UploadFieldErrors = {
      jobDescription: jobDescriptionError(jobDescription, jobInputMode),
      cv: hasCv ? undefined : 'Upload or select a CV to continue',
    }
    setFieldErrors(nextErrors)
    if (nextErrors.jobDescription || nextErrors.cv) return false
    if (hasGibberishDescription) {
      setGibberishWarning(true)
      return false
    }
    return true
  }

  async function resolveCvPayload(): Promise<{
    cvText: string
    cvFileName: string
    excludeCvId: string
  }> {
    let cvText: string
    let excludeCvId = selectedCvId ?? ''
    if (cvFile) {
      const upload = await uploadPdf(cvFile, saveToLibrary)
      cvText = upload.cvText
      if (saveToLibrary && upload.cvId) {
        excludeCvId = upload.cvId
      }
      if (saveToLibrary) getMyCVs().then(setSavedCVs).catch(() => { /* silent */ })
    } else {
      cvText = selectedCvText!
    }
    const cvFileName = cvFile ? cvFile.name : (selectedCvName ?? 'cv.pdf')
    return { cvText, cvFileName, excludeCvId }
  }

  function handleAnalysisError(err: unknown) {
    if (err instanceof ApiError && err.code === 'GIBBERISH_DETECTED') {
      setGibberishWarning(true)
      return
    }
    if (
      err instanceof ApiError
      && (err.code === 'VALIDATION' || err.code === 'UNPROCESSABLE' || err.status === 422)
      && isPostingMode
    ) {
      setFieldErrors((prev) => ({
        ...prev,
        jobDescription: err.message || jobDescriptionError(jobDescription, jobInputMode),
      }))
      return
    }
    if (isCvExtractFailure(err)) {
      setFieldErrors((prev) => ({ ...prev, cv: CV_EXTRACT_ERROR }))
      return
    }
    reportError(err)
  }

  const runStandardAnalysis = async () => {
    if (!validateAnalysisForm()) return
    analysisInFlightRef.current = true
    setIsLoading(true)
    try {
      const payload = await resolveCvPayload()
      if (roleDetection.status !== 'ready') return

      const { cvText, cvFileName, excludeCvId } = payload
      persistUploadDraft({
        cvText,
        selectedCvName: cvFileName,
        selectedCvId: excludeCvId || null,
        roleDetection: roleDetection as CachedRoleDetection,
      })
      const result = await analyzeCv(
        roleDetection.canonicalTitle,
        cvText,
        isPostingMode ? trimmedJobDescription : '',
        0.0,
        { skipGibberish: !isPostingMode, excludeCvId: excludeCvId || undefined },
      )
      sessionStorage.setItem(
        RESULT_KEY,
        JSON.stringify({ ...result, cvText, cvFileName }),
      )
      sessionStorage.setItem('jobDescription', isPostingMode ? trimmedJobDescription : '')
      sessionStorage.setItem('cvFileName', cvFileName)
      sessionStorage.setItem('excludeCvId', excludeCvId ?? '')
      sessionStorage.removeItem(PERSONALIZATION_INPUT_KEY)
      sessionStorage.removeItem('personalizationPreferences')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      handleAnalysisError(err)
    } finally {
      analysisInFlightRef.current = false
      setIsLoading(false)
    }
  }

  const goToPersonalize = async () => {
    if (!validateAnalysisForm()) return
    analysisInFlightRef.current = true
    setIsLoading(true)
    try {
      const payload = await resolveCvPayload()
      if (roleDetection.status !== 'ready') return

      const { cvText, cvFileName, excludeCvId } = payload
      sessionStorage.removeItem('personalizationPreferences')
      sessionStorage.removeItem('previousAnalysisResult')
      persistUploadDraft({
        cvText,
        selectedCvName: cvFileName,
        selectedCvId: excludeCvId || null,
        roleDetection: roleDetection as CachedRoleDetection,
      })
      sessionStorage.setItem(
        PERSONALIZATION_INPUT_KEY,
        JSON.stringify({
          canonicalTitle: roleDetection.canonicalTitle,
          detectedTitle: roleDetection.detectedTitle,
          cvText,
          cvFileName,
          jobDescription: isPostingMode ? trimmedJobDescription : '',
          isPostingMode,
          excludeCvId: excludeCvId || undefined,
        }),
      )
      navigate('/personalize', { replace: true })
    } catch (err) {
      handleAnalysisError(err)
    } finally {
      analysisInFlightRef.current = false
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runStandardAnalysis()
  }

  const activeCvName = cvFile ? cvFile.name : selectedCvName
  const canSubmit = isPostingMode
    ? hasCv && roleDetection.status === 'ready' && !jdError && !hasGibberishDescription
    : hasCv && roleDetection.status === 'ready'

  return (
    <section
      ref={ref}
      className={`upload-section${visible ? ' upload-section--visible' : ''}`}
    >
      {isLoading && <ScanLoader />}

      <div className="upload-wrapper">
        {/* App header: nav left, logo right */}
        <div className="upload-app-header">
          <div className="upload-app-nav">
            <Link to="/" className="btn-nav-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Home
            </Link>
            <Link to="/account" className="btn-nav-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Account
            </Link>
            <AdminNavLink className="btn-nav-pill btn-nav-pill--admin" />
          </div>
          <div className="step-indicator">
            <div className="step step--active">
              <div className="step-dot">1</div>
              <span className="step-label">Upload</span>
            </div>
            <div className="step-line" />
            <div className="step">
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

        <form onSubmit={handleSubmit} className="upload-card">
          <div className="upload-columns">
            <div className="upload-col">
              <div className="col-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h2>Resume <span className="field-required" aria-hidden="true">*</span></h2>
              </div>

              <div className="cv-tabs">
                <button
                  type="button"
                  className={`cv-tab${cvTab === 'upload' ? ' cv-tab--active' : ''}`}
                  onClick={() => setCvTab('upload')}
                >
                  Upload New CV
                </button>
                <button
                  type="button"
                  className={`cv-tab${cvTab === 'my-cvs' ? ' cv-tab--active' : ''}`}
                  onClick={() => setCvTab('my-cvs')}
                >
                  My CVs
                </button>
              </div>

              {cvTab === 'upload' && (
                <>
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="file-input-hidden" disabled={isLoading} />
                  {cvFile ? (
                    <>
                      <div className={`dropzone dropzone--selected${fieldErrors.cv ? ' dropzone--invalid' : ''}`}>
                        <div className="dropzone-check">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <p className="dropzone-filename">{cvFile.name}</p>
                        <p className="dropzone-meta">{formatFileSize(cvFile.size)} &middot; PDF</p>
                        <button type="button" className="btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>Change file</button>
                      </div>
                      <label className="save-toggle">
                        <input
                          type="checkbox"
                          checked={saveToLibrary}
                          onChange={(e) => setSaveToLibrary(e.target.checked)}
                          disabled={isLoading}
                        />
                        <span className="save-toggle-track" />
                        <span className="save-toggle-label">Save to My CV library</span>
                      </label>
                    </>
                  ) : (
                    <div
                      className={`dropzone${isDragging ? ' dropzone--drag' : ''}${fieldErrors.cv ? ' dropzone--invalid' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                    >
                      <div className="dropzone-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                      </div>
                      <p className="dropzone-primary">Drop your CV here</p>
                      <p className="dropzone-secondary">or <span className="dropzone-browse">browse</span> to upload &middot; PDF only</p>
                    </div>
                  )}
                  {fieldErrors.cv && cvTab === 'upload' && (
                    <span className="field-inline-error field-error--below">{fieldErrors.cv}</span>
                  )}
                </>
              )}

              {cvTab === 'my-cvs' && (
                <div className="saved-cvs">
                  {cvsLoading ? (
                    <p className="saved-cvs-empty">Loading...</p>
                  ) : savedCVs.length === 0 ? (
                    <p className="saved-cvs-empty">No saved CVs yet. Upload one first.</p>
                  ) : (
                    <ul className="saved-cvs-list">
                      {savedCVs.map((cv) => (
                        <li
                          key={cv.cvId}
                          className={`saved-cv-item${selectedCvId === cv.cvId ? ' saved-cv-item--selected' : ''}`}
                          onClick={() => handleSelectSavedCv(cv)}
                        >
                          <div className="saved-cv-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div className="saved-cv-info">
                            <p className="saved-cv-name">{cv.fileName}</p>
                            <p className="saved-cv-meta">{formatFileSize(cv.fileSizeBytes)} &middot; {formatDate(cv.uploadedAt)}</p>
                          </div>
                          <FavoriteStarButton
                            isFavorite={cv.isFavorite}
                            disabled={favoritingId === cv.cvId || isLoading}
                            onToggle={() => handleToggleFavorite(cv)}
                          />
                          {selectedCvId === cv.cvId && (
                            <svg className="saved-cv-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {activeCvName && cvTab === 'my-cvs' && (
                    <p className="selected-cv-label">Selected: <strong>{activeCvName}</strong></p>
                  )}
                  {fieldErrors.cv && (
                    <span className="field-inline-error field-error--below">{fieldErrors.cv}</span>
                  )}
                </div>
              )}
            </div>

            <div className="upload-divider" />

            <div className="upload-col">
              <div className="col-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                <h2>Job</h2>
              </div>

              <div className="field-group">
                <span className="field-label">Detected role</span>
                {roleDetection.status === 'idle' && (
                  <p className="detected-role detected-role--idle">Choose a CV to detect your role.</p>
                )}
                {roleDetection.status === 'detecting' && (
                  <p className="detected-role detected-role--loading">Detecting role from your CV...</p>
                )}
                {roleDetection.status === 'ready' && (
                  <div className="detected-role detected-role--ready">
                    <strong>{roleDetection.canonicalTitle}</strong>
                    <span>
                      {roleDetection.detectedTitle &&
                      roleDetection.detectedTitle !== roleDetection.canonicalTitle
                        ? `Detected as ${roleDetection.detectedTitle} · `
                        : ''}
                      {roleDetection.source === 'llm_fallback' ? (
                        <span className="badge-ai" title="AI matched this from your CV (no similarity score to show)">
                          AI matched
                        </span>
                      ) : (
                        `${roleDetection.confidence}% match`
                      )}
                    </span>
                  </div>
                )}
                {roleDetection.status === 'uncertain' && (
                  <div className="role-suggestions">
                    <p className="role-suggestions__hint">
                      We found {roleDetection.detectedTitle}. Choose the closest supported role.
                    </p>
                    <div className="role-suggestions__list" role="list">
                      {roleDetection.suggestions.map((suggestion) => (
                        <button
                          key={suggestion.canonicalTitle}
                          type="button"
                          className="role-suggestion"
                          onClick={() => selectSuggestedRole(suggestion)}
                          disabled={isLoading}
                        >
                          <span>{suggestion.canonicalTitle}</span>
                          <span>{matchLabel(suggestion)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {roleDetection.status === 'not-found' && (
                  <div className="role-search">
                    <p className="role-search__hint">We could not identify a role in this CV. Search for the closest supported role.</p>
                    <input
                      className="role-search__input"
                      type="search"
                      value={manualTitleQuery}
                      onChange={(e) => setManualTitleQuery(e.target.value)}
                      placeholder="Search a role"
                      disabled={isLoading}
                    />
                    {isManualTitleSearching && <p className="role-search__status">Searching...</p>}
                    {manualTitleSuggestions.length > 0 && (
                      <div className="role-suggestions__list" role="list">
                        {manualTitleSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.canonicalTitle}
                            type="button"
                            className="role-suggestion"
                            onClick={() => selectSuggestedRole(suggestion)}
                            disabled={isLoading}
                          >
                            <span>{suggestion.canonicalTitle}</span>
                            <span>{matchLabel(suggestion)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {roleDetection.status === 'error' && (
                  <p className="detected-role detected-role--error">Role detection is unavailable. Please try another CV.</p>
                )}

                {(roleDetection.status === 'ready'
                  || roleDetection.status === 'uncertain'
                  || roleDetection.status === 'error') && (
                  <div className="role-override">
                    {!showManualOverride ? (
                      <button
                        type="button"
                        className="role-override__toggle"
                        onClick={() => setShowManualOverride(true)}
                        disabled={isLoading}
                      >
                        Not the right role? Choose it manually
                      </button>
                    ) : (
                      <div className="role-search">
                        <p className="role-search__hint">Type your role and pick the closest supported match.</p>
                        <input
                          className="role-search__input"
                          type="search"
                          value={manualTitleQuery}
                          onChange={(e) => setManualTitleQuery(e.target.value)}
                          placeholder="e.g. Software Engineer"
                          disabled={isLoading}
                          autoFocus
                        />
                        {isManualTitleSearching && <p className="role-search__status">Searching...</p>}
                        {manualTitleSuggestions.length > 0 && (
                          <div className="role-suggestions__list" role="list">
                            {manualTitleSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.canonicalTitle}
                                type="button"
                                className="role-suggestion"
                                onClick={() => selectSuggestedRole(suggestion)}
                                disabled={isLoading}
                              >
                                <span>{suggestion.canonicalTitle}</span>
                                <span>{matchLabel(suggestion)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="role-override__cancel"
                          onClick={() => {
                            setShowManualOverride(false)
                            setManualTitleQuery('')
                            setManualTitleSuggestions([])
                          }}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="jd-mode-tabs" role="tablist" aria-label="Job analysis mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isPostingMode}
                  className={`jd-mode-tab${isPostingMode ? ' jd-mode-tab--active' : ''}`}
                  onClick={() => switchJobInputMode('posting')}
                  disabled={isLoading}
                >
                  Job description or URL
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isPostingMode}
                  className={`jd-mode-tab${!isPostingMode ? ' jd-mode-tab--active' : ''}`}
                  onClick={() => switchJobInputMode('cv-only')}
                  disabled={isLoading}
                >
                  CV only
                </button>
              </div>

              {isPostingMode ? (
                <div className="field-group field-group--grow">
                  <label className="field-label field-label--stacked" htmlFor="job-description">
                    <span>
                      Your Dream Job Posting <span className="field-required" aria-hidden="true">*</span>
                    </span>
                    <span className="field-hint">
                      Paste the full description or a job link. The backend fetches the posting when you analyze.
                    </span>
                  </label>
                  <textarea
                    id="job-description"
                    className={`field-textarea${jdError ? ' field-textarea--invalid' : ''}${gibberishWarning ? ' field-textarea--error' : ''}`}
                    value={jobDescription}
                    onChange={(e) => {
                      const value = e.target.value
                      setJobDescription(value)
                      setFieldErrors((prev) => ({
                        ...prev,
                        jobDescription: jobDescriptionError(value, 'posting'),
                      }))
                    }}
                    onBlur={() => {
                      setFieldErrors((prev) => ({
                        ...prev,
                        jobDescription: jobDescriptionError(jobDescription, 'posting'),
                      }))
                    }}
                    placeholder="Paste job description text, or a link like https://www.comeet.com/jobs/company/..."
                    disabled={isLoading}
                    required
                    maxLength={MAX_JOB_DESCRIPTION_CHARS}
                    minLength={MIN_JOB_DESCRIPTION_CHARS}
                    aria-invalid={!!jdError || gibberishWarning}
                    aria-describedby={
                      gibberishWarning
                        ? 'job-description-warning'
                        : jdError
                          ? 'job-description-error'
                          : undefined
                    }
                  />
                  <span className={`char-counter${jdError || gibberishWarning ? ' char-counter--warn' : ''}`}>
                    {isJobUrlInput ? 'Job link  will import on analyze' : `${jobDescription.length} / ${MAX_JOB_DESCRIPTION_CHARS}`}
                  </span>
                  {jdError && (
                    <span id="job-description-error" className="field-inline-error" role="alert">
                      {jdError}
                    </span>
                  )}
                  {gibberishWarning && (
                    <div id="job-description-warning" className="job-description-warning" role="alert">
                      <div className="job-description-warning__icon" aria-hidden="true">!</div>
                      <div className="job-description-warning__content">
                        <p className="job-description-warning__title">This description looks unreadable.</p>
                        <p className="job-description-warning__text">
                          Please replace it with a readable English job posting before analyzing.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="cv-only-mode-hint">
                  Score your CV against <strong>5 core skills</strong> for the selected role. No job posting needed.
                </p>
              )}
            </div>
          </div>

          <div className="upload-cta">
            <div className="upload-cta-actions">
              <button type="submit" className="btn-primary" disabled={!canSubmit || isLoading}>
                <span>{isLoading ? 'Analyzing…' : 'Analyse Match'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              <button
                type="button"
                className="btn-ghost btn-personalize-optional"
                disabled={!canSubmit || isLoading}
                onClick={() => void goToPersonalize()}
              >
                Customize recommendations
              </button>
            </div>
            {!canSubmit && !isLoading && !jdError && !fieldErrors.cv && (
              <p className="cta-hint">
                {!hasCv
                  ? 'Upload or select a CV to continue'
                  : roleDetection.status !== 'ready'
                    ? roleDetection.status === 'detecting'
                      ? 'Detecting your role'
                      : roleDetection.status === 'uncertain'
                        ? 'Choose a suggested role to continue'
                      : 'A detected role is required to continue'
                    : isPostingMode && hasGibberishDescription
                      ? 'Enter a readable English job description to continue'
                      : isPostingMode && !hasEnoughDescription
                        ? `Paste at least ${MIN_JOB_DESCRIPTION_CHARS} characters or a job link`
                        : null}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  )
})

export default CvUploadSection
