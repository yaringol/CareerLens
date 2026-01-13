import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    
    // Store data in sessionStorage for next pages
    sessionStorage.setItem('jobDescription', jobDescription)
    
    // In a real app, you would upload the file here
    setTimeout(() => {
      setIsLoading(false)
      navigate('/extract')
    }, 500)
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
                <div className="file-upload-display">
                  <span className="upload-icon">⬆</span>
                  <span className="upload-text">Drag & Drop CV</span>
                  <span className="upload-hint">or click to browse</span>
                </div>
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
              <p className="textarea-hint">Include required skills, qualifications, and responsibilities.</p>
            </div>
          </div>

          <button 
            type="submit" 
            className="analyze-button"
            disabled={isLoading || !cvFile || !jobDescription.trim()}
          >
            Analyze Match →
          </button>

          {(!cvFile || !jobDescription.trim()) && (
            <p className="instruction-text">Please upload a resume and provide a job description</p>
          )}
        </form>
      </div>
    </div>
  )
}

export default UploadScreen
