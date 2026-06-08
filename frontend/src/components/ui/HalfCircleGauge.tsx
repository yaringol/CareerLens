import { useEffect, useRef } from 'react'
import './HalfCircleGauge.css'

export type Strength = 'none' | 'weak' | 'moderate' | 'strong'

export function getStrength(score: number, max: number): Strength {
  const pct = score / max
  if (pct >= 0.75) return 'strong'
  if (pct >= 0.45) return 'moderate'
  if (pct > 0)    return 'weak'
  return 'none'
}

interface HalfCircleGaugeProps {
  value: number
  max: number
  animate?: boolean
}

const STRENGTH_COLORS: Record<Strength, string[]> = {
  none:     ['hsl(220,13%,75%)', 'hsl(220,9%,55%)'],
  weak:     ['hsl(0,84%,80%)',   'hsl(0,84%,60%)',   'hsl(0,84%,40%)'],
  moderate: ['hsl(38,92%,80%)',  'hsl(38,92%,60%)',  'hsl(38,92%,40%)'],
  strong:   ['hsl(142,71%,80%)', 'hsl(142,71%,55%)', 'hsl(142,71%,38%)'],
}

const EASING = 'cubic-bezier(0.65, 0, 0.35, 1)'

function getRadiusForScore(score: number, max: number) {
  const pct = Math.min(Math.max(score / max, 0), 1) * 100
  if (pct <= 30) return 32
  if (pct <= 60) return 37
  if (pct <= 85) return 42
  return 45
}

function randomId() {
  return 'g' + Math.random().toString(36).slice(2, 8)
}

export function HalfCircleGauge({ value, max, animate = true }: HalfCircleGaugeProps) {
  const strokeRef = useRef<SVGCircleElement>(null)
  const gradId    = useRef(randomId()).current

  const scoreRatio   = Math.min(Math.max(value / max, 0), 1)
  const radius       = getRadiusForScore(value, max)
  const circumference = 2 * Math.PI * radius
  const dasharray    = `${circumference} ${circumference}`
  const targetOffset = (1 - scoreRatio) * circumference
  const strength     = getStrength(value, max)
  const colorStops   = STRENGTH_COLORS[strength]

  useEffect(() => {
    const el = strokeRef.current
    if (!el) return
    if (!animate) {
      el.style.strokeDashoffset = String(targetOffset)
      return
    }
    el.animate(
      [
        { strokeDashoffset: String(circumference), offset: 0 },
        { strokeDashoffset: String(circumference), offset: 400 / 1400 },
        { strokeDashoffset: String(targetOffset) },
      ],
      { duration: 1400, easing: EASING, fill: 'forwards' }
    )
  }, [value, max, animate, circumference, targetOffset])

  const displayValue = Math.round(value)

  return (
    <div className="hcg-root">
      <div className="hcg-svg-wrap">
        <svg viewBox="0 0 100 100" className="hcg-svg" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              {colorStops.map((c, i) => (
                <stop
                  key={i}
                  offset={`${(100 / (colorStops.length - 1)) * i}%`}
                  stopColor={c}
                />
              ))}
            </linearGradient>
          </defs>
          {/* rotate(-90) starts the arc at 12 o'clock */}
          <g fill="none" strokeWidth="10" transform="translate(50,50) rotate(-90)">
            <circle className="hcg-track" r={radius} />
            <circle
              ref={strokeRef}
              stroke={`url(#${gradId})`}
              strokeDasharray={dasharray}
              strokeDashoffset={circumference}
              strokeLinecap="round"
              r={radius}
            />
          </g>
        </svg>

        <div className="hcg-score-wrap">
          <div className="hcg-digits">
            <span className="hcg-digit" style={{ animationDelay: '400ms', animationDuration: '900ms' }}>
              {displayValue}
            </span>
            <span className="hcg-percent" style={{ animationDelay: '500ms' }}>%</span>
          </div>
        </div>
      </div>

      {strength !== 'none' && (
        <span className={`hcg-badge hcg-badge--${strength}`}>
          {strength}
        </span>
      )}
    </div>
  )
}

export default HalfCircleGauge
