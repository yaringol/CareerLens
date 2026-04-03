# Backend integration (POC)

This file previously described a **mock-first** flow and pages that are **no longer in the repo**.

## Current source of truth

Use **[`../docs/POC.md`](../docs/POC.md)** for:

- Active endpoints: `GET /api/jobs`, `POST /api/upload`, `POST /api/analyze`
- Request/response shapes
- Which frontend and backend files participate
- Real vs fallback behavior

## Quick reference

| Frontend | Backend |
|----------|---------|
| `src/services/api.ts` | `app.ts` mounts `/api` |
| `fetchJobs()` | `GET /api/jobs` |
| `uploadPdf(file)` — field name **`file`** | `POST /api/upload` |
| `analyzeCv(jobId, cvText)` | `POST /api/analyze` |

Optional env: `VITE_API_BASE_URL` (no trailing slash), e.g. `http://localhost:8000/api`. If unset, the app uses relative `/api` (works with the Vite proxy).

## Not used by the main POC UI

`GET /api/jobs/:id/core-skills`, `POST /api/jobs/extract`, `POST /api/score`, `GET /api/results/:id` — available on the server but not called from `UploadScreen` / `SkillsMatchDashboard`.
