import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useError } from '../../context/ErrorContext'
import {
  analyzeCv,
  ApiError,
  fetchJobs,
  getCvText,
  getMyCVs,
  MAX_JOB_DESCRIPTION_CHARS,
  MIN_JOB_DESCRIPTION_CHARS,
  uploadPdf,
  type PocJob,
  type SavedCv,
} from '../../services/api'
import ScanLoader from '../ui/ScanLoader'
import { isGibberish } from '../../utils/gibberishDetector'
import { looksLikeJobUrl } from '../../utils/jobUrl'
import '../../pages/UploadScreen.css'

const RESULT_KEY = 'pocAnalysisResult'
const CV_EXTRACT_ERROR = 'Could not extract text from this PDF'

type JobInputMode = 'posting' | 'cv-only'

type UploadFieldErrors = {
  jobDescription?: string
  cv?: string
}

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
  { visible = true, showBackLink = false },
  ref,
) {
  const { reportError } = useError()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [jobs, setJobs] = useState<PocJob[]>([])
  const [jobId, setJobId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<UploadFieldErrors>({})
  const [jobInputMode, setJobInputMode] = useState<JobInputMode>('posting')
  const [gibberishWarning, setGibberishWarning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cvTab, setCvTab] = useState<'upload' | 'my-cvs'>('upload')
  const [savedCVs, setSavedCVs] = useState<SavedCv[]>([])
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null)
  const [selectedCvText, setSelectedCvText] = useState<string | null>(null)
  const [selectedCvName, setSelectedCvName] = useState<string | null>(null)
  const [cvsLoading, setCvsLoading] = useState(false)
  const [saveToLibrary, setSaveToLibrary] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchJobs()
        if (cancelled) return
        setJobs(list)
        if (list.length > 0) setJobId(list[0].id)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load jobs')
          reportError(e)
        }
      }
    })()
    return () => { cancelled = true }
  }, [reportError])

  useEffect(() => {
    if (cvTab !== 'my-cvs') return
    setCvsLoading(true)
    getMyCVs()
      .then(setSavedCVs)
      .catch((err) => reportError(err))
      .finally(() => setCvsLoading(false))
  }, [cvTab, reportError])

  const clearCvFieldError = () => {
    setFieldErrors((prev) => (prev.cv ? { ...prev, cv: undefined } : prev))
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
    clearCvFieldError()
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
    clearCvFieldError()
  }

  async function handleSelectSavedCv(cv: SavedCv) {
    try {
      const { cvText } = await getCvText(cv.cvId)
      setSelectedCvId(cv.cvId)
      setSelectedCvText(cvText)
      setSelectedCvName(cv.fileName)
      setCvFile(null)
      clearCvFieldError()
    } catch (err) {
      reportError(err)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: UploadFieldErrors = {
      jobDescription: jobDescriptionError(jobDescription, jobInputMode),
      cv: hasCv ? undefined : 'Upload or select a CV to continue',
    }
    setFieldErrors(nextErrors)
    if (nextErrors.jobDescription || nextErrors.cv || !jobId) return
    if (hasGibberishDescription) {
      setGibberishWarning(true)
      return
    }
    setIsLoading(true)
    try {
      let cvText: string
      if (cvFile) {
        const upload = await uploadPdf(cvFile, saveToLibrary)
        cvText = upload.cvText
        if (saveToLibrary) getMyCVs().then(setSavedCVs).catch(() => { /* silent */ })
      } else {
        cvText = selectedCvText!
      }
      const result = await analyzeCv(
        jobId,
        cvText,
        isPostingMode ? trimmedJobDescription : '',
        { skipGibberish: !isPostingMode },
      )
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(result))
      navigate('/dashboard', { replace: true })
    } catch (err) {
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
    } finally {
      setIsLoading(false)
    }
  }

  const activeCvName = cvFile ? cvFile.name : selectedCvName
  const canSubmit = isPostingMode
    ? hasCv && !!jobId && !jdError && !hasGibberishDescription && !loadError
    : hasCv && !!jobId && !loadError

  return (
    <section
      ref={ref}
      className={`upload-section${visible ? ' upload-section--visible' : ''}`}
    >
      {isLoading && <ScanLoader />}

      <div className="upload-wrapper">
        {showBackLink && (
          <nav className="upload-page-nav">
            <Link to="/" className="upload-page-nav-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to home
            </Link>
          </nav>
        )}

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

              {loadError && <p className="field-error">{loadError}</p>}

              <div className="field-group">
                <label className="field-label" htmlFor="job-select">
                  Role <span className="field-required" aria-hidden="true">*</span>
                </label>
                <select id="job-select" className="field-select" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={isLoading || jobs.length === 0} required>
                  {jobs.length === 0 && !loadError
                    ? <option value="">Loading roles...</option>
                    : jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
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
                      Paste the full description or a job link - the backend fetches the posting when you analyze.
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
                    {isJobUrlInput ? 'Job link ù will import on analyze' : `${jobDescription.length} / ${MAX_JOB_DESCRIPTION_CHARS}`}
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
                  Score your CV against <strong>5 core skills</strong> for the selected role - no job posting needed.
                </p>
              )}
            </div>
          </div>

          <div className="upload-cta">
            <button type="submit" className="btn-primary" disabled={!canSubmit || isLoading}>
              <span>Analyze Match</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            {!canSubmit && !isLoading && !jdError && !fieldErrors.cv && (
              <p className="cta-hint">
                {!hasCv
                  ? 'Upload or select a CV to continue'
                  : !jobId
                    ? 'Select a role'
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
