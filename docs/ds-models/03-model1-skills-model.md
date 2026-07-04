# SKILLS_MODEL — how the role→skills model learns, end to end

This documents exactly how the DS "skills model" is built and served, where its data
comes from, and what would change if we trained it on the large `lang-uk-job` dataset
(~142K rows). Written after wiring training to MongoDB + adding recency/trend features.

---

## TL;DR

- The model is **not a neural net**. "Learning" = **aggregating pre-extracted skills per
  role** into a `feature_matrix` (prevalence + specificity + recency/trend), plus a
  **char-ngram KNN** that maps a free-text title → one of ~59 canonical roles.
- **Skill extraction (SkillNer) happens once, at write time**, and the results are
  **stored inside each job document** (`skills.full_matches` / `skills.ngram_matches`).
  Training reads those stored skills — it does **not** re-run SkillNer.
- The live scraper collection (`jobs.jobs`) already has skills extracted. The big
  **`lang-uk-job` (142K) does NOT** — it's raw text. To use it we must run extraction
  **once** and **save** the output, then train on it.
- More data makes the **skill prevalence/trend** more accurate and covers more roles at
  high confidence. It does **not**, by itself, improve the **title→canonical matching**
  (that comes from a hardcoded variant list, not from the data).

---

## The data sources (as they exist today)

| Collection | Count | Has extracted skills? | What it is |
|---|---|---|---|
| `jobs.jobs` | ~2,305 | **Yes** (scraper runs SkillNer at scrape time) | Live LinkedIn scrape (Israel), last-24h campaigns |
| `jobs.JOBS_EXAMPLE` | 0 (synthetic, on demand) | Yes (generated in SkillNer shape) | Synthetic trend dataset from `generate_example_jobs.py` |
| `careerlens.lang-uk-job` | **141,897** | **No** (raw `Long Description` only) | djinni/dou UA tech jobs, 2020–2023; role in `Primary Keyword` |
| `careerlens.lang-uk-cv` | 210,250 | No (raw `CV` text) | djinni/dou UA candidate CVs |

`train.py` today reads **one** collection, selected by `MONGO_COLLECTION` (default `jobs`).
It expects each document to already contain `og_title` / `title` and a `skills` object with
`full_matches` / `ngram_matches`.

---

## The exact pipeline (5 stages)

```
 (A) COLLECT            (B) EXTRACT SKILLS         (C) TRAIN (aggregate)        (D) SERVE            (E) ANALYZE / personalize
 scraper or dataset  →  SkillNer per posting   →   train.py reads Mongo,    →   server.py loads  →   backend: detect title →
 writes job docs        writes skills.* INTO       aggregates per role,         model.joblib,        canonical → core+trending
 to Mongo               the job doc (once)         builds feature_matrix        exposes endpoints    +dynamic skills → LLM score
                                                   + KNN → model.joblib
```

### Stage A — Collection
- Scraper `scraping/external/linkedin.py`: `search_all_jobs()` fetches postings; each doc
  gets `title`, `og_title` (the search keyword), `description`, `datePosted`, `scraped_at`.
- A dataset like `lang-uk-job` is just imported rows: `Position`, `Primary Keyword`
  (role tag), `Long Description`, `Published` (date). **No skills, no `og_title`.**

### Stage B — Skill extraction (SkillNer) — happens ONCE, and is SAVED
- For the scraper this is `process_raw_jobs()` in `linkedin.py`: it runs
  `SkillExtractor(nlp, SKILL_DB, PhraseMatcher).annotate(description)` and writes the result
  **into the document**:
  ```python
  job["skills"] = { "full_matches": [...], "ngram_matches": [...] }
  jobs_collection.replace_one({"_id": id}, job, upsert=True)
  ```
- Shape of each match: `{ skill_id, doc_node_value (the skill text), score, doc_node_id }`.
  `full_matches` = exact hits (treated as score 1.0); `ngram_matches` = fuzzy hits with a
  `score` in [0,1].
- **Key point:** extraction is expensive (spaCy `en_core_web_lg` + SkillNer, ~tens–hundreds
  of ms per doc). It is deliberately done **once at ingest** and **persisted**, so training
  and re-training are cheap reads. Training never calls SkillNer.

### Stage C — Training = weighted aggregation + KNN  (`train.py`)
Reads `MONGO_COLLECTION` and, per document:
1. **Map to a canonical role** — `resolve_canonical(og_title, title)`: exact match to one of
   ~59 `CANONICAL_TITLES`, else a variant lookup. Unmapped rows are **dropped**.
2. **Guard** — skip docs with `< 5` total skill matches (noise).
3. **Weight each skill** — `extract_weighted_skills`: full matches add 1.0; ngram matches add
   their `score` if `≥ 0.75`.
4. **Recency weight** — `recency_weight(item) = 0.5 ** (age_days / HALF_LIFE_DAYS)` from
   `datePosted` (fallback `scraped_at`). Recent postings count more.
5. **Accumulate** per role: `Σ(score·w)` (weighted skill mass), `Σ w` (weighted denominator),
   raw counts, and a **recent-window** slice (`age ≤ TREND_WINDOW_DAYS`).

Then `compute_feature_matrix` produces, per role/skill:
```
prevalence        = Σ(score·w) / Σw            # recency-weighted mean, then normalized to [0,1] per role
title_specificity = idf / log(n_titles),  idf = log(n_titles / #roles_with_this_skill)   # how role-distinctive
recent_prevalence = mean score in the recent window (normalized on the same scale)
trend             = rising / stable / falling  (recent_prevalence vs overall prevalence, ×1.25 / ×0.80)
frequency         = raw #postings with the skill
```

Separately, a **title matcher** is trained — but **on titles, not on the jobs**:
```python
vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2,4))   # char n-grams of variant strings
X = vectorizer.fit_transform(variant_titles)                          # from hardcoded CANONICAL_TITLE_VARIANTS
knn = NearestNeighbors(metric='cosine').fit(X)
```
Everything is saved to `model.joblib` (`vectorizer`, `knn_model`, `feature_matrix`,
`titles`, `variant_titles`, `trained_at`) + `canonical_titles.json` (record counts /
confidence per role).

### Stage D — Serving (`server.py`)
Loads `model.joblib` **once at startup** (from `MODEL_PATH`). Endpoints:
- `GET /title/match` — free-text title → up to 3 canonical roles (KNN cosine → confidence).
- `GET /title/skills` — role → top-5 skills, ranked
  `score = 0.7·prevalence + 0.3·title_match·title_specificity`.
- `GET /title/trending-skills` — role → skills ranked by recency-weighted prevalence, each
  with its `trend` (the "API before analyze").
- `GET /text/skills` — runs SkillNer on **arbitrary text** (used for JD skill extraction).
- `GET /titles` — all canonical roles (source of truth for seeding the backend).
- `POST /cv/title` — extract a title from CV text, then KNN → canonical.

### Stage E — Analyze / personalization (backend)
1. `POST /api/cv/title` (regex) detects the CV's stated title → `POST /api/title/match`
   resolves it to a canonical role. **(automatic title detection)**
2. `POST /api/analyze`: `getCoreSkillsById` → `/title/skills` (5 core skills) +
   `getTrendingSkills` → `/title/trending-skills` + `extractDynamicSkills` (LLM) or
   `/text/skills` on the pasted JD.
3. `mergeTenSkills` → 5 core + 5 dynamic/trending (deduped).
4. LLM (`scoring.service`) scores the CV against those 10 skills → `matchScore`.

So the **DS model decides which skills define a role**; the **LLM decides how well a CV
matches those skills**. They are independent.

---

## Your questions, answered

### "Where is the data source taken from right now?"
`train.py` reads a **single Mongo collection** (`MONGO_COLLECTION`, default `jobs.jobs`,
~2,305 docs). The 142K `lang-uk-job` is a **separate, not-yet-wired** raw dataset in the
`careerlens` DB. Nothing trains on it today.

### "We pass it through skill extraction — do we save the results?"
- For **`jobs.jobs`**: yes — the scraper already extracts **and saves** `skills.*` into every
  document at scrape time. Training just reads them.
- For **`lang-uk-job` (142K)**: **not yet.** Those rows are raw text. To use them you must run
  SkillNer over `Long Description` **once** and **save** the output (do **not** re-extract on
  every training run — 142K × SkillNer is hours of spaCy work). Persist to a processed
  collection (e.g. `careerlens.lang-uk-job-skills`) using the same shape as `jobs.jobs`
  (`og_title`, `title`, `skills.full_matches/ngram_matches`, `datePosted`). Then point
  `MONGO_COLLECTION` at it.

### "Will the model return more accurate answers with 142K?"
**Yes for what the data actually drives — with real caveats.**

Improves:
- **Skill prevalence & specificity** per role become far more stable (142K vs 2.3K → less
  noise, better idf).
- **Role coverage & confidence** — many roles jump from `low`/`medium` to `high`.
- **Real historical trend** — `lang-uk-job` spans **2020–2023**, so the recency/trend feature
  can show a *genuine* multi-year skill trajectory (unlike today's 24h scrape window).

Does **not** improve (important):
- **Title → canonical matching.** The KNN is trained on the **hardcoded** variant list, not on
  job data. More jobs won't help it; adding variants / more canonical titles will.
- **CV title extraction** (regex + `cv_pipeline`) — independent of this dataset.
- **The LLM CV-vs-skill scoring** — independent of this dataset.

Caveats that bound the accuracy gain:
- **Taxonomy mismatch.** `Primary Keyword` uses djinni tags (`Python`, `.NET`, `Unity`,
  `Artist`, `Design`, `Support`…). These need a **mapping table** to our canonical roles;
  many map cleanly (`Java`→Java Developer, `Data Science`→Data Scientist, `DevOps`→DevOps
  Engineer), some don't map at all (`Artist`, `Sales`, `Marketing`) and should be dropped.
- **Market/geography.** It's the **Ukrainian** market, 2020–2023 — skill mix and titles differ
  from the Israeli market the product targets. Great for *methodology & trend*, weaker as a
  literal prior for IL roles. Consider training on `lang-uk-job` **plus** `jobs.jobs`, or
  weighting the local data higher.
- **Language.** Filter `Long Description_lang == 'en'` before SkillNer (it only handles English).
- **Extraction noise.** SkillNer surfaces generic tokens ("communication", "best practices");
  `train.py`'s `UNIVERSAL_NOISE` / `is_valid_skill` filters help but aren't perfect.

### "Does the model 'learn' in the ML sense?"
Only lightly. It's **statistics over extracted skills** (weighted means + idf) plus a
**string-similarity KNN** for titles. There is no gradient training on job outcomes, no
embeddings of descriptions. That's why it's cheap to retrain nightly — and why data volume
helps the *aggregates* but not the *matching logic*.

---

## Recommended plan to leverage the 142K

1. **Map roles**: build `PRIMARY_KEYWORD → canonical_title` (reuse/extend `resolve_canonical`);
   drop non-tech keywords.
2. **Batch-extract once**: stream `lang-uk-job` where `Long Description_lang == 'en'`, run
   SkillNer on `Long Description`, write `{ og_title: <mapped>, title: Position, skills, datePosted: Published }`
   to `careerlens.lang-uk-job-skills`. Checkpoint/resume; it's a long job.
3. **Train**: `MONGO_COLLECTION=lang-uk-job-skills RECENCY_HALF_LIFE_DAYS=180 TREND_WINDOW_DAYS=60 python train.py`
   (long half-life because the span is years, not hours).
4. **Validate**: eyeball top skills per role, and confirm the trend curve via `trend_report.py`
   (expect ML/AI rising across 2020→2023, C#/Java flat).
5. **Decide the prior**: train on UA data alone, or **merge with `jobs.jobs`** (local) — the
   local set is smaller but on-market. Weighting/blending is a tuning choice.

## Gotchas / limitations
- Extraction is the bottleneck, not training — **persist** results; never SkillNer 142K per run.
- Roles with `< ~5` mapped, skill-bearing docs stay low-confidence and can return `< 5` skills,
  which the analyze path treats as an error — seed/only expose roles that clear that bar.
- Title matching quality is capped by the hardcoded variant list, independent of dataset size.
