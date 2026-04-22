import './ScanLoader.css'

const ScanLoader = () => (
  <div className="scan-loader-overlay" role="status" aria-label="Analyzing your CV…">
    <div className="scan-loader-card">
      <div className="scan-scene">
        {/* Document lines */}
        <div className="doc-lines">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="doc-line" style={{ width: i % 3 === 2 ? '60%' : '100%' }} />
          ))}
        </div>
        {/* Magnifying glass that scans */}
        <div className="lens-scanner">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="lens-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-accent-start)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-accent-end)" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            {/* Lens circle */}
            <circle cx="17" cy="17" r="13" fill="url(#lens-grad)" stroke="var(--color-primary)" strokeWidth="2.5" />
            {/* Handle */}
            <line x1="27" y1="27" x2="37" y2="37" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />
            {/* Chart bars inside lens */}
            <rect x="9"  y="20" width="4" height="6" rx="1" fill="var(--color-accent-start)" opacity="0.8" />
            <rect x="15" y="16" width="4" height="10" rx="1" fill="var(--color-accent-start)" opacity="0.9" />
            <rect x="21" y="13" width="4" height="13" rx="1" fill="var(--color-accent-end)" />
            {/* Upward arrow */}
            <polyline points="21,13 25,9 29,13" fill="none" stroke="var(--color-accent-end)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Scan line */}
        <div className="scan-line" />
      </div>

      <p className="scan-label">Analyzing your CV</p>
      <p className="scan-sublabel">Scoring skills for the selected role…</p>

      <div className="scan-dots">
        <span /><span /><span />
      </div>
    </div>
  </div>
)

export default ScanLoader
