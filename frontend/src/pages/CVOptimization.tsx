import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CVOptimization.css'

const CVOptimization = () => {
  const navigate = useNavigate()
  const [improvedCV, setImprovedCV] = useState(`JOHN DOE
Senior Software Engineer | Data Solutions Specialist

PROFESSIONAL SUMMARY
Results-driven software engineer with 3+ years of expertise in data engineering and full-stack development. Proven track record of delivering scalable solutions using Python, SQL, and modern containerization technologies.

EXPERIENCE
ABC Company - Developer (2020-2023)
• Developed and maintained data pipelines processing 1M+ records daily
• Implemented RESTful APIs using Python and Flask, improving system performance by 40%
• Collaborated with cross-functional teams to deliver high-quality software solutions
• Utilized Docker for containerization, streamlining deployment processes

SKILLS
• Programming: Python (Advanced), SQL (Proficient)
• Tools & Technologies: Docker, Pandas, NumPy
• Data Engineering: ETL pipelines, Data visualization`)

  const originalCV = `JOHN DOE
Software Engineer

EXPERIENCE
ABC Company - Developer (2020-2023)
• Worked on various projects
• Used Python and SQL
• Helped team members

SKILLS
Python, SQL, Docker, Pandas`

  const improvements = [
    'Added professional summary highlighting 3+ years of experience',
    'Quantified achievements with specific metrics (1M+ records, 40% improvement)',
    'Reorganized skills section with proficiency levels',
    'Enhanced job descriptions with action verbs and quantifiable results',
  ]

  const handlePreviousPage = () => {
    navigate('/skill-details')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(improvedCV)
    alert('CV copied to clipboard!')
  }

  const handleDownloadPDF = () => {
    // In a real app, this would generate and download a PDF
    alert('PDF download functionality will be implemented with backend integration')
  }

  const handleApplyChanges = () => {
    // In a real app, this would save the changes
    alert('Changes applied! (This would save to backend in production)')
  }

  return (
    <div className="cv-optimization-page">
      <div className="optimization-container">
        {/* Page flow navigation */}
        <div className="page-flow-header">
          <button
            onClick={handlePreviousPage}
            className="flow-nav-button prev-button"
          >
            ← Previous
          </button>
          
          <div className="page-flow-dots">
            <div className="flow-dot" />
            <div className="flow-dot" />
            <div className="flow-dot" />
            <div className="flow-dot active" />
          </div>

          <div className="flow-nav-button next-button" style={{ visibility: 'hidden' }}>
            Next →
          </div>
        </div>

        <div className="optimization-content">
          <h1 className="page-title">CV Optimization</h1>

          <div className="cv-comparison">
            {/* Left: Before */}
            <div className="cv-panel before-panel">
              <div className="panel-header">
                <span className="panel-icon">📄</span>
                <h2 className="panel-title">Before (Read-Only)</h2>
              </div>
              <textarea
                className="cv-textarea before-textarea"
                value={originalCV}
                readOnly
                rows={20}
              />
            </div>

            {/* Right: Improved */}
            <div className="cv-panel improved-panel">
              <div className="panel-header">
                <span className="panel-icon">📄</span>
                <h2 className="panel-title">Improved Version (Editable)</h2>
              </div>
              <textarea
                className="cv-textarea improved-textarea"
                value={improvedCV}
                onChange={(e) => setImprovedCV(e.target.value)}
                rows={20}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button onClick={handleCopy} className="action-button copy-button">
              <span className="button-icon">📋</span>
              Copy
            </button>
            <button onClick={handleDownloadPDF} className="action-button download-button">
              <span className="button-icon">⬇</span>
              Download PDF
            </button>
            <button onClick={handleApplyChanges} className="action-button apply-button">
              <span className="button-icon">✓</span>
              Apply Changes
            </button>
          </div>

          {/* Key Improvements */}
          <div className="improvements-section">
            <h3 className="improvements-title">Key Improvements Applied:</h3>
            <ul className="improvements-list">
              {improvements.map((improvement, index) => (
                <li key={index} className="improvement-item">
                  <span className="check-icon">✓</span>
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CVOptimization
