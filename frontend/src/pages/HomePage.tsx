import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ApiError, analyzeCv, fetchJobs, uploadPdf, getMyCVs, getCvText, type PocJob, type SavedCv } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import ShaderBackground from '../components/ui/ShaderBackground'
import ScanLoader from '../components/ui/ScanLoader'
import { isGibberish } from '../utils/gibberishDetector'
import './HomePage.css'
import './UploadScreen.css'

const RESULT_KEY = 'pocAnalysisResult'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const HomePage = () => {
  const navigate    = useNavigate()
  const [params]    = useSearchParams()
  const uploadRef   = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { logout, user } = useAuth()
  const { showToast } = useToast()

  // Upload form state
  const [cvFile, setCvFile]               = useState<File | null>(null)
  const [isDragging, setIsDragging]       = useState(false)
  const [jobs, setJobs]                   = useState<PocJob[]>([])
  const [jobId, setJobId]                 = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [isLoading, setIsLoading]         = useState(false)
  const [loadError, setLoadError]         = useState<string | null>(null)
  const [uploadVisible, setUploadVisible] = useState(false)
  const [gibberishWarning, setGibberishWarning] = useState(false)

  const trimmedJobDescription = jobDescription.trim()
  const hasEnoughDescription = trimmedJobDescription.length >= 40
  const hasGibberishDescription = useMemo(
    () => hasEnoughDescription && isGibberish(trimmedJobDescription),
    [hasEnoughDescription, trimmedJobDescription]
  )

  // CV library state
  const [cvTab, setCvTab]           = useState<'upload' | 'my-cvs'>('upload')
  const [savedCVs, setSavedCVs]     = useState<SavedCv[]>([])
  const [selectedCvId, setSelectedCvId] = useState<string | null>(null)
  const [selectedCvText, setSelectedCvText] = useState<string | null>(null)
  const [selectedCvName, setSelectedCvName] = useState<string | null>(null)
  const [cvsLoading, setCvsLoading] = useState(false)
  const [saveToLibrary, setSaveToLibrary] = useState(true)

  // Fetch jobs on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchJobs()
        if (cancelled) return
        setJobs(list)
        if (list.length > 0) setJobId(list[0].id)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load jobs')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Jump to upload section if ?step=upload
  useEffect(() => {
    if (params.get('step') === 'upload') {
      setUploadVisible(true)
      setTimeout(() => uploadRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [params])

  // Intersection observer for upload section entrance (only if not forced visible)
  useEffect(() => {
    if (params.get('step') === 'upload') return
    const el = uploadRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setUploadVisible(true) },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [params])

  // Load saved CVs when switching to My CVs tab
  useEffect(() => {
    if (cvTab !== 'my-cvs') return
    setCvsLoading(true)
    getMyCVs()
      .then(setSavedCVs)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Could not load CVs'))
      .finally(() => setCvsLoading(false))
  }, [cvTab])

  const scrollToUpload = () =>
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { showToast('Please upload a PDF file'); e.target.value = ''; return }
    setCvFile(file)
    setSelectedCvId(null)
    setSelectedCvText(null)
    setSelectedCvName(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { showToast('Please upload a PDF file'); return }
    setCvFile(file)
    setSelectedCvId(null)
    setSelectedCvText(null)
    setSelectedCvName(null)
  }

  async function handleSelectSavedCv(cv: SavedCv) {
    try {
      const { cvText } = await getCvText(cv.cvId)
      setSelectedCvId(cv.cvId)
      setSelectedCvText(cvText)
      setSelectedCvName(cv.fileName)
      setCvFile(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load CV')
    }
  }

  const saveResultAndNavigate = (result: Awaited<ReturnType<typeof analyzeCv>>) => {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result))
    navigate('/dashboard')
  }

  const runAnalysis = async (cvText: string) => {
    const result = await analyzeCv(jobId, cvText, jobDescription)
    saveResultAndNavigate(result)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hasFile = cvFile || selectedCvText
    if (!hasFile || !jobId || !hasEnoughDescription) return
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
        if (saveToLibrary) getMyCVs().then(setSavedCVs).catch(() => { /* silent — list refresh is best-effort */ })
      } else {
        cvText = selectedCvText!
      }
      await runAnalysis(cvText)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'GIBBERISH_DETECTED') {
        setGibberishWarning(true)
        return
      }
      showToast(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setGibberishWarning(hasGibberishDescription)
  }, [hasGibberishDescription])

  const activeCvName = cvFile ? cvFile.name : selectedCvName
  const canSubmit = !!(cvFile || selectedCvText) && !!jobId && hasEnoughDescription && !hasGibberishDescription && !loadError

  return (
    <div className="home-page">
      {isLoading && <ScanLoader />}

      {/* ── Hero section ────────────────────────────────────────── */}
      <section className="hero">
        <ShaderBackground />

        <div className="hero-content">
          <div className="hero-badge">DS-Powered Resume Analysis</div>
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

          {/* CL-6: Updated headline */}
          <h1 className="hero-headline">Does your CV match today's job market?</h1>
          <p className="hero-subheadline">
            CareerLens uses a data-science model to extract the key skills from any job posting<br />
            and score your CV against them — so you know exactly what to improve.
          </p>

          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={scrollToUpload}>
              Start Analyzing
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
            </button>
            <Link to="/account" className="btn-hero-logout">My Account</Link>
            <button className="btn-hero-logout" onClick={() => { logout(); navigate('/login') }} title="Sign out">Sign out</button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">5</span>
              <span className="hero-stat-label">Global skills</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">5</span>
              <span className="hero-stat-label">Your job skills</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">DS</span>
              <span className="hero-stat-label">Powered</span>
            </div>
          </div>

          {user && (
            <p className="hero-welcome">Signed in as <strong>{user.email}</strong></p>
          )}
        </div>

        <button className="scroll-indicator" onClick={scrollToUpload} aria-label="Scroll to upload form">
          <span className="scroll-indicator-text">Analyze your CV</span>
          <div className="scroll-chevron">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>
      </section>

      {/* ── CL-6: How It Works ─────────────────────────────────── */}
      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="hiw-steps">
          <div className="hiw-step">
            <div className="hiw-step-num">1</div>
            <div className="hiw-step-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 className="hiw-step-title">Upload CV</h3>
            <p className="hiw-step-desc">Drop your resume PDF. We extract the text and build your skill profile.</p>
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
            <p className="hiw-step-desc">See your match percentage per skill and know exactly what to add to your CV.</p>
          </div>
        </div>
      </section>

      {/* ── CL-6: Why CareerLens ───────────────────────────────── */}
      <section className="why-careerlens">
        <h2 className="section-title">Why CareerLens</h2>
        <div className="why-grid">
          <div className="why-card">
            <div className="why-pain">Sending dozens of applications with no responses?</div>
            <div className="why-solution">CareerLens shows you the skill gaps recruiters see — before you apply.</div>
          </div>
          <div className="why-card">
            <div className="why-pain">Generic feedback from resume tools that ignore the actual job?</div>
            <div className="why-solution">We score your CV against the specific posting you want, not a generic template.</div>
          </div>
          <div className="why-card">
            <div className="why-pain">Not sure which skills to highlight or add?</div>
            <div className="why-solution">Get a per-skill breakdown so you can prioritise exactly what to improve.</div>
          </div>
        </div>
      </section>

      {/* ── Upload section ───────────────────────────────────────── */}
      <section
        ref={uploadRef}
        className={`upload-section${uploadVisible ? ' upload-section--visible' : ''}`}
      >
        <div className="upload-wrapper">
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

              {/* Left — CV */}
              <div className="upload-col">
                <div className="col-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <h2>Resume</h2>
                </div>

                {/* CL-18: CV tabs */}
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
                        <div className="dropzone dropzone--selected">
                          <div className="dropzone-check">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <p className="dropzone-filename">{cvFile.name}</p>
                          <p className="dropzone-meta">{formatFileSize(cvFile.size)} · PDF</p>
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
                        className={`dropzone${isDragging ? ' dropzone--drag' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      >
                        <div className="dropzone-icon">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                        </div>
                        <p className="dropzone-primary">Drop your CV here</p>
                        <p className="dropzone-secondary">or <span className="dropzone-browse">browse</span> to upload · PDF only</p>
                      </div>
                    )}
                  </>
                )}

                {cvTab === 'my-cvs' && (
                  <div className="saved-cvs">
                    {cvsLoading ? (
                      <p className="saved-cvs-empty">Loading…</p>
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
                              <p className="saved-cv-meta">{formatFileSize(cv.fileSizeBytes)} · {formatDate(cv.uploadedAt)}</p>
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
                  </div>
                )}
              </div>

              <div className="upload-divider" />

              {/* Right — Job */}
              <div className="upload-col">
                <div className="col-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                  <h2>Job</h2>
                </div>

                {loadError && <p className="field-error">{loadError}</p>}

                <div className="field-group">
                  <label className="field-label" htmlFor="job-select">Role</label>
                  <select id="job-select" className="field-select" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={isLoading || jobs.length === 0} required>
                    {jobs.length === 0 && !loadError
                      ? <option value="">Loading roles…</option>
                      : jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                </div>

                {/* CL-6 + 3.2: updated label, placeholder, hint */}
                <div className="field-group field-group--grow">
                  <label className="field-label" htmlFor="job-description">
                    Your Dream Job Posting
                    <span className="field-hint">Found the job? Copy the full description from LinkedIn / company site and paste here.</span>
                  </label>
                  <textarea
                    id="job-description"
                    className={`field-textarea${gibberishWarning ? ' field-textarea--error' : ''}`}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description of the position you want to get hired for. We'll score your CV against it and show exactly what to improve."
                    disabled={isLoading}
                    required
                    maxLength={700}
                    minLength={40}
                    aria-invalid={gibberishWarning}
                    aria-describedby={gibberishWarning ? 'job-description-warning' : undefined}
                  />
                  <span className="char-counter">{jobDescription.length} / 700</span>
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
                  {jobDescription.length > 0 && jobDescription.length < 40 && (
                    <span className="field-inline-error">Minimum 40 characters required</span>
                  )}
                </div>
              </div>
            </div>

            <div className="upload-cta">
              <button type="submit" className="btn-primary" disabled={!canSubmit || isLoading}>
                <span>Analyze Match</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              {!canSubmit && !isLoading && (
                <p className="cta-hint">
                  {!(cvFile || selectedCvText)
                    ? 'Upload or select a CV to continue'
                    : !jobId
                      ? 'Select a role'
                      : hasGibberishDescription
                        ? 'Enter a readable English job description to continue'
                        : 'Paste at least 40 characters of job description'}
                </p>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

export default HomePage
