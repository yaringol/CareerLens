import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeCv, fetchJobs, uploadPdf, type PocJob } from '../services/api'
import ScanLoader from '../components/ui/ScanLoader'
import './UploadScreen.css'

const RESULT_KEY = 'pocAnalysisResult'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const UploadScreen = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [jobs, setJobs] = useState<PocJob[]>([])
  const [jobId, setJobId] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      e.target.value = ''
      return
    }
    setCvFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { alert('Please upload a PDF file'); return }
    setCvFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cvFile || !jobId || jobDescription.trim().length < 40) return
    setIsLoading(true)
    try {
      const { cvText } = await uploadPdf(cvFile)
      const result = await analyzeCv(jobId, cvText, jobDescription)
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(result))
      navigate('/dashboard')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = !!cvFile && !!jobId && jobDescription.trim().length >= 40 && !loadError

  return (
    <div className="upload-screen">
      {isLoading && <ScanLoader />}

      <div className="upload-wrapper">
        {/* Header */}
        <header className="upload-header">
          <img src="/logo.png" alt="Career Lens" className="upload-logo" />
          <p className="upload-tagline">Data-driven skill insights</p>
        </header>

        {/* Step indicator */}
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

        {/* Form card */}
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
                onChange={handleFileChange}
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
            </div>

            {/* Divider */}
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
            </div>
          </div>

          {/* CTA */}
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
