# Manual testing guide

No automated tests — follow these steps in the browser.

## 1. Start the app

Open **4 terminals**:

```bash
# 1 — MongoDB (once per reboot)
brew services start mongodb-community

# 2 — DS model
cd ds/model
source .venv/bin/activate
python server.py

# 3 — Backend
cd backend
npm run dev

# 4 — Frontend
cd frontend
npm run dev
```

First time only:

```bash
cd backend && npm run seed
```

Open **http://localhost:8080**

---

## 2. Log in

1. Click **Register**
2. Email: `test@local.dev` — Password: `test1234` (any email, password ? 6 chars)
3. You should leave `/login` and see the home page

---

## 3. Test files (in `test-fixtures/`)

| File | Use for |
|------|---------|
| `sample-cv.pdf` | Good CV — full analyze flow |
| `bad-cv.pdf` | Broken PDF — extraction error |
| `sample-job-description.txt` | Copy-paste into job description field (40+ chars) |

Longer job texts: `CVs/poc_files/job_titles_and_descriptions.txt`

---

## 4. What to check

Go to **http://localhost:8080/upload** (or scroll to upload on home).

### A — Required field markers
Look for red `*` on **Resume**, **Role**, and **Job posting**.

### B — Job description too short
1. Upload `test-fixtures/sample-cv.pdf`
2. Select role **DevOps Engineer**
3. Type `short` in job description
4. Click **Analyze Match**

**Expected:** red error under textarea — `Minimum 40 characters required`

### C — No CV selected
1. Do not upload a file
2. Paste text from `test-fixtures/sample-job-description.txt`
3. Click **Analyze Match**

**Expected:** error — `Upload or select a CV to continue`

### D — Bad PDF
1. Upload `test-fixtures/bad-cv.pdf`
2. Paste `sample-job-description.txt`
3. Click **Analyze Match**

**Expected:** error under dropzone — `Could not extract text from this PDF`

### E — Full analyze (normal)
1. Upload `test-fixtures/sample-cv.pdf`
2. Role: **DevOps Engineer**
3. Paste `sample-job-description.txt`
4. Click **Analyze Match**

**Expected:** dashboard with scores, **no** “Estimated score (AI unavailable)” badge

### F — Estimated score badge (AI fallback)
1. Stop backend (`Ctrl+C`)
2. In `backend/.env` set `OPENAI_API_KEY=invalid`
3. Restart backend: `npm run dev`
4. Repeat test **E**

**Expected:** dashboard still shows scores **with** amber badge — `Estimated score (AI unavailable)`

5. Restore real `OPENAI_API_KEY` when finished

---

## 5. Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank jobs dropdown | `cd backend && npm run seed` |
| Redirected to login | Register / log in first |
| `503` on analyze | Start DS model on `:8000` |
| Port in use | `lsof -ti:3000 \| xargs kill` (backend) or `:8080` (frontend) |
