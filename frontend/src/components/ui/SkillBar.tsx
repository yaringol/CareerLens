import React, { useEffect, useState } from 'react'
import './SkillBar.css'

interface SkillBarProps {
  name: string
  score: number
  maxScore: number
  animate?: boolean
  delay?: number
}

function getRating(score: number, maxScore: number): { label: string; cls: string } {
  const pct = (score / maxScore) * 100
  if (pct >= 80) return { label: 'Excellent', cls: 'skill-badge--excellent' }
  if (pct >= 60) return { label: 'Good',      cls: 'skill-badge--good' }
  if (pct >= 40) return { label: 'Average',   cls: 'skill-badge--average' }
  return             { label: 'Poor',       cls: 'skill-badge--poor' }
}

const SkillBar: React.FC<SkillBarProps> = ({
  name,
  score,
  maxScore,
  animate = true,
  delay = 0,
}) => {
  const [width, setWidth] = useState(animate ? 0 : (score / maxScore) * 100)

  useEffect(() => {
    if (!animate) return
    const timer = setTimeout(() => {
      setWidth((score / maxScore) * 100)
    }, delay)
    return () => clearTimeout(timer)
  }, [score, maxScore, animate, delay])

  const rating = getRating(score, maxScore)

  return (
    <div className="skill-bar-item">
      <div className="skill-bar-header">
        <span className="skill-name">{name}</span>
        <div className="skill-bar-right">
          <span className={`skill-badge ${rating.cls}`}>{rating.label}</span>
          <span className="skill-score">{score}<span className="skill-score-max">/{maxScore}</span></span>
        </div>
      </div>
      <div className="skill-bar-track">
        <div
          className="skill-bar-fill"
          style={{ width: `${width}%`, transition: animate ? 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}
        />
      </div>
    </div>
  )
}

export default SkillBar
