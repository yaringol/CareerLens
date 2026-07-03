import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { fetchAdminAnalyses } from '../services/api'
import AdminModelStatusPanel from '../components/admin/AdminModelStatusPanel'
import AppLogo from '../components/ui/AppLogo'
import './AdminPage.css'

interface Analysis {
  id: string
  jobTitle: string
  matchScore: number
  createdAt: string
  userEmail: string | null
}

type AdminTab = 'analyses' | 'model'

export default function AdminPage() {
  const { logout, user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<AdminTab>('model')
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [jobTitle, setJobTitle] = useState('')
  const [minScore, setMinScore] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function loadAnalyses() {
    setIsLoading(true)
    try {
      const data = await fetchAdminAnalyses({
        jobTitle: jobTitle || undefined,
        minScore: minScore ? parseFloat(minScore) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      setAnalyses(data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setIsLoading(false)
    }
  }

  const handleModelError = useCallback(
    (message: string) => showToast(message),
    [showToast],
  )

  const handlePipelineError = useCallback(
    (message: string) => showToast(message),
    [showToast],
  )

  const handlePipelineSuccess = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  )

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    loadAnalyses()
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function scoreColor(score: number): string {
    if (score >= 7.5) return '#4ade80'
    if (score >= 5) return '#facc15'
    return '#f87171'
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <Link to="/" className="admin-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </Link>
          <div className="admin-header-info">
            <div className="admin-avatar">{user?.email?.[0]?.toUpperCase() ?? '?'}</div>
            <div>
              <p className="admin-email">{user?.email}</p>
              <p className="admin-role">{user?.role}</p>
            </div>
          </div>
        </div>
        <div className="admin-header-right">
          <button
            type="button"
            className="admin-logout"
            onClick={() => { logout(); navigate('/login') }}
          >
            Sign out
          </button>
          <AppLogo size="sm" />
        </div>
      </header>

      <nav className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${tab === 'model' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('model')}
        >
          Model Status
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'analyses' ? 'admin-tab-active' : ''}`}
          onClick={() => {
            setTab('analyses')
            if (analyses.length === 0) loadAnalyses()
          }}
        >
          Analyses
        </button>
      </nav>

      <div className="admin-content">
        {tab === 'model' ? (
          <>
            <AdminModelStatusPanel
              onError={handleModelError}
              onPipelineError={handlePipelineError}
              onPipelineSuccess={handlePipelineSuccess}
            />
          </>
        ) : (
          <>
            <form className="admin-filters" onSubmit={handleFilter}>
              <div className="filter-field">
                <label className="filter-label">Job Title</label>
                <input
                  className="filter-input"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="filter-field">
                <label className="filter-label">Min Score</label>
                <input
                  className="filter-input"
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  placeholder="0 – 10"
                />
              </div>
              <div className="filter-field">
                <label className="filter-label">From</label>
                <input
                  className="filter-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="filter-field">
                <label className="filter-label">To</label>
                <input
                  className="filter-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-filter">Apply</button>
              <button
                type="button"
                className="btn-filter-reset"
                onClick={() => {
                  setJobTitle('')
                  setMinScore('')
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Reset
              </button>
            </form>

            {isLoading ? (
              <div className="admin-loading">Loading…</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Job Title</th>
                      <th>Match Score</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.length === 0 ? (
                      <tr><td colSpan={4} className="admin-empty">No analyses found</td></tr>
                    ) : (
                      analyses.map((a) => (
                        <tr key={a.id}>
                          <td className="td-email">{a.userEmail ?? '—'}</td>
                          <td>{a.jobTitle}</td>
                          <td>
                            <span className="score-badge" style={{ color: scoreColor(a.matchScore) }}>
                              {(a.matchScore * 10).toFixed(0)}%
                            </span>
                          </td>
                          <td className="td-date">{formatDate(a.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <p className="admin-count">{analyses.length} result{analyses.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
