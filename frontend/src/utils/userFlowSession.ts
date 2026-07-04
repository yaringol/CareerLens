import { UPLOAD_DRAFT_KEY } from './uploadDraftCache'

/** Session keys for the upload-to-analyze flow (cleared on logout / new login). */
export const USER_FLOW_SESSION_KEYS = [
  UPLOAD_DRAFT_KEY,
  'personalizationInput',
  'personalizationPreferences',
  'analysisResult',
  'previousAnalysisResult',
  'jobDescription',
  'cvFileName',
  'excludeCvId',
] as const

/** Remove upload/analyze flow state. Keeps auth_redirect for post-login navigation. */
export function clearUserFlowSession(): void {
  for (const key of USER_FLOW_SESSION_KEYS) {
    sessionStorage.removeItem(key)
  }
}
