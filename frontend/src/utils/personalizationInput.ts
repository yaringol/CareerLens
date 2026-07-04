export const PERSONALIZATION_INPUT_KEY = 'personalizationInput'

export interface PersonalizationInput {
  canonicalTitle: string
  detectedTitle?: string
  cvText: string
  cvFileName: string
  jobDescription: string
  isPostingMode: boolean
  excludeCvId?: string
}

export function readPersonalizationInput(): PersonalizationInput | null {
  try {
    const raw = sessionStorage.getItem(PERSONALIZATION_INPUT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersonalizationInput
  } catch {
    return null
  }
}

export function savePersonalizationInput(input: PersonalizationInput): void {
  sessionStorage.setItem(PERSONALIZATION_INPUT_KEY, JSON.stringify(input))
}

export function clearPersonalizationInput(): void {
  sessionStorage.removeItem(PERSONALIZATION_INPUT_KEY)
}

/** Same payload whether the user opens personalize from upload or from dashboard. */
export function buildPersonalizationInput(params: {
  canonicalTitle: string
  detectedTitle?: string
  cvText: string
  cvFileName: string
  jobDescription: string
  isPostingMode: boolean
  excludeCvId?: string
}): PersonalizationInput {
  return {
    canonicalTitle: params.canonicalTitle,
    detectedTitle: params.detectedTitle ?? params.canonicalTitle,
    cvText: params.cvText,
    cvFileName: params.cvFileName,
    jobDescription: params.isPostingMode ? params.jobDescription : '',
    isPostingMode: params.isPostingMode,
    excludeCvId: params.excludeCvId || undefined,
  }
}
