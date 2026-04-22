import React, { useEffect, useState } from 'react'
import './CircularGauge.css'

interface CircularGaugeProps {
  score: number
  maxScore?: number
  size?: number
  strokeWidth?: number
  animate?: boolean
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
  score,
  maxScore = 10,
  size = 160,
  strokeWidth = 10,
  animate = true,
}) => {
  const [displayed, setDisplayed] = useState(animate ? 0 : score)

  useEffect(() => {
    if (!animate) { setDisplayed(score); return }
    const start = performance.now()
    const duration = 900
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(score * eased)
      if (t < 1) requestAnimationFrame(raf)
    }
    const id = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(id)
  }, [score, animate])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = (displayed / maxScore) * 100
  const offset = circumference - (percentage / 100) * circumference

  const gradientId = `gauge-gradient-${size}`

  return (
    <div className="circular-gauge">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="gauge-svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent-start)" />
            <stop offset="100%" stopColor="var(--color-accent-end)" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />

        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* Score text */}
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          className="gauge-score-text"
        >
          {Math.round(displayed * 10) / 10}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          className="gauge-max-text"
        >
          /{maxScore}
        </text>
      </svg>
    </div>
  )
}

export default CircularGauge
