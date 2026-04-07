import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadCVAndJobDescription } from '../services/api'
import './UploadScreen.css'

const UploadScreen = () => {
  const navigate = useNavigate()
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cvFile) {
      alert('Please upload your CV')
      return
    }

    if (!jobDescription.trim()) {
      alert('Please enter a job description')
      return
    }

    setIsLoading(true)

    sessionStorage.setItem('jobDescription', jobDescription)

    try {
      const response = await uploadCVAndJobDescription(cvFile, jobDescription)

      sessionStorage.setItem('jobId', response.jobId)
      sessionStorage.setItem('analysisStatus', response.status)

      navigate('/extract')
    } catch (error) {
      console.error('Failed to upload CV and job description:', error)
      alert('Failed to analyze match. Please try again.')
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

            {/* Left: Upload Resume */}
            <div className="upload-section">
              <div className="section-header">
                <span className="section-icon">📄</span>
                <h2 className="section-title">Upload Resume</h2>
              </div>

              <div className="file-upload-area">
                <input
                  type="file"
                  id="cv-upload"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="file-input"
                  disabled={isLoading}
                />

                <label htmlFor="cv-upload" className="file-upload-display">
                  <span className="upload-icon">⬆</span>
                  <span className="upload-text">
                    {cvFile ? cvFile.name : 'Drag & Drop CV'}
                  </span>
                  <span className="upload-hint">
                    {cvFile ? 'PDF selected' : 'or click to browse'}
                  </span>
                </label>
              </div>
            </div>

            {/* Right: Job Description */}
            <div className="upload-section">
              <div className="section-header">
                <span className="section-icon">💼</span>
                <h2 className="section-title">Job Description</h2>
              </div>

              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste job description here..."
                className="job-description-textarea"
                rows={12}
                disabled={isLoading}
                required
              />

              <p className="textarea-hint">
                Include required skills, qualifications, and responsibilities.
              </p>
            </div>

          </div>

          <button
            type="submit"
            className="analyze-button"
            disabled={isLoading || !cvFile || !jobDescription.trim()}
          >
            {isLoading ? 'Analyzing...' : 'Analyze Match →'}
          </button>

          {(!cvFile || !jobDescription.trim()) && (
            <p className="instruction-text">
              Please upload a resume and provide a job description
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default UploadScreen