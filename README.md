# CareerLens — Local development

Run **three processes** (DS model + backend + frontend). MongoDB is the **shared team server** — no local install needed unless you opt out via env vars.

## Quick start (after one-time setup)

| # | Service | Directory | Command | URL |
|---|---------|-----------|---------|-----|
| 1 | **DS model** | `ds/model` | `source .venv/bin/activate && python server.py` | http://localhost:8000 |
| 2 | **Backend** | `backend` | `npm run dev` | http://localhost:3000 |
| 3 | **Frontend** | `frontend` | `npm run dev` | http://localhost:8080 |

Open **http://localhost:8080** → register or log in → upload a CV → analyze.

**Testing guide:** see [`docs/TESTING.md`](docs/TESTING.md) for step-by-step manual checks.

---

## One-time setup

### 1. MongoDB (shared team server)

Default connection (used when env vars are unset):

```bash
# App DB (users, CVs, analyses)
MONGODB_URI=mongodb://root:secretpassword@82.70.215.125:27017/careerlens?authSource=admin

# Jobs / pipeline / DS training
MONGO_URI=mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin
JOBS_MONGO_URI=mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin
```

Optional: run MongoDB locally and override these in `backend/.env`.

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

Or with Docker:

```bash
docker run -d -p 27017:27017 --name careerlens-mongo mongo:7
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
MONGODB_URI=mongodb://root:secretpassword@82.70.215.125:27017/careerlens?authSource=admin
JOBS_MONGO_URI=mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin
PORT=3000
JWT_SECRET=your-local-dev-secret
JWT_EXPIRY=7d
BCRYPT_ROUNDS=10
DS_MODEL_URL=http://localhost:8000
OPENAI_API_KEY=sk-...          # optional — real AI scoring; omit for keyword fallback
```

Seed the 5 POC jobs:

```bash
npm run seed
```

### 3. DS model (Python)

Requires **Python 3.11+**.

```bash
cd ds/model
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-server.txt
```

First run downloads the spaCy `en_core_web_lg` model (~500 MB).

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
| MongoDB (shared) | **82.70.215.125:27017** | Databases `careerlens` + `jobs` |

The backend code defaults to port `8000`, which **conflicts** with the DS model. Always use `PORT=3000` in `backend/.env`.

---

## Health checks

```bash
# DS model
curl "http://localhost:8000/text/skills?text=python"

# Backend (401 without login token is OK — server is up)
curl http://localhost:3000/api/jobs

# Frontend
open http://localhost:8080
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
| Stop MongoDB | `brew services stop mongodb-community` |
| Re-seed jobs | `cd backend && npm run seed` |
| Manual testing | see [`docs/TESTING.md`](docs/TESTING.md) |
| Production build (frontend) | `cd frontend && npm run build` |
| Production build (backend) | `cd backend && npm run build && npm start` |
| CV score check script | `cd backend && npm run check-cvs` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `address already in use` on 8000 | DS model already running — OK. Or kill: `lsof -ti:8000 \| xargs kill` |
| `address already in use` on 3000 | `lsof -ti:3000 \| xargs kill` then restart backend |
| `address already in use` on 8080 | `lsof -ti:8080 \| xargs kill` then restart frontend |
| Jobs dropdown empty | Run `cd backend && npm run seed` |
| `JWT_SECRET` errors | Add `JWT_SECRET=...` to `backend/.env` |
| Mongo connection failed | Start MongoDB: `brew services start mongodb-community` |
| Analyze works but scores say "Estimated (AI unavailable)" | Set `OPENAI_API_KEY` in `.env`, or expected when OpenAI is down |
| Frontend can't reach API | Backend must be on **3000**; Vite proxy targets `http://localhost:3000` |

---

## Project layout

```
CareerLens/
├── frontend/     React + Vite (port 8080)
├── backend/      Express + MongoDB (port 3000)
├── ds/model/     FastAPI SkillNer service (port 8000)
├── ds/src/       CV preprocessing pipeline (offline)
└── scraping/     Job scraping tools (not needed for POC demo)
```
