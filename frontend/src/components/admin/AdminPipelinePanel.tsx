import { useCallback, useEffect, useState } from 'react'
import {
  abortAdminPipeline,
  fetchAdminPipelineStatus,
  triggerAdminPipeline,
  type AdminPipelineStatusResponse,
} from '../../services/api'

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface AdminPipelinePanelProps {
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

export default function AdminPipelinePanel({ onError, onSuccess }: AdminPipelinePanelProps) {
  const [status, setStatus] = useState<AdminPipelineStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTriggering, setIsTriggering] = useState(false)
  const [isAborting, setIsAborting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setStatus(await fetchAdminPipelineStatus())
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load pipeline status')
    } finally {
      setIsLoading(false)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (status?.activeRun) {
      const timer = window.setInterval(load, 5000)
      return () => window.clearInterval(timer)
    }
    return undefined
  }, [status?.activeRun, load])

  async function handleTrigger() {
    if (!window.confirm('Run the daily pipeline now? (scrape, extract, migrate, train)')) return
    setIsTriggering(true)
    try {
      await triggerAdminPipeline()
      onSuccess('Pipeline started')
      await load()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to start pipeline')
    } finally {
      setIsTriggering(false)
    }
  }

  async function handleAbort() {
    if (!window.confirm('Stop the pipeline run? Progress so far is saved; the next run will continue from where it left off.')) {
      return
    }
    setIsAborting(true)
    try {
      await abortAdminPipeline()
      onSuccess('Pipeline stop requested')
      await load()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to stop pipeline')
    } finally {
      setIsAborting(false)
    }
  }

  if (isLoading && !status) {
    return <div className="admin-loading">Loading pipeline status...</div>
  }

  const active = status?.activeRun
  const last = status?.lastRun
  const displayRun = active ?? last

  return (
    <div className="pipeline-panel">
      <div className="model-status-header">
        <h2 className="model-status-title">Daily Pipeline</h2>
        <div className="pipeline-actions">
          <button type="button" className="btn-filter-reset" onClick={load}>Refresh</button>
          <button
            type="button"
            className="btn-filter"
            onClick={handleTrigger}
            disabled={!status?.enabled || Boolean(active) || isTriggering}
          >
            {active ? 'Running...' : isTriggering ? 'Starting...' : 'Run pipeline'}
          </button>
          {active && (
            <button
              type="button"
              className="btn-pipeline-stop"
              onClick={handleAbort}
              disabled={isAborting}
            >
              {isAborting ? 'Stopping...' : 'Stop'}
            </button>
          )}
        </div>
      </div>

      {!status?.enabled && (
        <p className="pipeline-hint">
          Automatic trigger is not configured on this server. Run manually:
          <code className="pipeline-command">{status?.manualCommand}</code>
        </p>
      )}

      {displayRun && (
        <div className="pipeline-run-card">
          <div className="pipeline-run-meta">
            <span className={`pipeline-status pipeline-status--${displayRun.status}`}>
              {displayRun.status}
            </span>
            <span>by {displayRun.triggeredBy}</span>
            {displayRun.status === 'aborted' && displayRun.abortedBy && (
              <span>aborted by {displayRun.abortedBy}</span>
            )}
            <span>started {formatDateTime(displayRun.startedAt)}</span>
            {displayRun.finishedAt && (
              <span>finished {formatDateTime(displayRun.finishedAt)}</span>
            )}
            {displayRun.exitCode !== null && displayRun.exitCode !== undefined && (
              <span>exit {displayRun.exitCode}</span>
            )}
          </div>
          {displayRun.logTail && (
            <pre className="pipeline-log">{displayRun.logTail}</pre>
          )}
        </div>
      )}

      {!displayRun && (
        <p className="pipeline-hint">No pipeline runs recorded yet.</p>
      )}
    </div>
  )
}
