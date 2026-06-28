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

export interface DetectedCvTitle {
  detectedTitle: string | null
  confidence: number
  source: 'headline' | 'experience' | 'none'
  suggestions: TitleMatchSuggestion[]
}

export interface TitleMatchSuggestion {
  canonicalTitle: string
  matchedVariant: string
  confidence: number
}

export interface AnalyzeResponse {
  jobTitle: string
  skills: Array<{ name: string; score: number }>
  matchScore: number
  id: string
  cvOnlyMode?: boolean
  isEstimated?: boolean
  bestSavedCv?: CompareSavedResponse['bestSavedCv']
}

export interface SavedCv {
  cvId: string
  fileName: string
  uploadedAt: string
  fileSizeBytes: number
  isFavorite: boolean
}

export interface CompareSavedResponse {
  bestSavedCv: {
    cvId: string
    fileName: string
    matchScore: number
    analysisId: string
    jobTitle: string
    skills: Array<{ name: string; score: number }>
    cvOnlyMode: boolean
    isEstimated: boolean
  } | null
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

export async function detectCvTitle(cvText: string): Promise<DetectedCvTitle> {
  const res = await apiFetch(`${base()}/cv/title`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ cvText }),
  })
  return res.json()
}

export async function matchTitle(title: string): Promise<{ suggestions: TitleMatchSuggestion[] }> {
  const res = await apiFetch(`${base()}/title/match`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ title }),
  })
  return res.json()
}

export async function deleteCv(cvId: string): Promise<void> {
  await apiFetch(`${base()}/cv/${cvId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
}

export async function setCvFavorite(cvId: string, favorite: boolean): Promise<{ cvId: string; isFavorite: boolean }> {
  const res = await apiFetch(`${base()}/cv/${cvId}/favorite`, {
    method: 'PATCH',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ favorite }),
  })
  return res.json() as Promise<{ cvId: string; isFavorite: boolean }>
}

export async function compareSavedCvs(payload: {
  jobId: string
  jobTitle: string
  skills: string[]
  currentMatchScore: number
  excludeCvId?: string
  cvOnlyMode?: boolean
}): Promise<CompareSavedResponse> {
  const res = await apiFetch(`${base()}/analyze/compare-saved`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  })
  return res.json() as Promise<CompareSavedResponse>
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
  const rows = await res.json() as Array<SavedCv & { isFavorite?: boolean }>
  return rows.map((row) => ({ ...row, isFavorite: row.isFavorite ?? false }))
}

export async function getCvText(cvId: string): Promise<{ cvId: string; cvText: string; fileName: string }> {
  const res = await apiFetch(`${base()}/cv/${cvId}`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}

export const MIN_JOB_DESCRIPTION_CHARS = 40
export const MAX_JOB_DESCRIPTION_CHARS = 12_000

export const JOB_DESCRIPTION_MIN_MESSAGE = `Paste at least ${MIN_JOB_DESCRIPTION_CHARS} characters of job description`

export interface FetchedJobPosting {
  title?: string
  description: string
  source: 'comeet' | 'json-ld' | 'html'
  sourceUrl: string
}

export async function fetchJobDescriptionFromUrl(url: string): Promise<FetchedJobPosting> {
  const res = await apiFetch(`${base()}/jobs/fetch-description`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ url: url.trim() }),
  })
  return res.json() as Promise<FetchedJobPosting>
}

export async function analyzeCv(
  canonicalTitle: string,
  cvText: string,
  jobDescription: string,
  titleMatch = 0.0,
  options: { skipGibberish?: boolean; excludeCvId?: string } = {}
): Promise<AnalyzeResponse> {
  const jd = jobDescription.trim()
  if (!options.skipGibberish && jd.length < MIN_JOB_DESCRIPTION_CHARS && !/^https?:\/\//i.test(jd)) {
    throw new ApiError(JOB_DESCRIPTION_MIN_MESSAGE, 400, 'VALIDATION')
  }
  const res = await apiFetch(`${base()}/analyze`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      ...authHeaders(),
      ...(options.skipGibberish ? { 'X-Skip-Gibberish': 'true' } : {}),
    },
    body: JSON.stringify({
      canonicalTitle,
      cvText,
      jobDescription: jd,
      titleMatch,
      ...(options.excludeCvId ? { excludeCvId: options.excludeCvId } : {}),
    }),
  })
  return res.json() as Promise<AnalyzeResponse>
}

// ── CV Improve ────────────────────────────────────────────────────────

export type Proficiency = 'no_knowledge' | 'beginner' | 'intermediate' | 'proficient' | 'expert'

export interface Occurrence {
  sectionId: string
  text: string
}

export interface CvSection {
  sectionId: string
  label: string
  originalText: string
  currentText: string
  order: number
  kind: 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other'
  version: number
}

export interface SkillContext {
  skill: string
  score: number
  found: boolean
  occurrences: Occurrence[]
  primaryOccurrence: Occurrence | null
  sharedWith: string[]
  targetSectionId: string | null
}

export interface PrepareResponse {
  sections: CvSection[]
  skills: SkillContext[]
}

export interface ImprovementSession {
  id: string
  displayName: string
  status?: 'completed'
  jobTitle: string
  analysisId: string
  createdAt: string
  skillCount: number
  hasFinalCvText?: boolean
}

export interface ImprovementSessionDetail extends ImprovementSession {
  originalCvText: string
  finalCvText: string
  improvements: unknown[]
  sectionUpdates: unknown[]
}

export async function prepareImprovement(
  cvText: string,
  weakSkills: Array<{ skill: string; score: number }>
): Promise<PrepareResponse> {
  const res = await fetch(`${base()}/cv-improve/prepare`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ cvText, weakSkills }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Prepare failed (${res.status})`)
  }
  return res.json() as Promise<PrepareResponse>
}

export async function getSuggestion(
  payload: {
    skill: string
    proficiency: Proficiency
    sectionId: string
    originalSectionText: string
    currentSectionText: string
    jobTitle: string
    found: boolean
  }
): Promise<string> {
  const res = await fetch(`${base()}/cv-improve/suggest`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Suggest failed (${res.status})`)
  }
  const data = await res.json() as { suggestedText: string }
  return data.suggestedText
}

export async function reanalyzeCv(
  jobTitle: string,
  cvText: string,
  jobDescription: string
): Promise<AnalyzeResponse> {
  const res = await fetch(`${base()}/analyze/skillner`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ jobTitle, cvText, jobDescription }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Re-analyze failed (${res.status})`)
  }
  return res.json() as Promise<AnalyzeResponse>
}

export async function mergeCv(
  sections: CvSection[]
): Promise<string> {
  const res = await fetch(`${base()}/cv-improve/merge`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ sections }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Merge failed (${res.status})`)
  }
  const data = await res.json() as { mergedCvText: string }
  return data.mergedCvText
}

export async function saveImprovementSession(payload: {
  displayName?: string
  jobTitle: string
  analysisId: string
  originalCvText: string
  finalCvText: string
  improvements: unknown[]
  sectionUpdates?: unknown[]
}): Promise<{ id: string }> {
  const res = await fetch(`${base()}/cv-improve/sessions`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Save session failed (${res.status})`)
  }
  return res.json() as Promise<{ id: string }>
}

export async function getImprovementSessions(): Promise<ImprovementSession[]> {
  const res = await fetch(`${base()}/cv-improve/sessions`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load sessions (${res.status})`)
  }
  return res.json() as Promise<ImprovementSession[]>
}

export async function getImprovementSession(id: string): Promise<ImprovementSessionDetail> {
  const res = await fetch(`${base()}/cv-improve/sessions/${id}`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Failed to load session (${res.status})`)
  }
  return res.json() as Promise<ImprovementSessionDetail>
}

export async function deleteImprovementSession(id: string): Promise<void> {
  const res = await fetch(`${base()}/cv-improve/sessions/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Delete failed (${res.status})`)
  }
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
