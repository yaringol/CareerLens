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
}

export interface SavedCv {
  cvId: string
  fileName: string
  uploadedAt: string
  fileSizeBytes: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

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

export interface ExtractTitleResponse {
  extracted_title: string | null
  canonical_title: string | null
  confidence: number
  low_confidence: boolean
}

export interface TitleMatchResponse {
  matches: Array<{ canonical: string; confidence: number }>
  low_confidence: boolean
}

export async function extractCvTitle(cvText: string): Promise<ExtractTitleResponse> {
  const res = await fetch(`${base()}/cv/extract-title`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ cvText }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Title extraction failed (${res.status})`)
  }
  return res.json() as Promise<ExtractTitleResponse>
}

export async function matchTitle(title: string): Promise<TitleMatchResponse> {
  const res = await fetch(`${base()}/title/match?title=${encodeURIComponent(title)}`, {
    headers: { ...authHeaders() },
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Title match failed (${res.status})`)
  }
  return res.json() as Promise<TitleMatchResponse>
}

export async function analyzeCv(
  jobId: string,
  cvText: string,
  jobDescription: string,
  titleMatch = 0.0
): Promise<AnalyzeResponse> {
  const jd = jobDescription.trim()
  if (jd.length < MIN_JOB_DESCRIPTION_CHARS) {
    throw new Error(`Please paste a job description (at least ${MIN_JOB_DESCRIPTION_CHARS} characters).`)
  }
  const res = await fetch(`${base()}/analyze`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ jobId, cvText, jobDescription: jd, titleMatch }),
  })
  await handleUnauthorized(res)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Analyze failed (${res.status})`)
  }
  return res.json() as Promise<AnalyzeResponse>
}

// ── CV Improve ────────────────────────────────────────────────────────

export type Proficiency = 'no_knowledge' | 'beginner' | 'intermediate' | 'proficient' | 'expert'

export interface Occurrence {
  sectionId: string
  text: string
}

export interface SkillContext {
  skill: string
  score: number
  found: boolean
  occurrences: Occurrence[]
  primaryOccurrence: Occurrence | null
  sharedWith: string[]
}

export interface PrepareResponse {
  skills: SkillContext[]
}

export interface ImprovementSession {
  id: string
  jobTitle: string
  analysisId: string
  createdAt: string
  skillCount: number
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
  skill: string,
  proficiency: Proficiency,
  oldText: string | null,
  jobTitle: string,
  found: boolean
): Promise<string> {
  const res = await fetch(`${base()}/cv-improve/suggest`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ skill, proficiency, oldText, jobTitle, found }),
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
  originalCvText: string,
  jobTitle: string,
  improvements: Array<{
    skill: string
    proficiency: string
    sectionId: string | null
    originalText: string | null
    finalText: string
    found: boolean
  }>
): Promise<string> {
  const res = await fetch(`${base()}/cv-improve/merge`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ originalCvText, jobTitle, improvements }),
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
  jobTitle: string
  analysisId: string
  originalCvText: string
  finalCvText: string
  improvements: unknown[]
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
