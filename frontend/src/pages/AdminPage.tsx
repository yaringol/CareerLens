import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { fetchAdminAnalyses } from '../services/api'
import './AdminPage.css'

interface Analysis {
  id: string
  jobTitle: string
  matchScore: number
  createdAt: string
  userEmail: string | null
}

export default function AdminPage() {
  const { logout, user } = useAuth()
  const { showToast } = useToast()
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [jobTitle, setJobTitle] = useState('')
  const [minScore, setMinScore] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  async function load() {
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

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilter(e: React.FormEvent) {
    e.preventDefault()
    load()
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
          <h1 className="admin-title">Admin — All Analyses</h1>
          <span className="admin-user">{user?.email}</span>
        </div>
        <button className="btn-logout" onClick={logout}>Logout</button>
      </header>

      <div className="admin-content">
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
          <button type="button" className="btn-filter-reset" onClick={() => { setJobTitle(''); setMinScore(''); setStartDate(''); setEndDate(''); }}>Reset</button>
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
      </div>
    </div>
  )
}
