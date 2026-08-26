# CareerLens - Local development

CareerLens analyses a CV against a job description: it detects the role, ranks the
skills that matter for it from scraped market data, scores the match and rewrites the
CV. Running it locally means **three services** - a FastAPI data-science server holding
the trained models, an Express backend, and a React frontend - plus MongoDB. Connection
strings live in `.env` files; see setup below.

## Quick start (after one-time setup)

Start the DS model first: the backend calls it on startup and the seed script reads its
canonical titles.

| # | Service | Directory | Command | URL |
|---|---------|-----------|---------|-----|
| 1 | **DS model** | `ds/model` | `.venv\Scripts\activate && python server.py`<br>(macOS/Linux: `source .venv/bin/activate && python server.py`) | http://localhost:8000 |
| 2 | **Backend** | `backend` | `npm run dev` | http://localhost:3000 |
| 3 | **Frontend** | `frontend` | `npm run dev` | http://localhost:8080 |

Open **http://localhost:8080** → register or log in → upload a CV → analyze.

**Testing guide:** see [`docs/TESTING.md`](docs/TESTING.md) for step-by-step manual checks.

---

## One-time setup

### 1. MongoDB

Set connection strings in env files (never commit real credentials to git):

| File | Variables |
|------|-----------|
| `backend/.env` | `MONGODB_URI`, `JOBS_MONGO_URI` |
| `ds/model/.env` | `MONGO_URI` (or rely on `JOBS_MONGO_URI` from `backend/.env`) |
| `scraping/.env` | `MONGO_URI` (for LinkedIn scraper) |

Copy the matching `.env.example` in each directory and fill in your URI.

**Local MongoDB** (optional) - Docker is the one command that works on every platform:

```bash
docker run -d -p 27017:27017 --name careerlens-mongo mongo:7
# Then use mongodb://localhost:27017/careerlens and mongodb://localhost:27017/jobs
```

A native install works too: the MongoDB Community Server installer on Windows, or
`brew install mongodb-community` on macOS.

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (copy from `backend/.env.example`):

```env
MONGODB_URI=mongodb://localhost:27017/careerlens
JOBS_MONGO_URI=mongodb://localhost:27017/jobs
PORT=3000
JWT_SECRET=your-local-dev-secret
JWT_EXPIRY=7d
BCRYPT_ROUNDS=10
DS_MODEL_URL=http://localhost:8000
OPENAI_API_KEY=sk-...          # optional - real AI scoring; omit for keyword fallback
```

Seed the roles - this reads the canonical titles from the DS model, so start it first
(step 3) and run the seed afterwards:

```bash
npm run seed
```

### 3. DS model (Python)

Requires **Python 3.11+**.

```bash
cd ds/model
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r ../requirements.txt
```

The models themselves are stored with Git LFS. Run `git lfs install` once and
`git lfs pull` after cloning, or the server will fail to load them.

First run downloads the spaCy `en_core_web_lg` model (~500 MB).

Copy `ds/model/.env.example` to `ds/model/.env` and set `MONGO_URI` (pipeline scripts also read `backend/.env`).

### 4. Frontend

```bash
cd frontend
npm install
```

---

## Ports (important)

| Service | Port | Notes |
|---------|------|-------|
| Frontend (Vite) | **8080** | Proxies `/api` → backend |
| Backend (Express) | **3000** | Set `PORT=3000` in `.env` |
| DS model (FastAPI) | **8000** | SkillNer + title/KNN endpoints |
| MongoDB | **27017** (or your team server) | Databases `careerlens` + `jobs` - set URIs in `.env` |

The backend code defaults to port `8000`, which **conflicts** with the DS model. Always use `PORT=3000` in `backend/.env`.

---

## Health checks

```bash
# DS model
curl "http://localhost:8000/text/skills?text=python"

# Backend (401 without login token is OK - server is up)
curl http://localhost:3000/api/jobs

# Frontend - open in a browser
http://localhost:8080
```

---

## Auth

All main API routes require a JWT. Use the app login page to register, or:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret12"}'
```

---

## Optional commands

| Task | Command |
|------|---------|
| Stop MongoDB (Docker) | `docker stop careerlens-mongo` |
| Re-seed jobs | `cd backend && npm run seed` |
| Manual testing | see [`docs/TESTING.md`](docs/TESTING.md) |
| Production build (frontend) | `cd frontend && npm run build` |
| Production build (backend) | `cd backend && npm run build && npm start` |
| CV score check script | `cd backend && npm run check-cvs` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `address already in use` on 8000 | DS model already running - OK. To free the port: `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` (macOS/Linux: `lsof -ti:8000 \| xargs kill`) |
| `address already in use` on 3000 or 8080 | Same as above with the other port, then restart that service |
| Jobs dropdown empty | Start the DS model, then `cd backend && npm run seed` |
| `JWT_SECRET` errors | Add `JWT_SECRET=...` to `backend/.env` |
| Mongo connection failed | Start MongoDB: `docker start careerlens-mongo` |
| DS model fails to load a model file | `git lfs pull` - the `.joblib` files are LFS pointers until you do |
| Analyze works but scores say "Estimated (AI unavailable)" | Set `OPENAI_API_KEY` in `.env`, or expected when OpenAI is down |
| Frontend can't reach API | Backend must be on **3000**; Vite proxy targets `http://localhost:3000` |

---

## Project layout

```
CareerLens/
├── frontend/     React + Vite (port 8080)
├── backend/      Express + MongoDB, LLM agents (port 3000)
├── ds/model/     FastAPI service: the four trained models (port 8000)
├── ds/final/     Submission snapshot of those models and their trainers
├── ds/src/       CV preprocessing pipeline (offline)
├── pipeline/     Nightly scrape-train-promote job
└── scraping/     LinkedIn job scraper feeding the nightly pipeline
```
