/**
 * API base: relative `/api` in dev (Vite proxies to backend) unless VITE_API_BASE_URL is set.
 */
import { clearUserFlowSession } from '../utils/userFlowSession'

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
    clearUserFlowSession()
    localStorage.removeItem('auth_token')
    sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search)
    window.location.href = '/login'
  }
}

// LLM-backed endpoints legitimately take tens of seconds; everything else
// should answer fast. Both get a hard ceiling so the UI can never hang on a
// spinner forever, and pure network failures become a human-readable error
// instead of the browser's raw "Failed to fetch".
const DEFAULT_TIMEOUT_MS = 20_000
export const LLM_TIMEOUT_MS = 90_000

async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let res: Response
  try {
    res = await fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('The server is taking too long to respond. Please try again.', 0)
    }
    throw new ApiError(
      'Cannot reach the CareerLens server. Check that the application services are running.',
      0,
    )
  }
  await handleUnauthorized(res)
  if (!res.ok) {
    throw await parseErrorResponse(res)
  }
  return res
}

export interface RoleOption {
  id: string
  title: string
  skills: string[]
}

export interface UploadPdfResponse {
  cvId: string
  cvText: string
  headerText?: string
  /** Original extracted text (casing/punctuation/line breaks intact) - feeds improve/export. */
  rawText?: string
  fileName: string
}

export interface DetectedCvTitle {
  detectedTitle: string | null
  confidence: number
  source: 'classifier' | 'llm_fallback' | 'none'
  suggestions: TitleMatchSuggestion[]
}

export interface TitleMatchSuggestion {
  canonicalTitle: string
  matchedVariant: string
  confidence: number
  source?: 'title_extraction' | 'classifier' | 'llm_fallback'
}

export interface AnalyzeResponse {
  jobTitle: string
  skills: Array<{ name: string; score: number; trend?: 'rising' | 'stable' | 'falling' }>
  matchScore: number
  id: string
  cvOnlyMode?: boolean
  isEstimated?: boolean
  bestSavedCv?: CompareSavedResponse['bestSavedCv']
}

// ── Personalization ───────────────────────────────────────────────────────

export type SkillSource = 'cv' | 'role' | 'market'

export interface SkillOption {
  id: string
  name: string
  source: SkillSource
  score: number
  selectedByDefault: boolean
}

export interface PersonalizationOptions {
  detectedTitle: string
  extractedCvSkills: string[]
  roleDerivedSkills: SkillOption[]
}

export type RecommendationMode = 'stable' | 'balanced' | 'trending' | 'custom'

export interface PersonalizationWeights {
  stable: number
  trending: number
  personalMatch: number
}

export interface PersonalizationContract {
  personalizationSessionId?: string
  canonicalTitle: string
  cvText: string
  jobDescription?: string
  isPostingMode?: boolean
  excludeCvId?: string
  personalization: {
    mode: RecommendationMode
    weights: PersonalizationWeights
    selectedSkillIds: string[]
    selectedSkillNames?: string[]
  }
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

export async function fetchJobs(): Promise<RoleOption[]> {
  const res = await apiFetch(`${base()}/jobs`, {
    headers: { ...authHeaders() },
  })
  return res.json() as Promise<RoleOption[]>
}

export async function uploadPdf(file: File, saveToLibrary = true): Promise<UploadPdfResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const url = saveToLibrary ? `${base()}/upload` : `${base()}/upload?save=false`
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  }, LLM_TIMEOUT_MS)
  return res.json() as Promise<UploadPdfResponse>
}

export async function detectCvTitle(cvText: string, headerText?: string): Promise<DetectedCvTitle> {
  const res = await apiFetch(`${base()}/cv/title`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ cvText, headerText }),
  }, LLM_TIMEOUT_MS)
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
  }, LLM_TIMEOUT_MS)
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

export async function getCvText(cvId: string): Promise<{ cvId: string; cvText: string; headerText?: string; rawText?: string; fileName: string }> {
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
  }, LLM_TIMEOUT_MS)
  return res.json() as Promise<AnalyzeResponse>
}

/**
 * Fetch the data the Personalization screen renders: detected title, the user's
 * CV-extracted skills, and, in posting mode, the dynamic focus-skill pool.
 */
export async function getPersonalizationOptions(payload: {
  canonicalTitle: string
  cvText: string
  jobDescription?: string
  isPostingMode?: boolean
}): Promise<PersonalizationOptions> {
  const res = await apiFetch(`${base()}/personalize/options`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  }, LLM_TIMEOUT_MS)
  return res.json() as Promise<PersonalizationOptions>
}

/**
 * Submit the personalization contract. The personalized model path is not active
 * yet, so this currently throws an ApiError with code PERSONALIZATION_NOT_IMPLEMENTED
 * (HTTP 501); callers branch on that to offer the standard-analysis fallback.
 */
export async function analyzePersonalized(contract: PersonalizationContract): Promise<AnalyzeResponse> {
  const res = await apiFetch(`${base()}/analyze/personalized`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(contract),
  }, LLM_TIMEOUT_MS)
  return res.json() as Promise<AnalyzeResponse>
}

/** Saved Recommendation Balance - full mode + weights, persisted on the user's account. */
export interface SavedPersonalization {
  mode: RecommendationMode
  weights: PersonalizationWeights
}

export async function getSavedPersonalization(): Promise<SavedPersonalization | null> {
  const res = await apiFetch(`${base()}/personalize/preference`, {
    headers: { ...authHeaders() },
  })
  const data = (await res.json()) as {
    preference: ({ mode: RecommendationMode } & PersonalizationWeights) | null
  }
  if (!data.preference) return null
  const { mode, stable, trending, personalMatch } = data.preference
  return { mode, weights: { stable, trending, personalMatch } }
}

export async function savePersonalization(pref: SavedPersonalization): Promise<void> {
  await apiFetch(`${base()}/personalize/preference`, {
    method: 'PUT',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ mode: pref.mode, weights: pref.weights }),
  })
}

export async function clearSavedPersonalization(): Promise<void> {
  await apiFetch(`${base()}/personalize/preference`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
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
  const res = await apiFetch(`${base()}/cv-improve/prepare`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ cvText, weakSkills }),
  }, LLM_TIMEOUT_MS)
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
  const res = await apiFetch(`${base()}/cv-improve/suggest`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify(payload),
  }, LLM_TIMEOUT_MS)
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
  skills: string[],
  options: { cvOnlyMode?: boolean; excludeCvId?: string } = {}
): Promise<AnalyzeResponse> {
  const res = await apiFetch(`${base()}/analyze/rescore`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({
      jobTitle,
      cvText,
      skills,
      cvOnlyMode: options.cvOnlyMode ?? false,
      excludeCvId: options.excludeCvId,
    }),
  }, LLM_TIMEOUT_MS)
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
  const res = await apiFetch(`${base()}/cv-improve/merge`, {
    method: 'POST',
    headers: { ...jsonHeaders, ...authHeaders() },
    body: JSON.stringify({ sections }),
  }, LLM_TIMEOUT_MS)
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
  const res = await apiFetch(`${base()}/cv-improve/sessions`, {
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
  const res = await apiFetch(`${base()}/cv-improve/sessions`, {
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
  const res = await apiFetch(`${base()}/cv-improve/sessions/${id}`, {
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
  const res = await apiFetch(`${base()}/cv-improve/sessions/${id}`, {
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
  limit?: number
  offset?: number
}): Promise<{
  items: Array<{ id: string; jobTitle: string; matchScore: number; createdAt: string; userEmail: string | null }>
  total: number
  limit: number
  offset: number
  hasMore: boolean
}> {
  const params = new URLSearchParams()
  if (filters?.jobTitle) params.set('jobTitle', filters.jobTitle)
  if (filters?.minScore !== undefined) params.set('minScore', String(filters.minScore))
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset))

  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await apiFetch(`${base()}/admin/analyses${query}`, {
    headers: { ...authHeaders() },
  })
  const body = await res.json()
  if (Array.isArray(body)) {
    return {
      items: body,
      total: body.length,
      limit: body.length,
      offset: 0,
      hasMore: false,
    }
  }
  return body
}

export interface AdminModelTitleRow {
  title: string
  skillCount: number
  recordsCount: number
  dataConfidence: 'high' | 'medium' | 'low'
  timeFeaturesReliable: boolean
  trends: { rising: number; stable: number; falling: number }
}

export interface AdminLangUkExtractProgress {
  extracted: number | null
  total: number
  pending: number | null
}

export interface AdminModelStatusSummaryResponse {
  model1: {
    lastRun: {
      runId: string
      trainedAt: string | null
      promoted: boolean
      promoteReason: string | null
      titlesWithData: number
      sourceWeights: Record<string, number>
      isLiveModel: boolean
    } | null
    liveRun: {
      runId: string
      trainedAt: string | null
      titlesWithData: number
    } | null
    runHistory: Array<{
      runId: string
      trainedAt: string | null
      promoted: boolean
      promoteReason: string | null
      titlesWithData: number
    }>
    titlesRunId: string | null
    titlesTotal: number
    rawPostingsCount: number
    pendingExtractionCount: number | null
    jobsCount: number
    langUkSkillsCount: number
    langUkExtractProgress: AdminLangUkExtractProgress
    unifiedObservations: { total: number; linkedin: number; langUk: number }
    countsAreEstimated?: boolean
  }
}

export interface AdminModelStatusCollectionStatsResponse {
  pendingExtractionCount: number
  langUkExtractProgress: {
    extracted: number
    total: number
    pending: number
  }
}

export interface AdminModelStatusTitlesResponse {
  runId: string
  titles: AdminModelTitleRow[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

/** @deprecated Prefer fetchAdminModelStatusSummary + chunked loaders. */
export type AdminModelStatusResponse = AdminModelStatusSummaryResponse & {
  model1: AdminModelStatusSummaryResponse['model1'] & {
    titles: AdminModelTitleRow[]
    pendingExtractionCount: number
    langUkExtractProgress: { extracted: number; total: number; pending: number }
  }
}

export async function fetchAdminModelStatusSummary(): Promise<AdminModelStatusSummaryResponse> {
  const res = await apiFetch(`${base()}/admin/model-status`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}

export async function fetchAdminModelStatusCollectionStats(): Promise<AdminModelStatusCollectionStatsResponse> {
  const res = await apiFetch(`${base()}/admin/model-status/collection-stats`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}

export async function fetchAdminModelStatusTitles(
  runId: string,
  offset = 0,
  limit = 25,
): Promise<AdminModelStatusTitlesResponse> {
  const params = new URLSearchParams({
    runId,
    offset: String(offset),
    limit: String(limit),
  })
  const res = await apiFetch(`${base()}/admin/model-status/titles?${params.toString()}`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}

/** @deprecated Prefer fetchAdminModelStatusSummary. */
export async function fetchAdminModelStatus(): Promise<AdminModelStatusResponse> {
  return fetchAdminModelStatusSummary() as Promise<AdminModelStatusResponse>
}

export interface AdminPipelineRun {
  id: string
  status: 'running' | 'completed' | 'failed' | 'aborted'
  triggeredBy: string
  command: string
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  logTail: string
  abortedBy?: string | null
}

export interface AdminPipelineStatusResponse {
  enabled: boolean
  manualCommand: string
  activeRun: AdminPipelineRun | null
  lastRun: AdminPipelineRun | null
}

export async function fetchAdminPipelineStatus(): Promise<AdminPipelineStatusResponse> {
  const res = await apiFetch(`${base()}/admin/pipeline/status`, {
    headers: { ...authHeaders() },
  })
  return res.json()
}

export async function triggerAdminPipeline(): Promise<AdminPipelineRun> {
  const res = await apiFetch(`${base()}/admin/pipeline/trigger`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })
  if (res.status === 202) {
    return res.json()
  }
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || `Pipeline trigger failed (${res.status})`)
}

export async function abortAdminPipeline(): Promise<{ id: string; status: 'aborted'; abortedBy: string }> {
  const res = await apiFetch(`${base()}/admin/pipeline/abort`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })
  if (res.ok) {
    return res.json()
  }
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || `Pipeline abort failed (${res.status})`)
}
