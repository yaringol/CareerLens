# API service (`api.ts`)

These functions call the **real** backend over HTTP (not mocks).

| Function | Method | Path | Purpose |
|----------|--------|------|---------|
| `fetchJobs()` | GET | `/api/jobs` | Job list for the upload screen |
| `uploadPdf(file)` | POST | `/api/upload` | `FormData` field **`file`** → `{ cvText }` |
| `analyzeCv(jobId, cvText, jobDescription)` | POST | `/api/analyze` | JSON `{ jobId, cvText, jobDescription }` (JD min 40 chars) → analyze result |

Base URL: `import.meta.env.VITE_API_BASE_URL` or **`/api`** (Vite dev proxy to port 8000).

See **[`../../../docs/POC.md`](../../../docs/POC.md)** for full contracts and fallback behavior.
