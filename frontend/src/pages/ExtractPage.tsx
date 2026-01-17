import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ExtractPage.css'

const ExtractPage = () => {
  const navigate = useNavigate()
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    // Simulate extraction process
    const steps = [
      { name: 'Parsing CV...', progress: 20 },
      { name: 'Extracting skills from CV...', progress: 40 },
      { name: 'Analyzing job description...', progress: 60 },
      { name: 'Extracting required skills...', progress: 80 },
      { name: 'Calculating match scores...', progress: 100 },
    ]

    let currentStepIndex = 0

    const interval = setInterval(() => {
      if (currentStepIndex < steps.length) {
        setCurrentStep(steps[currentStepIndex].name)
        setExtractionProgress(steps[currentStepIndex].progress)
        currentStepIndex++
      } else {
        setIsComplete(true)
        clearInterval(interval)
        // Navigate to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard')
        }, 1500)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [navigate])

  return (
    <div className="extract-page">
      <div className="extract-container">
        {/* Page flow navigation dots */}
        <div className="page-flow-header">
          <div className="flow-nav-button prev-button" style={{ visibility: 'hidden' }}>
            ← Previous
          </div>
          
          <div className="page-flow-dots">
            <div className="flow-dot" />
            <div className="flow-dot active" />
            <div className="flow-dot" />
            <div className="flow-dot" />
          </div>

          <div className="flow-nav-button next-button" style={{ visibility: 'hidden' }}>
            Next →
          </div>
        </div>

        <h2 className="page-title">Analyzing Your CV</h2>
        <p className="page-subtitle">We're processing your CV and job description to extract skills and calculate match scores</p>

        <div className="extraction-content">
          <div className="progress-section">
            <div className="progress-circle-container">
              <svg className="progress-circle" viewBox="0 0 120 120">
                <circle
                  className="progress-circle-bg"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  className="progress-circle-fill"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#667eea"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - extractionProgress / 100)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="progress-percentage">
                <span className="percentage-value">{extractionProgress}%</span>
              </div>
            </div>
          </div>

          <div className="steps-section">
            <div className="current-step">
              <div className={`step-icon ${isComplete ? 'complete' : ''}`}>
                {isComplete ? '✓' : '⟳'}
              </div>
              <div className="step-content">
                <p className="step-name">{isComplete ? 'Analysis Complete!' : currentStep}</p>
                {isComplete && (
                  <p className="step-description">Redirecting to results...</p>
                )}
              </div>
            </div>
          </div>

          <div className="extraction-details">
            <div className="detail-item">
              <span className="detail-label">CV Skills:</span>
              <span className="detail-value">Extracting...</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Job Requirements:</span>
              <span className="detail-value">Analyzing...</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Match Score:</span>
              <span className="detail-value">Calculating...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExtractPage
