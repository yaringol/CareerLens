import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeCv, fetchJobs, uploadPdf, type PocJob } from '../services/api'
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
        if (list.length > 0) {
          setJobId(list[0].id)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load jobs')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type === 'application/pdf') {
        setCvFile(file)
      } else {
        alert('Please upload a PDF file')
        e.target.value = ''
      }
    }
  }

  const handleReplaceClick = () => {
    fileInputRef.current?.click()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cvFile) {
      alert('Please upload your CV')
      return
    }
    if (!jobId) {
      alert('Please select a job')
      return
    }
    if (jobDescription.trim().length < 40) {
      alert('Please paste the job description (at least 40 characters) for skill extraction')
      return
    }

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

  return (
    <div className="upload-screen">
      <div className="upload-container">
        <h1 className="app-title">Career Lens</h1>
        <p className="app-subtitle">Data-driven skill insights</p>

        <form onSubmit={handleSubmit} className="upload-form">
          <div className="upload-sections">
            <div className="upload-section">
              <div className="section-header">
                <span className="section-icon">📄</span>
                <h2 className="section-title">Upload Resume</h2>
              </div>
              <div
                className={`file-upload-area${cvFile ? ' file-upload-area--has-file' : ''}${
                  isLoading ? ' file-upload-area--loading' : ''
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="cv-upload"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className={cvFile ? 'file-input file-input--reveal' : 'file-input'}
                  disabled={isLoading}
                />
                {isLoading ? (
                  <div className="file-upload-display file-upload-display--loading" aria-live="polite">
                    <span className="upload-spinner" aria-hidden />
                    <span className="upload-text">Analyzing your CV…</span>
                    <span className="upload-hint">Scoring skills for the selected role</span>
                  </div>
                ) : cvFile ? (
                  <div className="file-upload-selected">
                    <div className="file-selected-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="40" height="40" fill="none">
                        <path
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="file-selected-title">Resume ready</p>
                    <p className="file-selected-name" title={cvFile.name}>
                      {cvFile.name}
                    </p>
                    <p className="file-selected-meta">{formatFileSize(cvFile.size)} · PDF</p>
                    <button
                      type="button"
                      className="file-replace-button"
                      onClick={handleReplaceClick}
                      disabled={isLoading}
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <div className="file-upload-display">
                    <span className="upload-icon">⬆</span>
                    <span className="upload-text">Drag & Drop CV</span>
                    <span className="upload-hint">or click to browse (PDF)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="upload-section upload-section--job">
              <div className="section-header">
                <span className="section-icon">💼</span>
                <h2 className="section-title">Select job</h2>
              </div>
              {loadError && <p className="textarea-hint" style={{ color: '#b91c1c' }}>{loadError}</p>}
              <select
                id="job-select"
                className="job-select"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={isLoading || jobs.length === 0}
                required
              >
                {jobs.length === 0 && !loadError ? (
                  <option value="">Loading jobs…</option>
                ) : (
                  jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))
                )}
              </select>
              <p className="textarea-hint">Choose one of five predefined roles for this POC.</p>

              <label htmlFor="job-description" className="job-description-label">
                Job description
              </label>
              <textarea
                id="job-description"
                className="job-description-textarea job-description-textarea--compact"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job posting (requirements, responsibilities, stack)…"
                rows={6}
                disabled={isLoading}
                required
                minLength={40}
              />
              <p className="textarea-hint">
                Dynamic skills are extracted from this text.
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="analyze-button"
            disabled={
              isLoading ||
              !cvFile ||
              !jobId ||
              jobDescription.trim().length < 40 ||
              !!loadError
            }
          >
            {isLoading ? 'Analyzing…' : 'Analyze Match →'}
          </button>

          {!isLoading && (
            <p className="instruction-text">
              {!cvFile
                ? 'Upload a PDF resume, pick a role, and paste a job description'
                : !jobId
                  ? 'Select a job, paste a job description, then analyze'
                  : jobDescription.trim().length < 40
                    ? 'Paste at least 40 characters of job description text'
                    : 'Click Analyze Match to see your score on the next screen'}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default UploadScreen
