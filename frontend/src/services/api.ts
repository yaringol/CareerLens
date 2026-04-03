/**
 * API base: relative `/api` in dev (Vite proxies to backend) unless VITE_API_BASE_URL is set.
 */
function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return '/api'
}

/** Alias for apiBase — avoids ReferenceError if any code or cached bundle still calls `base()`. */
const base = apiBase

export interface PocJob {
  id: string
  title: string
  skills: string[]
}

export interface UploadPdfResponse {
  cvText: string
}

export interface AnalyzeResponse {
  jobTitle: string
  skills: Array<{ name: string; score: number }>
  matchScore: number
  id: string
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchJobs(): Promise<PocJob[]> {
  const res = await fetch(`${base()}/jobs`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load jobs (${res.status})`)
  }
  return res.json() as Promise<PocJob[]>
}

export async function uploadPdf(file: File): Promise<UploadPdfResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${base()}/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Upload failed (${res.status})`)
  }
  return res.json() as Promise<UploadPdfResponse>
}

export async function analyzeCv(jobId: string, cvText: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${base()}/analyze`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ jobId, cvText }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Analyze failed (${res.status})`)
  }
  return res.json() as Promise<AnalyzeResponse>
}
