# CareerLens POC Current Flow

Short overview: the POC is a **single linear path** in the React app. The user uploads a **PDF CV**, picks **one of five seeded jobs**, and submits. The frontend calls the Node backend (`/api/...`), which extracts text, merges **10 skills** (5 static “core” + 5 dynamic), scores them (OpenAI when available, otherwise fallbacks), and returns JSON. The **Skills Match Dashboard** reads the last result from **`sessionStorage`** (set after a successful analyze).

---

# Main Demo Flow

1. **Upload CV** — PDF only; `POST /api/upload` returns extracted normalized text.
2. **Choose one of 5 jobs** — `GET /api/jobs` loads the list; dropdown uses Mongo-backed jobs (seed script inserts five titles).
3. **Analyze** — `POST /api/analyze` with `jobId` + `cvText` from the previous step.
4. **View results** — Navigate to `/dashboard`; UI reads `sessionStorage` key `pocAnalysisResult` and shows job title, 10 skill bars, and match score.

---

# Active API Endpoints

| Method | Path | Role in POC |
|--------|------|-------------|
| `GET` | `/api/jobs` | List jobs for the dropdown (`id`, `title`, `skills` preview from static core map). |
| `POST` | `/api/upload` | Multipart field **`file`** (PDF) → `{ cvText }`. |
| `POST` | `/api/analyze` | JSON body **`{ jobId, cvText }`** → analysis JSON (see Data Contract). |

All are mounted under **`/api`** in `backend/src/app.ts` (default backend port **8000**).

---

# Frontend Flow

| Piece | Path |
|--------|------|
| Entry / routes | `frontend/src/App.tsx` — `/` → `/upload`; `/upload`, `/dashboard`. |
| Upload + submit | `frontend/src/pages/UploadScreen.tsx` — loads jobs, file pick, calls API, writes `sessionStorage`, navigates to dashboard. |
| Results UI | `frontend/src/pages/SkillsMatchDashboard.tsx` — reads `sessionStorage`, renders gauge + `SkillBar` list. |
| HTTP client | `frontend/src/services/api.ts` — `fetchJobs`, `uploadPdf`, `analyzeCv`; base URL `/api` or `VITE_API_BASE_URL`. |
| Dev proxy | `frontend/vite.config.ts` — proxies `/api` → `http://localhost:8000`. |
| UI components | `frontend/src/components/ui/CircularGauge.tsx`, `SkillBar.tsx` |

---

# Backend Flow

| Layer | Path |
|--------|------|
| Mount | `backend/src/app.ts` — `app.use('/api', api)`; CORS + JSON body. |
| Jobs | `backend/src/routes/jobs.routes.ts` → `controllers/jobs.controller.ts` → `services/job.service.ts` / `dal/job.dal.ts`. |
| Upload | `backend/src/routes/cv.routes.ts` → `middleware/upload.ts` → `controllers/cv.controller.ts` → `services/cv.service.ts` (pdf-parse + normalize). |
| Analyze | `backend/src/routes/analyze.routes.ts` → `job.service` (core + dynamic skills), `scoring.service.ts` → `dal/cvAnalysis.dal.ts` (parse + persist). |
| LLM | `backend/src/agents/skillExtraction.agent.ts`, `scoring.agent.ts` → `infra/llm/llmCall.ts`, `openaiClient.ts`, `parseJson.ts`. |
| Static “DS” core | `backend/src/services/dsModel.ts` — fixed 5 skills per known job title (not a live ML service). |
| Seed data | `backend/src/scripts/seed.ts` — five `Job` documents (run manually when setting up DB). |

---

# Data Contract

### `POST /api/upload`

- **Request:** `multipart/form-data`, field name **`file`** (PDF).
- **Response (200):** `{ "cvText": string }` — normalized lowercase text; server rejects empty/too-short extract.

### `POST /api/analyze`

- **Request (JSON):** `{ "jobId": string, "cvText": string }`  
  (`jobId` is Mongo ObjectId string for a seeded job.)

- **Response (200):**
  ```json
  {
    "jobTitle": "string",
    "skills": [{ "name": "string", "score": number }],
    "matchScore": number,
    "id": "string"
  }
  ```
  - **`skills`:** exactly **10** entries (order: 5 core + 5 dynamic in the POC pipeline).
  - **`matchScore`:** aggregate (1 decimal in stored analysis; UI shows gauge + %).

---

# Real vs Fallback Behavior

| Part | What is “real” | Fallback / static |
|------|----------------|-------------------|
| Jobs list | MongoDB documents | **`GET /api/jobs`** returns exactly the five canonical POC titles (in fixed order); extra DB rows are ignored. Fewer than five → **503** with a message to run **`npm run seed`**. |
| PDF text | `pdf-parse` in `cv.service.ts` | Errors → 4xx validation (no fake text). |
| Core 5 skills | Always from **`dsModel.ts`** static map by job title | Placeholder until a real DS/vector pipeline exists (see comments in `job.service.ts`). |
| Dynamic 5 skills | OpenAI extraction from job **description** (`skillExtraction.agent.ts`) when call succeeds | Static per-job or generic lists in `job.service.ts` if LLM fails or key missing. |
| Per-skill scores | OpenAI scoring (`scoring.agent.ts`) when JSON parses | Keyword overlap mock in `scoring.service.ts` if API fails or invalid agent JSON. |
| OpenAI key | `OPENAI_API_KEY` in `backend/.env` | Server boots with placeholder key in code; LLM calls fail through to fallbacks (see `openaiClient.ts`, `pocLog.ts`). |

---

# Out of Scope / Not Main Demo

**Extra backend routes** (not used by Upload → Analyze → Dashboard):

- `GET /api/jobs/:id/core-skills`
- `POST /api/jobs/extract`
- `POST /api/score`
- `GET /api/results/:id`

**Frontend:** there is **no** separate Input/Extract/Results multi-page flow in the current app; only **`/upload`** and **`/dashboard`**. Older docs that reference `ExtractPage`, `SkillDetails`, `CVOptimization`, or polling analyze status are **obsolete** for this repo state.

**Broader product** (not required for this POC demo): scraping pipeline, Python DS folder usage inside this Node analyze path, CV optimization UI, skill deep-dive pages, user history.

---

# Notes for Future Team Work

- **Do not break** the `UploadScreen` sequence: upload → `analyzeCv` → `sessionStorage.setItem('pocAnalysisResult', ...)` → `navigate('/dashboard')`. The dashboard does **not** re-fetch analyze; it only reads storage.
- **OpenAI:** config and client live in `backend/src/infra/llm/`; prompts in `backend/src/agents/`. Adjust models/env there; keep fallbacks in `job.service.ts` and `scoring.service.ts` if you need offline demos.
- **Avoid** duplicating `/api` paths or adding a second “mock” API layer on the frontend — extend **`frontend/src/services/api.ts`** and keep types aligned with `analyze` responses.
- **Jobs count:** `GET /api/jobs` is limited to the five seeded titles; keep `seed.ts` titles in sync with `POC_JOB_TITLES` in `job.dal.ts`.
- **Env:** backend needs Mongo (`MONGODB_URI`) and optionally `OPENAI_API_KEY`; frontend optional `VITE_API_BASE_URL` (defaults to relative `/api` with Vite proxy).
