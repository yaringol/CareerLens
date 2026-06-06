/**
 * API base: relative `/api` in dev (Vite proxies to backend) unless VITE_API_BASE_URL is set.
 */
function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return '/api'
}

const base = apiBase

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code ?? statusToCode(status)
  }
}

function statusToCode(status: number): string {
  if (status >= 500) return 'SERVER_ERROR'
  if (status === 404) return 'NOT_FOUND'
  if (status === 422) return 'UNPROCESSABLE'
  if (status === 400) return 'BAD_REQUEST'
  if (status === 502) return 'UPSTREAM_ERROR'
  if (status === 503) return 'SERVICE_UNAVAILABLE'
  return `HTTP_${status}`
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  const status = res.status
  let message = friendlyStatusMessage(status)
  let code = statusToCode(status)

  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown; message?: unknown }
    if (typeof body.error === 'string' && body.error.trim()) {
      message = body.error.trim()
    } else if (typeof body.message === 'string' && body.message.trim()) {
      message = body.message.trim()
    }
    if (typeof body.code === 'string' && body.code.trim()) {
      code = body.code.trim()
    }
  } catch {
    /* non-JSON body */
  }

  return new ApiError(message, status, code)
}

function friendlyStatusMessage(status: number): string {
  if (status === 400) return 'Invalid request. Please check your input and try again.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 422) return 'We could not process your file. Try a different PDF.'
  if (status === 502) return 'Analysis service is temporarily unavailable. Please try again.'
  if (status === 503) return 'A required service is unavailable. Ensure the backend and DS model are running.'
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
  return `Request failed (${status}). Please try again.`
}

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

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  await handleUnauthorized(res)
  if (!res.ok) {
    throw await parseErrorResponse(res)
  }
  return res
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
  isEstimated?: boolean
}

export interface SavedCv {
  cvId: string
  fileName: string
  uploadedAt: string
  fileSizeBytes: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchJobs(): Promise<PocJob[]> {
  const res = await apiFetch(`${base()}/jobs`, {
    headers: { ...authHeaders() },
  })
  return res.json() as Promise<PocJob[]>
}

export async function uploadPdf(file: File, saveToLibrary = true): Promise<UploadPdfResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const url = saveToLibrary ? `${base()}/upload` : `${base()}/upload?save=false`
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  })
  return res.json() as Promise<UploadPdfResponse>
}

export async function deleteCv(cvId: string): Promise<void> {
  await apiFetch(`${base()}/cv/${cvId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch(`${base()}/auth/password`, {
    method: 'PUT',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function getMyCVs(): Promise<SavedCv[]> {
  const res = await apiFetch(`${base()}/cv`, {
    headers: { ...authHeaders() },
  })
  return res.json() as Promise<SavedCv[]>
}

export async function getCvText(cvId: string): Promise<{ cvId: string; cvText: string; fileName: string }> {
  const res = await apiFetch(`${base()}/cv/${cvId}`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}

export const MIN_JOB_DESCRIPTION_CHARS = 40

export const JOB_DESCRIPTION_MIN_MESSAGE = `Paste at least ${MIN_JOB_DESCRIPTION_CHARS} characters of job description`

export async function analyzeCv(
  jobId: string,
  cvText: string,
  jobDescription: string
): Promise<AnalyzeResponse> {
  const jd = jobDescription.trim()
  if (jd.length < MIN_JOB_DESCRIPTION_CHARS) {
    throw new ApiError(JOB_DESCRIPTION_MIN_MESSAGE, 400, 'VALIDATION')
  }
  const res = await apiFetch(`${base()}/analyze`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ jobId, cvText, jobDescription: jd }),
  })
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
  const res = await apiFetch(`${base()}/admin/analyses${query}`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}
