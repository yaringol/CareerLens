import React from 'react'
import './SkillBar.css'

interface SkillBarProps {
  name: string
  score: number
  maxScore: number
  color?: string
}

const SkillBar: React.FC<SkillBarProps> = ({
  name,
  score,
  maxScore,
  color = '#3b82f6',
}) => {
  const percentage = (score / maxScore) * 100

  return (
    <div className="skill-bar-item">
      <div className="skill-bar-header">
        <span className="skill-name">{name}</span>
        <span className="skill-score">{score}/{maxScore}</span>
      </div>
      <div className="skill-bar-container">
        <div
          className="skill-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

export default SkillBar
