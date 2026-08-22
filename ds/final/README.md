# ds/final — The Production Models

This folder is the canonical, submission-ready snapshot of the **four learned models
CareerLens actually serves in production**, each with its training notebook/script and
the exact `.joblib` artifact the DS server loads.

> **Runtime note:** the DS server (`ds/model/server.py`) and the Docker image
> (`ds/Dockerfile`) load the artifacts from **`ds/model/`** — those copies are the live
> ones and must stay there. The `.joblib` files here are byte-identical copies (same
> Git-LFS object, so they add no repository weight). The notebooks were **moved** here;
> their first cell `chdir`s back to `ds/model` so they still run unchanged (helper
> modules like `taxonomy.py`, `train.py` and the data checkpoints live there).

## Model 1 — Title → Skills (`model.joblib` + `model1_retrain.ipynb`)

- **Purpose:** given a canonical job title, return its ranked skill list with trend
  labels (rising / stable / falling) and stability scores. Powers the skills dashboard.
- **Trained by:** `model1_retrain.ipynb` (M06, retrained 2026-07-28) — a checkpointed
  chain over the local corpus (`careerlens.lang-uk-job`, 41,745 balanced postings,
  2020–2023) plus 10,800 synthetic records marked `source='augmented-2026'`
  (skill ramps from `ds/model/market_2026_skills.py`). The notebook drives
  `ds/model/train.py`, which writes the artifact.
- **Loaded at:** `ds/model/server.py:29-30` (`MODEL_PATH`, seeded into the `model_data`
  volume by `ds/docker-entrypoint.sh`).
- **Served on:** `GET /titles`, `GET /title/skills`, `GET /title/trending-skills`.
- **Called from backend:** `backend/src/services/dsModel.ts:251,300,319`
  (skills + trending-skills), `backend/src/agents/titleClassification.agent.ts:21` and
  `backend/src/scripts/seed.ts:19` (`/titles`).
- **Serving env:** `SKILL_UBIQUITY_CAP=11 ROLE_COUNT_MIN_PREVALENCE=0.05` (without
  them, boilerplate skills like "english" top the lists on this dense corpus).

## Model 2 — CV text → Job Title (`text_to_job_title_classifier.joblib` + `train_cv_classifier.py`)

- **Purpose:** classify a full CV body into one of 59 canonical titles + `__other__`
  (rejection class). TF-IDF (1-2 gram) + MLPClassifier. This is the classifier rung of
  the title-detection ladder.
- **Trained by:** `train_cv_classifier.py` (in this folder — a script, not a notebook;
  recovered from commit `063d803`, the only place it was ever committed). Its docstring
  states it *replaces `tfid.ipynb`* — the older LogReg notebook did **not** produce the
  deployed artifact (see `ds/model/NOT_IN_FINAL.md`).
- **Loaded at:** `ds/model/server.py:42`.
- **Served on:** `GET /cv/role` (the rung the product calls) and legacy
  `POST /cv/title` (measurement/e2e callers only — the product never calls it).
- **Called from backend:** `backend/src/services/dsModel.ts:82` (`classifyRoles`),
  reached from `extractTitleFromCv` (`dsModel.ts:390`) when the header-normalizer rung
  doesn't resolve; also feeds the auto-match flow in
  `frontend/src/components/upload/CvUploadSection.tsx`.
- **Methodology & real metrics:** `ds/model/TITLE_DETECTION_METHODOLOGY.md` and
  `docs/final-sprint/outputs/official-metrics.md` (the only citable metrics source).

## Model 3 — Title-string Normalizer (`title_normalizer.joblib` + `title_normalizer_59.ipynb`)

- **Purpose:** map a SHORT title string (a CV header line or a user-typed search) onto
  the 59-title taxonomy via sentence-embedding (`all-MiniLM-L6-v2`) nearest-centroid.
  First rung of the title-detection ladder and the manual title search.
- **Trained by:** the original notebook (`NEW.ipynb`) was lost before being committed.
  `title_normalizer_59.ipynb` (M19/W2) is its **reconstruction and living spec**: the
  rebuild ties the live artifact exactly (82.2% taxonomy fidelity each, 8 fixes vs
  8 regressions), so the equivalence gate deliberately kept the live artifact — the
  `.joblib` here is that live artifact, and the notebook documents how it is built
  (its own output, `title_normalizer_rebuilt.joblib`, was intentionally not promoted).
- **Loaded at:** `ds/model/server.py:113-118` (`TITLE_NORMALIZER_PATH`).
- **Served on:** `GET /title/normalize`; also scores header-line candidates inside the
  CV-title flow.
- **Called from backend:** `backend/src/services/dsModel.ts:474` (`normalizeTitle`),
  used by `extractTitleFromCv` before falling back to the classifier.

## Model 4 — Skills → Title Router (`skills_to_24_plus_other.joblib` + `skills_to_24_plus_other.ipynb`)

- **Purpose:** the reverse direction — predict the title from the extracted **skill
  set** over 24 covered titles + `__other__` (rejection trained on 1,750 real non-tech
  CVs). Powers the **M19 agreement signal**: when this router and Model 2 agree, title
  confidence is boosted (≥87); on disagree/reject, confidence is capped (<55) so the
  LLM fallback rung fires.
- **Trained by:** `skills_to_24_plus_other.ipynb` (M19/W3, 2026-08-02). Held-out
  acc 0.828 / macro-F1 0.887.
- **Loaded at:** `ds/model/server.py:149-154` (`SKILLS_ROUTER_PATH`), active only when
  `AGREEMENT_SIGNAL_ENABLED=1`.
- **Served on:** attached to every candidate of `GET /cv/role`
  (`apply_agreement_signal_to_roles`); also on legacy `POST /cv/title`.
- **Called from backend:** the signal fields ride the `/cv/role` response and are read
  in `backend/src/services/dsModel.ts:89-91`, threaded through `extractTitleFromCv`
  into the fallback-logging and auto-match decisions.

## Helper modules (`*.py`)

The eight Python modules here are the complete local-import closure of the trainers
above, copied so the folder is a self-contained snapshot:

- `taxonomy.py` — the 59-title canonical taxonomy + label projections (used by all four)
- `train.py` — Model 1 training driven by `model1_retrain.ipynb`; imports
  `promotion_gate.py`, `skill_schema.py`, `stability.py`, `mongo_env.py`
- `promotion_gate.py` — the nightly no-regression gate on data volume
- `skill_schema.py` — unified skill-observation schema
- `stability.py` — trend/stability scoring for Model 1
- `extract_skills.py` + `skillner_utils.py` — SkillNer extraction (chunked fallback
  included) used by the skills→title router notebook
- `mongo_env.py` — Mongo connection resolution

Like the `.joblib` files, these are **copies**: the live modules the DS server and the
nightly pipeline import are the ones in `ds/model/` — change there first, then refresh
the copy here.

## What is deliberately NOT here

Research notebooks and superseded trainers live in
[`ds/model/archive/`](../model/archive/README.md); versioned artifact snapshots stay
in `ds/model/`. Both are mapped in [`ds/model/NOT_IN_FINAL.md`](../model/NOT_IN_FINAL.md).
