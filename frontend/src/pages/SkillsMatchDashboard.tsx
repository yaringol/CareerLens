import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CircularGauge from '../components/ui/CircularGauge'
import SkillBar from '../components/ui/SkillBar'
import type { AnalyzeResponse } from '../services/api'
import './SkillsMatchDashboard.css'

const RESULT_KEY = 'pocAnalysisResult'

const SkillsMatchDashboard = () => {
  const navigate = useNavigate()
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(RESULT_KEY)
    if (!raw) {
      navigate('/upload', { replace: true })
      return
    }
    try {
      setResult(JSON.parse(raw) as AnalyzeResponse)
    } catch {
      setParseError('Invalid results data')
    }
  }, [navigate])

  const handleBackToUpload = () => {
    sessionStorage.removeItem(RESULT_KEY)
    navigate('/upload')
  }

  if (parseError) {
    return (
      <div className="skills-match-dashboard">
        <div className="dashboard-container">
          <p>{parseError}</p>
          <button type="button" className="flow-nav-button back-button" onClick={handleBackToUpload}>
            ← Back to Upload
          </button>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="skills-match-dashboard">
        <div className="dashboard-container">
          <p>Loading…</p>
        </div>
      </div>
    )
  }

  const coreSkills = result.skills.slice(0, 5)
  const dynamicSkills = result.skills.slice(5, 10)
  const matchPercent = Math.round((result.matchScore / 10) * 100)

  return (
    <div className="skills-match-dashboard">
      <div className="dashboard-container">
        <div className="page-flow-header">
          <button
            type="button"
            onClick={handleBackToUpload}
            className="flow-nav-button back-button"
          >
            ← Back to Upload
          </button>

          <div className="page-flow-dots">
            <div className="flow-dot active" />
            <div className="flow-dot active" />
            <div className="flow-dot active" />
          </div>

          <div className="flow-nav-button next-button" style={{ visibility: 'hidden' }} aria-hidden>
            Next →
          </div>
        </div>

        <div className="match-overview-card">
          <h2 className="match-overview-title">{result.jobTitle}</h2>

          <div className="match-content">
            <div className="overall-score-section">
              <div className="score-display">
                <CircularGauge score={result.matchScore} maxScore={10} size={200} />
                <div className="match-score-caption">
                  <div className="match-score-caption__title">Match score</div>
                  <div className="match-score-caption__percent">{matchPercent}%</div>
                </div>
              </div>
            </div>

            <div className="skills-breakdown">
              <div className="skills-column">
                <h3 className="skills-column-title">Core skills (5)</h3>
                <div className="skills-list">
                  {coreSkills.map((skill) => (
                    <SkillBar
                      key={`c-${skill.name}`}
                      name={skill.name}
                      score={skill.score}
                      maxScore={10}
                      color="#3b82f6"
                    />
                  ))}
                </div>
              </div>

              <div className="skills-column">
                <h3 className="skills-column-title">Dynamic skills (5)</h3>
                <div className="skills-list">
                  {dynamicSkills.map((skill) => (
                    <SkillBar
                      key={`d-${skill.name}`}
                      name={skill.name}
                      score={skill.score}
                      maxScore={10}
                      color={skill.score >= 8 ? '#10b981' : '#3b82f6'}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SkillsMatchDashboard
