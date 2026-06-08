/**
 * API base: relative `/api` in dev (Vite proxies to backend) unless VITE_API_BASE_URL is set.
 */
function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return '/api'
}

const base = apiBase

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleUnauthorized(res: Response): Promise<void> {
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search)
    window.location.href = '/login'
  }
}

export interface PocJob {
  id: string
  title: string
  skills: string[]
}

export interface UploadPdfResponse {
  cvId: string
  cvText: string
  fileName: string
}

export interface AnalyzeResponse {
  jobTitle: string
  skills: Array<{ name: string; score: number }>
  matchScore: number
  id: string
  cvOnlyMode?: boolean
  isEstimated?: boolean
}

export interface SavedCv {
  cvId: string
  fileName: string
  uploadedAt: string
  fileSizeBytes: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function fetchJobs(): Promise<PocJob[]> {
  const res = await fetch(`${base()}/jobs`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load jobs (${res.status})`)
  }
  return res.json() as Promise<PocJob[]>
}

export async function uploadPdf(file: File, saveToLibrary = true): Promise<UploadPdfResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const url = saveToLibrary ? `${base()}/upload` : `${base()}/upload?save=false`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Upload failed (${res.status})`)
  }
  return res.json() as Promise<UploadPdfResponse>
}

export async function deleteCv(cvId: string): Promise<void> {
  const res = await fetch(`${base()}/cv/${cvId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Delete failed (${res.status})`)
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${base()}/auth/password`, {
    method: 'PUT',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Password change failed (${res.status})`)
  }
}

export async function getMyCVs(): Promise<SavedCv[]> {
  const res = await fetch(`${base()}/cv`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load CVs (${res.status})`)
  }
  return res.json() as Promise<SavedCv[]>
}

export async function getCvText(cvId: string): Promise<{ cvId: string; cvText: string; fileName: string }> {
  const res = await fetch(`${base()}/cv/${cvId}`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load CV (${res.status})`)
  }
  return res.json()
}

const MIN_JOB_DESCRIPTION_CHARS = 40

export async function analyzeCv(
  jobId: string,
  cvText: string,
  jobDescription: string,
  options: { skipGibberish?: boolean } = {}
): Promise<AnalyzeResponse> {
  const jd = jobDescription.trim()
  if (jd.length < MIN_JOB_DESCRIPTION_CHARS) {
    throw new Error(`Please paste a job description (at least ${MIN_JOB_DESCRIPTION_CHARS} characters).`)
  }
  const res = await fetch(`${base()}/analyze`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      ...authHeaders(),
      ...(options.skipGibberish ? { 'X-Skip-Gibberish': 'true' } : {}),
    },
    body: JSON.stringify({ jobId, cvText, jobDescription: jd }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const body = err as { error?: string; code?: string }
    throw new ApiError(body.error || `Analyze failed (${res.status})`, res.status, body.code)
  }
  return res.json() as Promise<AnalyzeResponse>
}

export async function fetchAdminAnalyses(filters?: {
  jobTitle?: string
  minScore?: number
  startDate?: string
  endDate?: string
}): Promise<Array<{ id: string; jobTitle: string; matchScore: number; createdAt: string; userEmail: string | null }>> {
  const params = new URLSearchParams()
  if (filters?.jobTitle) params.set('jobTitle', filters.jobTitle)
  if (filters?.minScore !== undefined) params.set('minScore', String(filters.minScore))
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${base()}/admin/analyses${query}`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load analyses (${res.status})`)
  }
  return res.json()
}
