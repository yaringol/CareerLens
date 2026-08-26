import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminModelStatusCollectionStats,
  fetchAdminModelStatusSummary,
  fetchAdminModelStatusTitles,
  type AdminLangUkExtractProgress,
  type AdminModelStatusSummaryResponse,
  type AdminModelTitleRow,
} from '../../services/api'

const TITLES_PAGE_SIZE = 25

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

function formatCount(value: number | null, approximate = false): string {
  if (value === null) return '—'
  const formatted = value.toLocaleString()
  return approximate ? `~${formatted}` : formatted
}

function formatLangUkProgress(uk: AdminLangUkExtractProgress): string {
  if (uk.extracted === null) {
    return `${formatCount(uk.total, true)} total`
  }
  const pct = uk.total > 0 ? Math.round((uk.extracted / uk.total) * 100) : 0
  return `${uk.extracted.toLocaleString()} / ${uk.total.toLocaleString()} (${pct}%)`
}

function ModelStatusSkeleton() {
  return (
    <>
      <div className="model-status-cards">
        {[0, 1, 2].map((i) => (
          <div key={i} className="model-card admin-skeleton-card">
            <span className="admin-skeleton admin-skeleton-label" />
            <span className="admin-skeleton admin-skeleton-value" />
            <span className="admin-skeleton admin-skeleton-meta" />
          </div>
        ))}
      </div>
      <div className="model-status-cards model-status-cards-sm">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="model-stat admin-skeleton-stat">
            <span className="admin-skeleton admin-skeleton-num" />
            <span className="admin-skeleton admin-skeleton-stat-label" />
          </div>
        ))}
      </div>
    </>
  )
}

interface AdminModelStatusPanelProps {
  onError: (message: string) => void
}

export default function AdminModelStatusPanel({
  onError,
}: AdminModelStatusPanelProps) {
  const [status, setStatus] = useState<AdminModelStatusSummaryResponse | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [langUkProgress, setLangUkProgress] = useState<AdminLangUkExtractProgress | null>(null)
  const [titles, setTitles] = useState<AdminModelTitleRow[]>([])
  const [titlesTotal, setTitlesTotal] = useState(0)
  const [titlesHasMore, setTitlesHasMore] = useState(false)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isStatsLoading, setIsStatsLoading] = useState(false)
  const [isTitlesLoading, setIsTitlesLoading] = useState(false)
  const [isLoadingMoreTitles, setIsLoadingMoreTitles] = useState(false)

  const loadTitlesChunk = useCallback(async (runId: string, offset: number, append: boolean) => {
    if (append) {
      setIsLoadingMoreTitles(true)
    } else {
      setIsTitlesLoading(true)
    }

    try {
      const chunk = await fetchAdminModelStatusTitles(runId, offset, TITLES_PAGE_SIZE)
      setTitlesTotal(chunk.total)
      setTitlesHasMore(chunk.hasMore)
      setTitles((prev) => (append ? [...prev, ...chunk.titles] : chunk.titles))
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load title features')
    } finally {
      setIsTitlesLoading(false)
      setIsLoadingMoreTitles(false)
    }
  }, [onError])

  const load = useCallback(async () => {
    setIsSummaryLoading(true)
    setSummaryError(null)
    setIsStatsLoading(true)
    setTitles([])
    setTitlesTotal(0)
    setTitlesHasMore(false)
    setPendingCount(null)
    setLangUkProgress(null)

    try {
      const summary = await fetchAdminModelStatusSummary()
      setStatus(summary)
      setPendingCount(summary.model1.pendingExtractionCount)
      setLangUkProgress(summary.model1.langUkExtractProgress)

      const runId = summary.model1.titlesRunId
      if (runId) {
        void loadTitlesChunk(runId, 0, false)
      }

      void fetchAdminModelStatusCollectionStats()
        .then((stats) => {
          setPendingCount(stats.pendingExtractionCount)
          setLangUkProgress(stats.langUkExtractProgress)
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : 'Failed to load collection stats')
        })
        .finally(() => {
          setIsStatsLoading(false)
        })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load model status'
      setSummaryError(message)
      onError(message)
      setIsStatsLoading(false)
    } finally {
      setIsSummaryLoading(false)
    }
  }, [loadTitlesChunk, onError])

  useEffect(() => {
    void load()
  }, [load])

  const handleLoadMoreTitles = () => {
    const runId = status?.model1.titlesRunId
    if (!runId || isLoadingMoreTitles || !titlesHasMore) return
    void loadTitlesChunk(runId, titles.length, true)
  }

  const model1 = status?.model1
  const live = model1?.liveRun
  const last = model1?.lastRun
  const uk = langUkProgress ?? model1?.langUkExtractProgress
  const countsApproximate = model1?.countsAreEstimated ?? false

  return (
    <div className="model-status-panel">
      <div className="model-status-header">
        <h2 className="model-status-title">Model 1 - Title to Skills</h2>
        <button type="button" className="btn-filter-reset" onClick={() => { void load() }}>Refresh</button>
      </div>

      {summaryError && (
        <div className="admin-error-banner">
          {summaryError}
          <button type="button" className="btn-filter-reset" onClick={() => { void load() }}>Retry</button>
        </div>
      )}

      {isSummaryLoading && !model1 ? (
        <ModelStatusSkeleton />
      ) : !model1 && !summaryError ? (
        <div className="admin-empty-block">No model runs found</div>
      ) : !model1 ? null : (
        <>
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
              <span className="model-stat-num">{formatCount(model1.jobsCount, countsApproximate)}</span>
              <span className="model-stat-label">LinkedIn jobs</span>
            </div>
            <div className="model-stat">
              <span className="model-stat-num">{formatCount(model1.rawPostingsCount, countsApproximate)}</span>
              <span className="model-stat-label">Raw postings</span>
            </div>
            <div className="model-stat">
              <span className="model-stat-num">{formatCount(pendingCount, false)}</span>
              <span className="model-stat-label">Pending extract{isStatsLoading ? ' (loading)' : ''}</span>
            </div>
            <div className="model-stat">
              <span className="model-stat-num">{formatCount(model1.langUkSkillsCount, countsApproximate)}</span>
              <span className="model-stat-label">lang-uk skills</span>
            </div>
            <div className="model-stat">
              <span className="model-stat-num">{uk ? formatLangUkProgress(uk) : '—'}</span>
              <span className="model-stat-label">lang-uk extract{isStatsLoading && uk?.extracted === null ? ' (loading)' : ''}</span>
            </div>
            <div className="model-stat">
              <span className="model-stat-num">{formatCount(model1.unifiedObservations.total, false)}</span>
              <span className="model-stat-label">Unified obs</span>
            </div>
          </div>

          <p className="model-unified-breakdown">
            Unified: LinkedIn {model1.unifiedObservations.linkedin.toLocaleString()} | lang-uk {model1.unifiedObservations.langUk.toLocaleString()}
          </p>
        </>
      )}

      {model1 && (
        <>
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

          <div className="model-status-header">
            <h3 className="model-section-title">Titles (latest run features)</h3>
            {titlesTotal > 0 && (
              <span className="model-section-meta">
                Showing {titles.length.toLocaleString()} of {titlesTotal.toLocaleString()}
              </span>
            )}
          </div>
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
                {isTitlesLoading ? (
                  <tr><td colSpan={5} className="admin-empty">Loading titles...</td></tr>
                ) : titles.length === 0 ? (
                  <tr><td colSpan={5} className="admin-empty">No title features</td></tr>
                ) : (
                  titles.map((row) => (
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
            {titlesHasMore && (
              <div className="model-chunk-actions">
                <button
                  type="button"
                  className="btn-filter"
                  disabled={isLoadingMoreTitles}
                  onClick={handleLoadMoreTitles}
                >
                  {isLoadingMoreTitles ? 'Loading…' : `Load ${TITLES_PAGE_SIZE} more`}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
