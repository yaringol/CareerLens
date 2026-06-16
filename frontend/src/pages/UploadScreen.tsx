import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  analyzeCv,
  fetchJobs,
  uploadPdf,
  extractCvTitle,
  matchTitle,
  type PocJob,
  type ExtractTitleResponse,
  type TitleMatchResponse,
} from '../services/api'
import ScanLoader from '../components/ui/ScanLoader'
import './UploadScreen.css'

const RESULT_KEY = 'pocAnalysisResult'
const JD_KEY = 'pocJobDescription'
const CV_FILENAME_KEY = 'pocCvFileName'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const UploadScreen = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvText, setCvText] = useState<string | null>(null)       // cached from first upload
  const [cvId, setCvId] = useState<string | null>(null)           // saved CV id (from submit upload)
  const [isDragging, setIsDragging] = useState(false)
  const [jobs, setJobs] = useState<PocJob[]>([])
  const [jobId, setJobId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [detectedTitle, setDetectedTitle] = useState<ExtractTitleResponse | null>(null)
  const [titleMatches, setTitleMatches] = useState<TitleMatchResponse | null>(null)
  const [showTitleDropdown, setShowTitleDropdown] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)

  const [titleMatch, setTitleMatch] = useState(0.0)
  const [showPreferences, setShowPreferences] = useState(false)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTitleDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const handleFileChange = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }
    setCvFile(file)
    setCvText(null)
    setCvId(null)
    setDetectedTitle(null)
    setTitleMatches(null)
    setShowTitleDropdown(false)

    // Upload once (no save) — cache cvText, then detect title
    setIsDetecting(true)
    try {
      const uploaded = await uploadPdf(file, false)
      setCvText(uploaded.cvText)                // cache — reused on submit
      const result = await extractCvTitle(uploaded.cvText)
      setDetectedTitle(result)
    } catch {
      // title detection is optional — silent failure
    } finally {
      setIsDetecting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileChange(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileChange(file)
  }

  const handleOpenTitleDropdown = useCallback(async () => {
    setShowTitleDropdown(true)
    const titleToMatch = detectedTitle?.canonical_title
    if (!titleToMatch) return
    try {
      const result = await matchTitle(titleToMatch)
      setTitleMatches(result)
    } catch { /* silent */ }
  }, [detectedTitle])

  const handleTitleSelect = (canonical: string) => {
    setDetectedTitle((prev) =>
      prev ? { ...prev, canonical_title: canonical, low_confidence: false } : prev
    )
    setShowTitleDropdown(false)
  }

  const handleManualTitleInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (value.trim().length < 3) return
      try {
        const result = await matchTitle(value.trim())
        setTitleMatches(result)
        setShowTitleDropdown(true)
      } catch { /* silent */ }
    }, 300)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cvFile || !jobId || jobDescription.trim().length < 40) return
    setIsLoading(true)
    try {
      // Reuse cached cvText if available; otherwise upload + save now
      let text = cvText
      if (!text) {
        const uploaded = await uploadPdf(cvFile)
        text = uploaded.cvText
        setCvId(uploaded.cvId)
        setCvText(text)
      } else if (!cvId) {
        // cvText already fetched (no-save), now save it to library
        const saved = await uploadPdf(cvFile)
        setCvId(saved.cvId)
      }

      const result = await analyzeCv(jobId, text, jobDescription, titleMatch)
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({ ...result, cvText: text }))
      sessionStorage.setItem(JD_KEY, jobDescription.trim())
      sessionStorage.setItem(CV_FILENAME_KEY, cvFile.name)
      navigate('/dashboard')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = !!cvFile && !!jobId && jobDescription.trim().length >= 40 && !loadError

  const dataConfidence = (detectedTitle as (ExtractTitleResponse & { data_confidence?: string }) | null)
    ?.data_confidence

  return (
    <div className="upload-screen">
      {isLoading && <ScanLoader />}

      <div className="upload-wrapper">
        <header className="upload-header">
          <img src="/logo.png" alt="Career Lens" className="upload-logo" />
          <p className="upload-tagline">Data-driven skill insights</p>
        </header>

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

            {/* Left — CV upload */}
            <div className="upload-col">
              <div className="col-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h2>Resume</h2>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleInputChange}
                className="file-input-hidden"
                disabled={isLoading}
              />

              {cvFile ? (
                <div className="dropzone dropzone--selected">
                  <div className="dropzone-check">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="dropzone-filename">{cvFile.name}</p>
                  <p className="dropzone-meta">{formatFileSize(cvFile.size)} · PDF</p>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div
                  className={`dropzone${isDragging ? ' dropzone--drag' : ''}`}
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
                  <p className="dropzone-secondary">or <span className="dropzone-browse">browse</span> to upload · PDF only</p>
                </div>
              )}

              {/* Detected title section */}
              {isDetecting && (
                <p className="title-detect-status">Detecting your role…</p>
              )}

              {!isDetecting && detectedTitle?.canonical_title && (
                <div className="title-detect-badge" ref={dropdownRef}>
                  <span className="title-detect-label">
                    Detected role: <strong>{detectedTitle.canonical_title}</strong>
                    <span className="badge-auto">Auto-detected</span>
                  </span>
                  <div className="title-detect-actions">
                    <button type="button" className="btn-ghost btn-ghost--sm" onClick={handleOpenTitleDropdown}>
                      Change
                    </button>
                  </div>
                  {detectedTitle.low_confidence && (
                    <p className="title-detect-warning">
                      We're not sure we recognize this title — results may be less accurate
                    </p>
                  )}
                  {dataConfidence === 'low' && !detectedTitle.low_confidence && (
                    <p className="title-detect-warning title-detect-warning--info">
                      Limited data for this role — skill suggestions may be less precise
                    </p>
                  )}
                  {showTitleDropdown && titleMatches && (
                    <ul className="title-match-dropdown">
                      {titleMatches.matches.map((m) => (
                        <li key={m.canonical}>
                          <button type="button" onClick={() => handleTitleSelect(m.canonical)}>
                            {m.canonical}
                            <span className="match-confidence">{Math.round(m.confidence * 100)}%</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!isDetecting && cvFile && !detectedTitle?.canonical_title && (
                <div className="title-detect-manual" ref={dropdownRef}>
                  <label className="field-label" htmlFor="manual-title">Your current role (optional)</label>
                  <input
                    id="manual-title"
                    type="text"
                    className="field-input"
                    placeholder="e.g. Software Engineer"
                    onChange={(e) => handleManualTitleInput(e.target.value)}
                    disabled={isLoading}
                  />
                  {showTitleDropdown && titleMatches && (
                    <ul className="title-match-dropdown">
                      {titleMatches.matches.map((m) => (
                        <li key={m.canonical}>
                          <button type="button" onClick={() => handleTitleSelect(m.canonical)}>
                            {m.canonical}
                            <span className="match-confidence">{Math.round(m.confidence * 100)}%</span>
                          </button>
                        </li>
                      ))}
                    </ul>
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
                <select
                  id="job-select"
                  className="field-select"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  disabled={isLoading || jobs.length === 0}
                  required
                >
                  {jobs.length === 0 && !loadError
                    ? <option value="">Loading roles…</option>
                    : jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)
                  }
                </select>
              </div>

              <div className="field-group field-group--grow">
                <label className="field-label" htmlFor="job-description">
                  Job description
                  <span className="field-hint">Paste the full posting for best results</span>
                </label>
                <textarea
                  id="job-description"
                  className="field-textarea"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job posting - requirements, responsibilities, stack..."
                  disabled={isLoading}
                  required
                  minLength={40}
                />
              </div>

              <details
                className="preferences-section"
                open={showPreferences}
                onToggle={(e) => setShowPreferences((e.target as HTMLDetailsElement).open)}
              >
                <summary className="preferences-toggle">Customize skill priorities (optional)</summary>
                <div className="preferences-body">
                  <div className="slider-row">
                    <span className="slider-label-end">Most common</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={titleMatch}
                      onChange={(e) => setTitleMatch(Number(e.target.value))}
                      className="pref-slider"
                      disabled={isLoading}
                    />
                    <span className="slider-label-end">Role-specific</span>
                  </div>
                  <p className="slider-hint">
                    {titleMatch === 0
                      ? 'Showing the most common skills across all tech roles'
                      : titleMatch >= 0.8
                      ? 'Showing skills most specific to this role'
                      : 'Balanced between common and role-specific skills'}
                  </p>
                </div>
              </details>
            </div>
          </div>

          <div className="upload-cta">
            <button
              type="submit"
              className="btn-primary"
              disabled={!canSubmit || isLoading}
            >
              <span>Analyze Match</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            {!canSubmit && !isLoading && (
              <p className="cta-hint">
                {!cvFile ? 'Upload a PDF resume to continue'
                  : !jobId ? 'Select a role'
                  : 'Paste at least 40 characters of job description'}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default UploadScreen
