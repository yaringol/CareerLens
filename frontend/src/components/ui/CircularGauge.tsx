import React from 'react'
import './CircularGauge.css'

interface CircularGaugeProps {
  score: number
  maxScore?: number
  size?: number
  strokeWidth?: number
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
  score,
  maxScore = 10,
  size = 120,
  strokeWidth = 8,
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = (score / maxScore) * 100
  const offset = circumference - (percentage / 100) * circumference

  const getColor = () => {
    if (percentage >= 80) return '#10b981' // green
    if (percentage >= 60) return '#3b82f6' // blue
    if (percentage >= 40) return '#f59e0b' // amber
    return '#ef4444' // red
  }

  const getAlignmentLabel = () => {
    if (percentage >= 80) return 'Excellent Alignment'
    if (percentage >= 60) return 'Good Alignment'
    if (percentage >= 40) return 'Medium Alignment'
    return 'Low Alignment'
  }

  const color = getColor()
  const alignmentLabel = getAlignmentLabel()

  return (
    <div className="circular-gauge">
      <div className="gauge-container" style={{ width: size, height: size }}>
        <svg className="gauge-svg" viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="gauge-background"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            className="gauge-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="gauge-content">
          <span className="gauge-score">{score}</span>
          <span className="gauge-max">/{maxScore}</span>
        </div>
      </div>
      <div className="gauge-label" style={{ backgroundColor: `${color}20`, color }}>
        {alignmentLabel}
      </div>
    </div>
  )
}

export default CircularGauge
