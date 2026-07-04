# DS Model — CareerLens skill inference server

FastAPI server that maps a job title or CV text to a ranked skill list and match confidence.

---

## Setup

```bash
# create venv
uv venv

# install dependencies
uv pip install -r requirements.txt

# run server (port 8000)
python server.py
```

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/title/skills?title=<title>&title_match=<0.0–1.0>` | Top-5 skills for a job title |
| GET | `/title/match?title=<title>` | Nearest canonical titles with confidence |
| GET | `/text/skills?text=<text>` | SkillNer extraction from free text |
| POST | `/cv/title` body `{"text": "..."}` | Extract + canonicalise the job title from a CV |

### `title_match` parameter (DS-7)

Controls how much title-specificity weighs against raw prevalence when ranking skills:

```
score = 0.7 × prevalence + 0.3 × title_match × title_specificity
```

- `title_match=0.0` (default) — pure prevalence, identical to the pre-feature-matrix model
- `title_match=1.0` — boosts skills that appear disproportionately in this role vs. others

### Response fields — `/title/skills`

```json
{
  "suggested_skills": ["python", "kubernetes", ...],
  "matched_canonical": "DevOps Engineer",
  "data_confidence": "high",
  "records_count": 312
}
```

`data_confidence` is `high` (≥100 records), `medium` (≥50), or `low` (<50).

---

## Model artifacts (`model.joblib`)

Trained with `train.py`. Contains:

| Key | Description |
|-----|-------------|
| `vectorizer` | `TfidfVectorizer(analyzer='char_wb', ngram_range=(2,4))` |
| `knn_model` | `NearestNeighbors(n_neighbors=3, metric='cosine')` |
| `skills` | Per-variant sorted skill list (backward-compat) |
| `titles` | Canonical label per KNN variant index |
| `variant_titles` | All title strings used to fit the KNN |
| `feature_matrix` | Per-title skill prevalence + title_specificity scores (DS-8) |
| `trained_at` | ISO timestamp |

`canonical_titles.json` — generated alongside the model. Stores record counts and confidence levels per canonical title.

---

## Training

```bash
# from repo root
python ds/model/train.py
```

Reads `ds/extractor/linkedin_translated_skills.jsonl` and `ds/extractor/alljobs_translated_skills.jsonl`, aggregates weighted skills per canonical title, builds the feature matrix, fits the KNN, and writes both `model.joblib` and a timestamped snapshot.

The model covers **60+ canonical titles** grouped from hundreds of title variants (e.g. "Senior Backend Engineer" → "Software Engineer").

---

## Testing

```bash
# unit tests (no server needed) + smoke tests (requires running server)
python ds/model/test_preferences.py
```

Unit tests inject a mock `feature_matrix` so they verify ranking logic independently of real data. Smoke tests call a live server at `localhost:8000`.

---

## Task log

### DS-7 — Skill preferences / `title_match` parameter
Added `SkillPreferences` schema and `rank_skills()` to the server. The `/title/skills` endpoint now accepts an optional `title_match` float (0.0–1.0) that shifts ranking from pure prevalence toward title-specific skills. Added `test_preferences.py` to cover the ranking logic and validate server responses.

### DS-8 — Canonical titles metadata + feature matrix
`train.py` now computes a `feature_matrix` per canonical title: each skill carries `prevalence` (normalised frequency in this role) and `title_specificity` (IDF-based — how exclusively the skill appears in this role vs. all roles). The matrix is saved into `model.joblib` and summarised in `canonical_titles.json` with per-title record counts and confidence levels.

### CV title extraction
`cv_pipeline.extract_title_from_cv()` uses regex patterns and role-keyword fallback to pull the most recent job title from CV plain text. The server exposes this through the `/cv/title` endpoint, which additionally snaps the extracted title to the nearest canonical label and returns a confidence score.

### Model expansion
Canonical title set grew from 5 POC roles to 60+ roles covering security, embedded, ML/AI, and infrastructure specialisms. Training data is in `ds/extractor/` (LinkedIn + AllJobs, ~67 MB, ~several thousand records).
