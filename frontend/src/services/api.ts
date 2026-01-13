/**
 * API Service for CareerLens Backend
 * 
 * Currently returns mock data. Replace with actual API calls when backend is ready.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

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

/**
 * Upload CV and job description
 * TODO: Replace with actual API call
 */
export const uploadCVAndJobDescription = async (
  cvFile: File,
  jobDescription: string,
  jobTitle?: string,
  company?: string
): Promise<UploadResponse> => {
  // Mock implementation
  const formData = new FormData()
  formData.append('cv', cvFile)
  formData.append('jobDescription', jobDescription)
  if (jobTitle) formData.append('jobTitle', jobTitle)
  if (company) formData.append('company', company)

  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/analyze`, {
  //   method: 'POST',
  //   body: formData,
  // })
  // return response.json()

  // Mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        jobId: `job_${Date.now()}`,
        status: 'processing',
      })
    }, 1000)
  })
}

/**
 * Get extraction status
 * TODO: Replace with actual API call (polling or WebSocket)
 */
export const getExtractionStatus = async (jobId: string): Promise<ExtractionStatus> => {
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/status`)
  // return response.json()

  // Mock implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        progress: 100,
        currentStep: 'Calculating match scores...',
        isComplete: true,
        cvSkills: ['Python', 'React', 'TypeScript'],
        jobRequirements: ['Python', 'React', 'Machine Learning'],
      })
    }, 2000)
  })
}

/**
 * Get match results
 * TODO: Replace with actual API call
 */
export const getMatchResults = async (jobId: string): Promise<MatchData> => {
  // TODO: Replace with actual API call
  // const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/results`)
  // return response.json()

  // Mock implementation
  const jobTitle = sessionStorage.getItem('jobTitle') || 'Senior Full Stack Developer'
  const company = sessionStorage.getItem('company') || 'Tech Corp'

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        globalMatchScore: 7.5,
        skills: [
          { name: 'Python', cvScore: 8, jobScore: 9, gap: 1 },
          { name: 'React', cvScore: 7, jobScore: 8, gap: 1 },
          { name: 'TypeScript', cvScore: 6, jobScore: 7, gap: 1 },
          { name: 'Machine Learning', cvScore: 5, jobScore: 8, gap: 3 },
          { name: 'Docker', cvScore: 4, jobScore: 6, gap: 2 },
        ],
        suggestions: [
          'Emphasize your Python experience in the skills section',
          'Add Machine Learning projects to showcase your expertise',
          'Include Docker experience if you have any containerization knowledge',
        ],
        jobTitle,
        company,
      })
    }, 500)
  })
}
