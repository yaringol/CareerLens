/**
 * API Service for CareerLens Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface UploadResponse {
  jobId: string
  status: 'processing' | 'completed'
}

export interface ExtractionStatus {
  progress: number
  currentStep: string
  isComplete: boolean
  cvSkills?: string[]
  jobRequirements?: string[]
}

export interface MatchData {
  globalMatchScore: number
  skills: Array<{
    name: string
    cvScore: number
    jobScore: number
    gap: number
  }>
  suggestions: string[]
  jobTitle: string
  company: string
}

export const uploadCVAndJobDescription = async (
  cvFile: File,
  jobDescription: string,
  jobTitle?: string,
  company?: string
): Promise<UploadResponse> => {
  const selectedJobTitle =
    jobTitle ||
    sessionStorage.getItem('jobTitle') ||
    'Data Scientist'

  if (company) {
    sessionStorage.setItem('company', company)
  }
  sessionStorage.setItem('jobTitle', selectedJobTitle)

  const uploadFormData = new FormData()
  uploadFormData.append('file', cvFile)

  const uploadResponse = await fetch(`${API_BASE_URL}/cv/upload`, {
    method: 'POST',
    body: uploadFormData,
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload CV')
  }

  const uploadResult = await uploadResponse.json()

  const cvText =
    uploadResult.cvText ||
    uploadResult.text ||
    uploadResult.extractedText ||
    uploadResult.cvTextExtracted

  if (!cvText) {
    throw new Error('CV text was not returned from upload endpoint')
  }

  const analyzeResponse = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobTitle: selectedJobTitle,
      jobDescription,
      cvText,
    }),
  })

  if (!analyzeResponse.ok) {
    throw new Error('Failed to analyze CV against job description')
  }

  const analyzeResult = await analyzeResponse.json()

  return {
    jobId: analyzeResult.id,
    status: 'completed',
  }
}

export const getExtractionStatus = async (_jobId: string): Promise<ExtractionStatus> => {
  return {
    progress: 100,
    currentStep: 'Analysis completed',
    isComplete: true,
  }
}

export const getMatchResults = async (jobId: string): Promise<MatchData> => {
  const response = await fetch(`${API_BASE_URL}/results/${jobId}`)

  if (!response.ok) {
    throw new Error('Failed to fetch match results')
  }

  const result = await response.json()

  return {
    globalMatchScore: result.globalMatchScore ?? 0,
    skills: result.skills ?? [],
    suggestions: result.suggestions ?? [],
    jobTitle: result.jobTitle || sessionStorage.getItem('jobTitle') || 'Unknown Job Title',
    company: sessionStorage.getItem('company') || 'CareerLens',
  }
}