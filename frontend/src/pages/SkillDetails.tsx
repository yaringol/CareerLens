import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CircularGauge from '../components/ui/CircularGauge'
import './SkillDetails.css'

interface SkillDeepDive {
  name: string
  score: number
  jobRequirements: string[]
  cvMentions: string[]
  strengths: string[]
  missingElements: string[]
}

const SkillDetails = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [currentSkill, setCurrentSkill] = useState<SkillDeepDive | null>(null)
  const [allSkills, setAllSkills] = useState<SkillDeepDive[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    // Mock data - in real app, this would come from API
    const mockSkills: SkillDeepDive[] = [
      {
        name: 'Data Visualization',
        score: 5,
        jobRequirements: [
          'Strong experience with data visualization tools',
          'Ability to build dashboards (Tableau/PowerBI)',
          'Experience creating executive-level reports',
          'Knowledge of best practices in data storytelling',
        ],
        cvMentions: [
          'Created charts using Matplotlib',
        ],
        strengths: [
          'Solid foundation in Python visualization libraries',
          'Regular reporting experience demonstrates consistency',
        ],
        missingElements: [
          'No experience with enterprise BI tools (Tableau/PowerBI)',
          'Limited evidence of executive-level reporting',
          'Missing data storytelling best practices',
        ],
      },
      {
        name: 'Python',
        score: 8,
        jobRequirements: [
          'Proficient in Python programming',
          'Experience with data analysis libraries',
          'Knowledge of Python frameworks',
        ],
        cvMentions: [
          '5+ years of Python development',
          'Extensive use of pandas and numpy',
          'Built REST APIs with Flask',
        ],
        strengths: [
          'Strong Python foundation',
          'Experience with relevant libraries',
        ],
        missingElements: [
          'Could emphasize more advanced Python patterns',
        ],
      },
    ]

    setAllSkills(mockSkills)
    
    // Get skill index from URL or default to 0
    const skillIndex = parseInt(searchParams.get('skill') || '0', 10)
    if (skillIndex >= 0 && skillIndex < mockSkills.length) {
      setCurrentIndex(skillIndex)
      setCurrentSkill(mockSkills[skillIndex])
    } else {
      setCurrentSkill(mockSkills[0])
    }
  }, [searchParams])

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      setCurrentSkill(allSkills[newIndex])
      navigate(`/skill-details?skill=${newIndex}`, { replace: true })
    }
  }

  const handleNext = () => {
    if (currentIndex < allSkills.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      setCurrentSkill(allSkills[newIndex])
      navigate(`/skill-details?skill=${newIndex}`, { replace: true })
    }
  }

  const handlePreviousPage = () => {
    navigate('/dashboard')
  }

  const handleNextPage = () => {
    navigate('/optimization')
  }

  if (!currentSkill) {
    return (
      <div className="skill-details-page">
        <div className="loading-container">
          <p>Loading skill details...</p>
        </div>
      </div>
    )
  }

  const getAlignmentLabel = () => {
    const percentage = (currentSkill.score / 10) * 100
    if (percentage >= 80) return 'Excellent Alignment'
    if (percentage >= 60) return 'Good Alignment'
    if (percentage >= 40) return 'Medium Alignment'
    return 'Low Alignment'
  }

  const getAlignmentColor = () => {
    const percentage = (currentSkill.score / 10) * 100
    if (percentage >= 80) return '#10b981'
    if (percentage >= 60) return '#3b82f6'
    if (percentage >= 40) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="skill-details-page">
      <div className="skill-details-container">
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
            <div className="flow-dot active" />
            <div className="flow-dot" />
          </div>

          <button
            onClick={handleNextPage}
            className="flow-nav-button next-button"
          >
            Next →
          </button>
        </div>

        <div className="skill-details-content">
          <h1 className="page-title">Skill Deep Dive</h1>
          <h2 className="skill-name">{currentSkill.name}</h2>

          <div className="skill-details-grid">
            {/* Left: Skill Indicator */}
            <div className="skill-indicator-section">
              <h3 className="section-title">Skill Indicator</h3>
              <CircularGauge score={currentSkill.score} maxScore={10} size={180} />
              <div
                className="alignment-label"
                style={{
                  backgroundColor: `${getAlignmentColor()}20`,
                  color: getAlignmentColor(),
                  borderColor: getAlignmentColor(),
                }}
              >
                {getAlignmentLabel()}
              </div>
            </div>

            {/* Middle: Comparison */}
            <div className="comparison-section">
              <h3 className="section-title">Comparison</h3>
              <div className="comparison-content">
                <div className="comparison-column">
                  <div className="comparison-header">
                    <span className="comparison-icon job-icon">ℹ️</span>
                    <h4 className="comparison-title">Job Requirement:</h4>
                  </div>
                  <ul className="comparison-list">
                    {currentSkill.jobRequirements.map((req, index) => (
                      <li key={index} className="comparison-item">{req}</li>
                    ))}
                  </ul>
                </div>
                <div className="comparison-column">
                  <div className="comparison-header">
                    <span className="comparison-icon cv-icon">✓</span>
                    <h4 className="comparison-title">Your CV Mentions:</h4>
                  </div>
                  <ul className="comparison-list">
                    {currentSkill.cvMentions.length > 0 ? (
                      currentSkill.cvMentions.map((mention, index) => (
                        <li key={index} className="comparison-item">{mention}</li>
                      ))
                    ) : (
                      <li className="comparison-item empty">No specific mentions found</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: Gap Analysis */}
            <div className="gap-analysis-section">
              <h3 className="section-title">Gap Analysis</h3>
              {currentSkill.strengths.length > 0 && (
                <div className="strengths-box">
                  {currentSkill.strengths.map((strength, index) => (
                    <div key={index} className="gap-item strength">
                      <span className="gap-icon">✓</span>
                      <span className="gap-text">{strength}</span>
                    </div>
                  ))}
                </div>
              )}
              {currentSkill.missingElements.length > 0 && (
                <div className="missing-box">
                  {currentSkill.missingElements.map((missing, index) => (
                    <div key={index} className="gap-item missing">
                      <span className="gap-icon">⚠️</span>
                      <span className="gap-text">{missing}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Skill navigation */}
          <div className="skill-navigation">
            <button
              onClick={handlePrevious}
              className="skill-nav-button"
              disabled={currentIndex === 0}
            >
              ← Previous Skill
            </button>
            <span className="skill-counter">
              {currentIndex + 1} / {allSkills.length}
            </span>
            <button
              onClick={handleNext}
              className="skill-nav-button"
              disabled={currentIndex === allSkills.length - 1}
            >
              Next Skill →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SkillDetails
