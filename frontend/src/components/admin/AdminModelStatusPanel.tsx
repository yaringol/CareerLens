import { useCallback, useEffect, useState } from 'react'
import { fetchAdminModelStatus, type AdminModelStatusResponse } from '../../services/api'
import AdminPipelinePanel from './AdminPipelinePanel'

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const compact = iso.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/)
  const date = compact
    ? new Date(Date.UTC(
      Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]),
      Number(compact[4]), Number(compact[5]), Number(compact[6]),
    ))
    : new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function confidenceClass(level: string): string {
  if (level === 'high') return 'confidence-high'
  if (level === 'medium') return 'confidence-medium'
  return 'confidence-low'
}

function formatWeights(weights: Record<string, number>): string {
  const entries = Object.entries(weights)
  if (entries.length === 0) return '-'
  return entries.map(([k, v]) => `${k}:${v}`).join(' + ')
}

interface AdminModelStatusPanelProps {
  onError: (message: string) => void
  onPipelineError: (message: string) => void
  onPipelineSuccess: (message: string) => void
}

export default function AdminModelStatusPanel({
  onError,
  onPipelineError,
  onPipelineSuccess,
}: AdminModelStatusPanelProps) {
  const [status, setStatus] = useState<AdminModelStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setStatus(await fetchAdminModelStatus())
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load model status')
    } finally {
      setIsLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return <div className="admin-loading">Loading model status...</div>
  }

  if (!status?.model1) {
    return <div className="admin-empty-block">No model runs found</div>
  }

  const { model1 } = status
  const live = model1.liveRun
  const last = model1.lastRun
  const uk = model1.langUkExtractProgress
  const ukPct = uk.total > 0 ? Math.round((uk.extracted / uk.total) * 100) : 0

  return (
    <div className="model-status-panel">
      <div className="model-status-header">
        <h2 className="model-status-title">Model 1 - Title to Skills</h2>
        <button type="button" className="btn-filter-reset" onClick={load}>Refresh</button>
      </div>

      <div className="model-status-cards">
        <div className="model-card model-card-live">
          <span className="model-card-label">Live model</span>
          <span className="model-card-value">{live?.runId ?? '-'}</span>
          <span className="model-card-meta">
            {live ? `${live.titlesWithData} titles | ${formatDateTime(live.trainedAt)}` : 'Not promoted'}
          </span>
        </div>
        <div className="model-card">
          <span className="model-card-label">Last train run</span>
          <span className="model-card-value model-card-value-sm">{last?.runId ?? '-'}</span>
          <span className="model-card-meta">
            {last?.promoted ? 'Promoted' : 'Not promoted'}
            {last?.promoteReason ? ` | ${last.promoteReason}` : ''}
            {last && !last.isLiveModel ? ' | superseded' : ''}
          </span>
        </div>
        <div className="model-card">
          <span className="model-card-label">Source weights</span>
          <span className="model-card-value model-card-value-sm">
            {formatWeights(last?.sourceWeights ?? {})}
          </span>
        </div>
      </div>

      <div className="model-status-cards model-status-cards-sm">
        <div className="model-stat">
          <span className="model-stat-num">{model1.jobsCount.toLocaleString()}</span>
          <span className="model-stat-label">LinkedIn jobs</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-num">{model1.rawPostingsCount.toLocaleString()}</span>
          <span className="model-stat-label">Raw postings</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-num">{model1.pendingExtractionCount.toLocaleString()}</span>
          <span className="model-stat-label">Pending extract</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-num">{model1.langUkSkillsCount.toLocaleString()}</span>
          <span className="model-stat-label">lang-uk skills</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-num">{uk.extracted.toLocaleString()} / {uk.total.toLocaleString()}</span>
          <span className="model-stat-label">lang-uk extract ({ukPct}%)</span>
        </div>
        <div className="model-stat">
          <span className="model-stat-num">{model1.unifiedObservations.total.toLocaleString()}</span>
          <span className="model-stat-label">Unified obs</span>
        </div>
      </div>

      <p className="model-unified-breakdown">
        Unified: LinkedIn {model1.unifiedObservations.linkedin.toLocaleString()} | lang-uk {model1.unifiedObservations.langUk.toLocaleString()}
      </p>

      <AdminPipelinePanel onError={onPipelineError} onSuccess={onPipelineSuccess} />

      <h3 className="model-section-title">Run history</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Trained</th>
              <th>Promoted</th>
              <th>Titles</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {model1.runHistory.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty">No runs</td></tr>
            ) : (
              model1.runHistory.map((run) => (
                <tr key={run.runId} className={run.runId === live?.runId ? 'row-live' : undefined}>
                  <td className="td-mono">{run.runId}</td>
                  <td className="td-date">{formatDateTime(run.trainedAt)}</td>
                  <td>{run.promoted ? 'Yes' : 'No'}</td>
                  <td>{run.titlesWithData}</td>
                  <td className="td-reason">{run.promoteReason ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="model-section-title">Titles (latest run features)</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Skills</th>
              <th>Records</th>
              <th>Confidence</th>
              <th>Trends</th>
            </tr>
          </thead>
          <tbody>
            {model1.titles.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty">No title features</td></tr>
            ) : (
              model1.titles.map((row) => (
                <tr key={row.title}>
                  <td>{row.title}</td>
                  <td>{row.skillCount}</td>
                  <td>{row.recordsCount}</td>
                  <td>
                    <span className={`confidence-badge ${confidenceClass(row.dataConfidence)}`}>
                      {row.dataConfidence}
                    </span>
                  </td>
                  <td className="td-trends">
                    up {row.trends.rising} | flat {row.trends.stable} | down {row.trends.falling}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
