import type { TitleMatchSuggestion } from '../services/api'

export const UPLOAD_DRAFT_KEY = 'uploadDraft'

export type UploadJobInputMode = 'posting' | 'cv-only'

export type CachedRoleDetection =
  | { status: 'idle' | 'detecting' | 'not-found' | 'error' }
  | {
      status: 'ready'
      detectedTitle: string
      canonicalTitle: string
      confidence: number
      source?: 'title_extraction' | 'classifier' | 'llm_fallback'
    }
  | { status: 'uncertain'; detectedTitle: string; suggestions: TitleMatchSuggestion[] }

export interface UploadDraft {
  jobDescription: string
  jobInputMode: UploadJobInputMode
  cvTab: 'upload' | 'my-cvs'
  saveToLibrary: boolean
  selectedCvId: string | null
  selectedCvName: string | null
  cvText: string | null
  roleDetection: CachedRoleDetection
  manualTitleQuery?: string
  showManualOverride?: boolean
}

export function readUploadDraft(): UploadDraft | null {
  try {
    const raw = sessionStorage.getItem(UPLOAD_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UploadDraft
  } catch {
    return null
  }
}

export function writeUploadDraft(draft: UploadDraft): void {
  sessionStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify(draft))
}

export function clearUploadDraft(): void {
  sessionStorage.removeItem(UPLOAD_DRAFT_KEY)
}

/** Rebuild a draft from flow session keys when no explicit upload draft exists yet. */
export function buildUploadDraftFromSession(): UploadDraft | null {
  try {
    const inputRaw = sessionStorage.getItem('personalizationInput')
    if (inputRaw) {
      const input = JSON.parse(inputRaw) as {
        cvText?: string
        cvFileName?: string
        jobDescription?: string
        isPostingMode?: boolean
        excludeCvId?: string
        canonicalTitle?: string
        detectedTitle?: string
      }
      if (!input.cvText?.trim()) return null
      return {
        jobDescription: input.jobDescription ?? '',
        jobInputMode: input.isPostingMode === false ? 'cv-only' : 'posting',
        cvTab: 'upload',
        saveToLibrary: true,
        selectedCvId: input.excludeCvId ?? null,
        selectedCvName: input.cvFileName ?? null,
        cvText: input.cvText,
        roleDetection: {
          status: 'ready',
          detectedTitle: input.detectedTitle ?? input.canonicalTitle ?? '',
          canonicalTitle: input.canonicalTitle ?? '',
          confidence: 100,
        },
      }
    }

    const resultRaw = sessionStorage.getItem('analysisResult')
    if (resultRaw) {
      const result = JSON.parse(resultRaw) as {
        cvText?: string
        cvFileName?: string
        jobTitle?: string
      }
      const jobDescription = sessionStorage.getItem('jobDescription') ?? ''
      const excludeCvId = sessionStorage.getItem('excludeCvId') ?? ''
      if (!result.cvText?.trim()) return null
      return {
        jobDescription,
        jobInputMode: jobDescription.trim() ? 'posting' : 'cv-only',
        cvTab: 'upload',
        saveToLibrary: true,
        selectedCvId: excludeCvId || null,
        selectedCvName: result.cvFileName ?? sessionStorage.getItem('cvFileName'),
        cvText: result.cvText,
        roleDetection: {
          status: 'ready',
          detectedTitle: result.jobTitle ?? '',
          canonicalTitle: result.jobTitle ?? '',
          confidence: 100,
        },
      }
    }
  } catch {
    return null
  }
  return null
}
