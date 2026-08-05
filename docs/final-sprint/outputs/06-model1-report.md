# Model 1 — Correctness & Data Report (M06)

**Status: phases B–C completed and verified live, 2026-07-28.**
Remaining in the milestone (deferred to a follow-up kickoff by scope decision):
nightly-pipeline repair (`secrets/mongo.env`) and the `model_data` volume landmine.

Two-part milestone. Phase A (2026-07-23) fixed four serving-correctness bugs without
touching the model artifact. Phases B–C (2026-07-27) retrain the model on the local
corpus with an explicit, marked 2023→2026 synthetic continuation.

## Phase A — serving fixes (completed 2026-07-23)

| Bug | Before | After | Fix |
|---|---|---|---|
| Ranking: `Frontend Developer` → top skill `backend` | prevalence-only ranking; `backend` appears in 52/59 roles | react, user experience, vue, web application, rest apis | Ubiquity filter (cap = 48/59 roles) before prevalence ranking (`select_display_skills`) |
| Trend labels 100% `stable` (60,334/60,334) | thresholds 1.25/0.80 vs actual ratio range [0.84, 1.22] — mathematically unreachable | 8,375 rising / 43,585 stable / 8,374 falling | Percentile-based calibration at server load (artifact untouched) |
| Reliability flag false for 100% of skills | code read `time_coverage_reliable`; model stores `time_features_reliable` | 60/295 served skills correctly marked reliable (8,095 model-wide) | One-line key fix + legacy fallback |
| Sparse roles serve n-gram fragments (TPM: 'planning execution', …) | 2-record roles served fabricated top-5 | `limited_data: true` below 25 records | Serving floor, no invented skills |

Commits (local only, by decision): `b1735b2`, `feb5fab`, `09d5895`, `7e3df49`.

## Phases B–C — local corpus, EDA, 2023→2026 continuation, retrain (2026-07-27)

### The gap the user identified

The plan assumed the training corpus was unreachable and had to be rebuilt from
HuggingFace. In fact the **local** Mongo (`careerlens` DB) already holds the full
raw dump — the pipeline was simply pointed at the wrong database (`jobs`) and
expected normalized field names, while the dump keeps the original HuggingFace
fields (`Position`, `Primary Keyword`, `Long Description`, `Published`).

| Collection (careerlens) | Docs | Content |
|---|---|---|
| `lang-uk-job` | 141,897 | raw postings, 2020-01 → 2023-09 |
| `lang-uk-cv` | 210,250 | raw CVs (used by M18, not by this training) |

### Corpus adaptation

* `sample_local_corpus.py` — normalizes raw docs through the **existing**
  `lang_uk_mapping.py` (no second mapping invented) and balances per role:
  cap 4,000/role, seed 42 → **41,745 docs** across 12 canonical roles
  (of 106,979 mapped; Marketing/HR/Sales/etc. are out of taxonomy by design).
* `extract_skills_parallel.py` — SkillNer is ~2.3s/doc single-threaded; the wrapper
  shards pending docs across 12 worker processes (threads capped to avoid
  oversubscription). Checkpoint = `extracted: true` on the source doc — a document
  is never extracted twice; interrupted runs resume.

Sample composition (cap 4,000, seed 42):
Backend 4,000 · Frontend 4,000 · Software Engineer 4,000 · QA Automation 4,000 ·
DevOps 4,000 · Java 4,000 · Product Manager 4,000 · UX Designer 4,000 ·
C++ 3,743 · Data Engineer 2,910 · Data Scientist 2,262 · Cyber Security 830.

### EDA findings

* Corpus time span: **2020-01 → 2023-09** (monthly Published distribution in the
  notebook `ds/model/model1_retrain.ipynb`). 2026-relevant skills (LLM, RAG,
  agents, …) are absent from the real data — it predates them.
* Extraction yield: **41,745 docs → 773,696 (doc, skill) observations, 21,103
  distinct skills** (~90 SkillNer per-doc failures skipped gracefully, <0.25%).
* Full EDA (top-12 per role, skill×month prevalence curves, significant
  risers/fallers within 2020–2023) executed and rendered inside the notebook.
* Base pools look right per role: Frontend = javascript/react/typescript/css,
  DevOps = kubernetes top-tier, UX = figma, Data Engineer = sql/etl.

### 2023→2026 synthetic continuation — methodology (full transparency)

The real corpus ends mid-2023. Per explicit user decision (kickoff 2026-07-27),
the timeline is extended to 2026H1 with **synthetic** records:

* **Curated market lists** (`market_2026_skills.py`): per role, the skills that
  entered/grew in the market 2024–2026 (e.g. Data Scientist: llm, rag, fine tuning,
  ai agents; DevOps: gitops, argocd, platform engineering, llmops; QA: playwright,
  ai assisted testing), each with a linear half-year prevalence ramp
  (start period, start/end probability), plus per-role fading skills
  (jquery, selenium, hadoop, …) that are down-weighted.
* **Generator** (`augment_2026.py`): base skills of each synthetic posting are
  sampled from the role's **real** extracted distribution, so synthetic records
  look like the market they extend; emerging skills are injected per the ramp;
  150 docs/role/half-year × 6 half-years.
* **Marking**: every record carries `source='augmented-2026'`, `augmented: true`,
  `augmentation_method='curated-list-ramp-v1'`. Synthetic data is never mixed
  silently with real data; this section is the book-facing disclosure.

### Training

`train.py` unchanged (single source of truth), pointed at the local collections:

```
MONGO_URI=mongodb://localhost:27017/careerlens
SOURCE_WEIGHTS=lang-uk-job-skills:1.0,augmented-2026:1.0
RECENCY_HALF_LIFE_DAYS=365   TREND_WINDOW_DAYS=365
```

The two time constants are env-tunable by design; the defaults (14/7 days) were
built for a continuously-scraped, "now"-anchored corpus — against a 6-year corpus
they would annihilate history (a 2023 posting would weigh 0.5^75 ≈ 10⁻²³). 365/365
means postings decay by half per year and "recent" = the last year.

`model.joblib` backed up before promotion; promotion gate must pass
(first-promote path in the local DB: ≥200 records, ≥8 roles with data, ≥3 roles ≥50).

### Two fixes required along the way

1. **Mixed naive/aware datetimes crashed `train.py`** when combining Mongo-stored
   real docs (BSON → naive) with in-memory synthetic records (tz-aware).
   Fixed in the *generator*, not in train.py: `augment_2026.py` now precomputes
   `skill_records` exactly like `extract_skills.py` does, so both sources take
   the identical stored-records path.
2. **The phase-A ubiquity filter saturated on the dense corpus**: with 3–4K
   postings per role, *every* skill appears at least once in *every* role
   (react = 12/12 roles, same as 'english'), so presence-only role-counts could
   not separate boilerplate from stack skills. Fix (backward-compatible):
   `compute_role_counts(min_prevalence=…)` counts a role only where the skill's
   prevalence ≥ floor; new env `ROLE_COUNT_MIN_PREVALENCE` (default 0.0 = legacy).
   Serving config for this model: `SKILL_UBIQUITY_CAP=11`,
   `ROLE_COUNT_MIN_PREVALENCE=0.05` (with the floor, english=12/12 → filtered;
   react=4, typescript=2, figma=1 → kept). Unit tests still pass (7/7).

### Results — before / after

| Metric | Old live model | New model (`trained_at=20260728_005411`) |
|---|---|---|
| Training records | 12,485 (not reproducible — source data lost) | 52,545 (41,745 real + 10,800 marked synthetic), fully reproducible from local Mongo |
| Roles with data | 59 (many sparse; TPM = 2 records) | 12 balanced roles (830–4,000 real records each); other 47 → honest `limited_data` |
| Time span | recent-scrape snapshot | 2020-01 → 2026-06 (2023H2+ marked synthetic) |
| (role, skill) rows | 60,334 | 66,257 |
| 2026 skills (llm/rag/agents/…) | absent | all present; llm/rag/playwright/gitops labeled **rising** in the stored artifact (llm ratio 1.54, growth_trend 1.0); jquery growth −0.28 |
| Trend labels | degenerate pre-calibration | rising/stable/falling all present stored (163/66,085/9) + serve-time recalibration active (137/66,086/34) |
| Frontend top-5 | fixed by phase A filter | typescript, react, node js, html, css |
| Promotion | — | gate passed (first-promote path in local DB); versioned snapshot + backup `model.joblib.bak-20260728` kept |

### Serving verification (2026-07-28, all live)

* DS server restarted with the new artifact + env
  (`MONGO_URI=…/careerlens SKILL_UBIQUITY_CAP=11 ROLE_COUNT_MIN_PREVALENCE=0.05`).
* `/title/skills`: Frontend = typescript/react/node js/html/css ·
  Data Scientist = llm/generative ai/pytorch/data science/deep learning ·
  DevOps = kubernetes/terraform/python/ansible/bash · UX = figma/user research/… ·
  QA = manual testing/test plans/automation/api/scrum. `time_coverage_reliable: true`
  on all served skills. TPM (uncovered role) → `limited_data: true`, **empty**
  skills list — no fabrication.
* `/title/trending-skills` (Data Scientist): llm **rising**, data science
  **falling**, real `growth_trend` values — the "market trends over time" claim
  is now system-supported.
* **Slider** — API extremes: stable-pref → python/sql/analytics/computer
  science/algorithms; trending-pref → llm/generative ai/pytorch/data science/deep
  learning. **UI (Playwright, full flow)**: login → CV upload
  (datascientist fixture, auto-detected Data Scientist 96.16%) → Personalize.
  Stable preset and Custom 0/100/0 produce the two different lists end-to-end on
  the dashboard (screenshots `06-slider-stable-dashboard.png`,
  `06-slider-trending-dashboard.png` — the latter also shows M15's gap table
  working on the new skills with real CV evidence and a rising-trend arrow).
* **UX calibration note (for M03/M11):** the built-in *Trending preset* maps to
  stabilityPreference 0.8, and because stability scores compress toward 0.97–1.0
  on this corpus its top-5 equals the Stable list; only the Custom 0/100/0
  extreme (preference 1.0) surfaces the trending stack. Consider remapping the
  preset to 1.0 (frontend constant) — deliberately **not** changed here (out of
  scope for M06).

### Operational notes

* The notebook `ds/model/model1_retrain.ipynb` re-runs the whole chain
  top-to-bottom (verified: 0 errors); extraction cells are checkpoint-aware.
* Training-time env used: `RECENCY_HALF_LIFE_DAYS=365 TREND_WINDOW_DAYS=365`
  (rationale in §Training). Serving env: see above — **the DS server should be
  started with these values as long as this model is live** (docker-compose /
  deploy env update belongs to the nightly-pipeline follow-up).
* `model_runs` + `role_skill_features` (66,257 rows) recorded in the `careerlens`
  DB; the Admin model-status tab reads whichever DB the DS server points to —
  aligned when the server runs with the env above.

### Known limitations (for the book)

* 2024–2026 market signal is curated, not scraped — the ramp encodes our market
  knowledge, not measured postings. Replacing it with real scrape runs is the
  natural next step (nightly pipeline, phase C follow-up).
* 12 of 59 canonical roles are covered by the local corpus; the remaining 47 fall
  back to `limited_data` / LLM path (phase A floor).
* lang-uk is Ukraine-centric (Djinni); geographic bias documented.
