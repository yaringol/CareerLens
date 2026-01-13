# Backend Integration Guide

This document outlines where mock data is currently used and where backend API calls should be integrated.

## Current Status: All Data is Mocked

All pages currently use mock/hardcoded data. The backend integration points are ready in `src/services/api.ts`.

## Integration Points

### 1. **UploadScreen** (`src/pages/UploadScreen.tsx`)
**Current:** File and job description stored in `sessionStorage`, then navigates to extract page.

**Backend Integration:**
- Replace lines 41-45 with:
```typescript
import { uploadCVAndJobDescription } from '../services/api'

const response = await uploadCVAndJobDescription(cvFile, jobDescription)
sessionStorage.setItem('jobId', response.jobId)
navigate('/extract')
```

**API Function:** `uploadCVAndJobDescription()` in `src/services/api.ts`
- Currently mocked (lines 39-68)
- TODO: Uncomment the actual fetch call (lines 53-57)

---

### 2. **ExtractPage** (`src/pages/ExtractPage.tsx`)
**Current:** Simulated progress with timer (lines 11-39)

**Backend Integration:**
- Replace the timer logic with polling:
```typescript
import { getExtractionStatus } from '../services/api'

useEffect(() => {
  const jobId = sessionStorage.getItem('jobId')
  if (!jobId) {
    navigate('/upload')
    return
  }

  const pollStatus = async () => {
    const status = await getExtractionStatus(jobId)
    setExtractionProgress(status.progress)
    setCurrentStep(status.currentStep)
    
    if (status.isComplete) {
      navigate('/dashboard')
    } else {
      setTimeout(pollStatus, 1000) // Poll every second
    }
  }
  
  pollStatus()
}, [navigate])
```

**API Function:** `getExtractionStatus()` in `src/services/api.ts`
- Currently mocked (lines 74-91)
- TODO: Uncomment the actual fetch call (lines 76-77)
- Consider WebSocket for real-time updates instead of polling

---

### 3. **SkillsMatchDashboard** (`src/pages/SkillsMatchDashboard.tsx`)
**Current:** Hardcoded mock data (lines 20-28)

**Backend Integration:**
- Replace mock data with API call:
```typescript
import { getMatchResults } from '../services/api'

useEffect(() => {
  const jobId = sessionStorage.getItem('jobId')
  if (!jobId) {
    navigate('/upload')
    return
  }

  const fetchResults = async () => {
    const results = await getMatchResults(jobId)
    setOverallScore(results.globalMatchScore * 10) // Convert to percentage
    // Separate core and dynamic skills based on results.skills
    // setCoreSkills(...)
    // setDynamicSkills(...)
  }
  
  fetchResults()
}, [navigate])
```

**API Function:** `getMatchResults()` in `src/services/api.ts`
- Currently mocked (lines 97-127)
- TODO: Uncomment the actual fetch call (lines 99-100)
- Update interface to match backend response structure

---

### 4. **SkillDetails** (`src/pages/SkillDetails.tsx`)
**Current:** Hardcoded mock skills array (lines 24-89)

**Backend Integration:**
- Replace mock data with API call:
```typescript
import { getSkillDetails } from '../services/api' // Need to create this function

useEffect(() => {
  const jobId = sessionStorage.getItem('jobId')
  const skillIndex = parseInt(searchParams.get('skill') || '0', 10)
  
  const fetchSkillDetails = async () => {
    const skills = await getSkillDetails(jobId)
    setAllSkills(skills)
    setCurrentSkill(skills[skillIndex])
  }
  
  fetchSkillDetails()
}, [searchParams])
```

**New API Function Needed:** Add to `src/services/api.ts`:
```typescript
export const getSkillDetails = async (jobId: string): Promise<SkillDeepDive[]> => {
  const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/skills`)
  return response.json()
}
```

---

### 5. **CVOptimization** (`src/pages/CVOptimization.tsx`)
**Current:** Hardcoded before/after CV text (lines 9-54)

**Backend Integration:**
- Replace with API call:
```typescript
import { getOptimizedCV } from '../services/api' // Need to create this function

useEffect(() => {
  const jobId = sessionStorage.getItem('jobId')
  
  const fetchOptimizedCV = async () => {
    const cvData = await getOptimizedCV(jobId)
    setImprovedCV(cvData.improvedVersion)
    setOriginalCV(cvData.originalVersion)
    setImprovements(cvData.improvements)
  }
  
  fetchOptimizedCV()
}, [])
```

**New API Functions Needed:** Add to `src/services/api.ts`:
```typescript
export const getOptimizedCV = async (jobId: string) => {
  const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/optimized-cv`)
  return response.json()
}

export const downloadPDF = async (jobId: string) => {
  const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/download-pdf`, {
    method: 'GET',
  })
  const blob = await response.blob()
  // Handle blob download
}

export const applyCVChanges = async (jobId: string, improvedCV: string) => {
  const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/apply-changes`, {
    method: 'POST',
    body: JSON.stringify({ cv: improvedCV }),
    headers: { 'Content-Type': 'application/json' },
  })
  return response.json()
}
```

---

## API Service File Structure

**File:** `src/services/api.ts`

All functions are currently mocked. To integrate:

1. **Set API Base URL** in `.env`:
   ```
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

2. **Uncomment fetch calls** in existing functions
3. **Add new functions** for SkillDetails and CVOptimization
4. **Update TypeScript interfaces** to match backend response structure

---

## Backend Endpoints Expected

Based on the current structure, your backend should provide:

1. `POST /api/analyze` - Upload CV and job description
   - Returns: `{ jobId: string, status: 'processing' }`

2. `GET /api/analyze/:jobId/status` - Get extraction progress
   - Returns: `{ progress: number, currentStep: string, isComplete: boolean }`

3. `GET /api/analyze/:jobId/results` - Get match results
   - Returns: Match data with scores and skills

4. `GET /api/analyze/:jobId/skills` - Get detailed skill analysis
   - Returns: Array of skill deep dive objects

5. `GET /api/analyze/:jobId/optimized-cv` - Get optimized CV
   - Returns: `{ originalVersion: string, improvedVersion: string, improvements: string[] }`

6. `GET /api/analyze/:jobId/download-pdf` - Download optimized CV as PDF
   - Returns: PDF file

7. `POST /api/analyze/:jobId/apply-changes` - Save optimized CV
   - Body: `{ cv: string }`
   - Returns: Success confirmation

---

## Summary

**All data is currently mocked in:**
- ✅ `src/services/api.ts` - API service functions (ready for backend)
- ✅ `src/pages/UploadScreen.tsx` - File upload (uses sessionStorage)
- ✅ `src/pages/ExtractPage.tsx` - Progress simulation (timer-based)
- ✅ `src/pages/SkillsMatchDashboard.tsx` - Hardcoded scores and skills
- ✅ `src/pages/SkillDetails.tsx` - Hardcoded skill deep dive data
- ✅ `src/pages/CVOptimization.tsx` - Hardcoded before/after CV

**To integrate backend:**
1. Update `src/services/api.ts` - Uncomment fetch calls
2. Update each page component - Replace mock data with API calls
3. Set `VITE_API_BASE_URL` environment variable
4. Test with your backend API
