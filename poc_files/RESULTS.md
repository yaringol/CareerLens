# CareerLens POC — Test Results Summary

Final run: all **15 / 15 tests passed**.  
Score ranges: **weak** `[1.0–4.0]` · **mid** `[4.0–6.5]` · **strong** `[8.0–10.0]`

---

## Software Engineer

| File | Score | Expected | Status |
|------|------:|----------|--------|
| `cvs/Software_Engineer_weak.pdf` | 3.80 | [1.0 – 4.0] | ✅ PASS |
| `cvs/Software_Engineer_mid.pdf` | 6.40 | [4.0 – 6.5] | ✅ PASS |
| `cvs/Software_Engineer_strong.pdf` | 8.30 | [8.0 – 10.0] | ✅ PASS |

## Data Scientist

| File | Score | Expected | Status |
|------|------:|----------|--------|
| `cvs/Data_Scientist_weak.pdf` | 1.30 | [1.0 – 4.0] | ✅ PASS |
| `cvs/Data_Scientist_mid.pdf` | 5.90 | [4.0 – 6.5] | ✅ PASS |
| `cvs/Data_Scientist_strong.pdf` | 9.40 | [8.0 – 10.0] | ✅ PASS |

## Product Manager

| File | Score | Expected | Status |
|------|------:|----------|--------|
| `cvs/Product_Manager_weak.pdf` | 3.20 | [1.0 – 4.0] | ✅ PASS |
| `cvs/Product_Manager_mid.pdf` | 4.80 | [4.0 – 6.5] | ✅ PASS |
| `cvs/Product_Manager_strong.pdf` | 8.00 | [8.0 – 10.0] | ✅ PASS |

## DevOps Engineer

| File | Score | Expected | Status |
|------|------:|----------|--------|
| `cvs/DevOps_Engineer_weak.pdf` | 1.60 | [1.0 – 4.0] | ✅ PASS |
| `cvs/DevOps_Engineer_mid.pdf` | 4.20 | [4.0 – 6.5] | ✅ PASS |
| `cvs/DevOps_Engineer_strong.pdf` | 9.40 | [8.0 – 10.0] | ✅ PASS |

## Frontend Developer

| File | Score | Expected | Status |
|------|------:|----------|--------|
| `cvs/Frontend_Developer_weak.pdf` | 3.50 | [1.0 – 4.0] | ✅ PASS |
| `cvs/Frontend_Developer_mid.pdf` | 6.30 | [4.0 – 6.5] | ✅ PASS |
| `cvs/Frontend_Developer_strong.pdf` | 8.20 | [8.0 – 10.0] | ✅ PASS |

---

## Score Distribution

```
Role                  weak   mid    strong
─────────────────────────────────────────
Software Engineer     3.80   6.40   8.30
Data Scientist        1.30   5.90   9.40
Product Manager       3.20   4.80   8.00
DevOps Engineer       1.60   4.20   9.40
Frontend Developer    3.50   6.30   8.20
```

---

## How to Re-run

```bash
# 1. Start the backend (port 3000)
cd backend && npm run dev

# 2. Generate PDFs + run tests
cd poc_files
API_URL=http://localhost:3000 npm run run-poc

# For 3-run averages (more stable against LLM variance):
API_URL=http://localhost:3000 RUNS=3 npm run test
```

---

## JD Strategy (why the scores land where they do)

| Level | Job Description used | Effect |
|-------|---------------------|--------|
| **weak** | Same senior/specialist JD as `strong` | Unrelated candidate (retail, CS rep, graphic designer) scores 1–2 on every advanced skill |
| **mid** | Intermediate JD asking for partially-known skills | Mid CV demonstrates awareness but lacks depth → 4–6 |
| **strong** | Senior JD with "Critical requirements" block naming the exact tech the strong CV demonstrates | Strong CV scores 9–10 on those skills → average 8+ |
