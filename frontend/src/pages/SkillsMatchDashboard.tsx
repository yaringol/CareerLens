import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CircularGauge from '../components/ui/CircularGauge'
import SkillBar from '../components/ui/SkillBar'
import './SkillsMatchDashboard.css'

interface Skill {
  name: string
  score: number
  category: 'core' | 'dynamic'
}

const SkillsMatchDashboard = () => {
  const navigate = useNavigate()
  const [overallScore, setOverallScore] = useState(72)
  const [coreSkills, setCoreSkills] = useState<Skill[]>([])
  const [dynamicSkills, setDynamicSkills] = useState<Skill[]>([])

  useEffect(() => {
    // Mock data - in real app, this would come from API
    setCoreSkills([
      { name: 'SQL', score: 7, category: 'core' },
      { name: 'Python', score: 6, category: 'core' },
    ])
    setDynamicSkills([
      { name: 'Pandas', score: 9, category: 'dynamic' },
      { name: 'Docker', score: 6, category: 'dynamic' },
    ])
  }, [])

  const handleBackToUpload = () => {
    navigate('/upload')
  }

  const handleNext = () => {
    navigate('/skill-details')
  }

  const handlePrevious = () => {
    navigate('/extract')
  }

  return (
    <div className="skills-match-dashboard">
      <div className="dashboard-container">
        {/* Page flow navigation */}
        <div className="page-flow-header">
          <button
            onClick={handleBackToUpload}
            className="flow-nav-button back-button"
          >
            ← Back to Upload
          </button>
          
          <div className="page-flow-dots">
            <div className="flow-dot" />
            <div className="flow-dot active" />
            <div className="flow-dot" />
            <div className="flow-dot" />
          </div>

          <button
            onClick={handleNext}
            className="flow-nav-button next-button"
          >
            Next →
          </button>
        </div>

        <div className="match-overview-card">
          <h2 className="match-overview-title">Match Overview</h2>
          
          <div className="match-content">
            {/* Left: Overall Score */}
            <div className="overall-score-section">
              <div className="score-display">
                <CircularGauge score={overallScore / 10} maxScore={10} size={200} />
                <div className="percentage-display">{overallScore}%</div>
              </div>
            </div>

            {/* Right: Skills Breakdown */}
            <div className="skills-breakdown">
              <div className="skills-column">
                <h3 className="skills-column-title">Core Skills</h3>
                <div className="skills-list">
                  {coreSkills.map((skill) => (
                    <SkillBar
                      key={skill.name}
                      name={skill.name}
                      score={skill.score}
                      maxScore={10}
                      color="#3b82f6"
                    />
                  ))}
                </div>
              </div>

              <div className="skills-column">
                <h3 className="skills-column-title">Dynamic Skills</h3>
                <div className="skills-list">
                  {dynamicSkills.map((skill) => (
                    <SkillBar
                      key={skill.name}
                      name={skill.name}
                      score={skill.score}
                      maxScore={10}
                      color={skill.score >= 8 ? "#10b981" : "#3b82f6"}
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
