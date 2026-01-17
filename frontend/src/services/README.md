# API Service

This directory contains API service functions for communicating with the backend.

## Current Status

**All functions currently return mock data.** They are structured to be easily replaced with real API calls when the backend is ready.

## Functions

### `uploadCVAndJobDescription()`
Uploads CV file and job description to the backend.

**TODO:** Replace the mock implementation with:
```typescript
const response = await fetch(`${API_BASE_URL}/analyze`, {
  method: 'POST',
  body: formData,
})
return response.json()
```

### `getExtractionStatus()`
Polls the backend for extraction progress.

**TODO:** Replace with polling or WebSocket connection:
```typescript
const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/status`)
return response.json()
```

### `getMatchResults()`
Fetches the final match analysis results.

**TODO:** Replace with:
```typescript
const response = await fetch(`${API_BASE_URL}/analyze/${jobId}/results`)
return response.json()
```

## Environment Variables

Set `VITE_API_BASE_URL` in `.env` file:
```
VITE_API_BASE_URL=http://localhost:8000/api
```
