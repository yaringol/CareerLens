# CareerLens — Official Metrics

**The only numbers that may be cited** in the project book, flyer, poster or
presentation. Anything not in this document — or in the "must not be cited"
section below — does not go into a submission artefact.

**Companion document:** [`data-pipeline-metrics.md`](data-pipeline-metrics.md)
holds the data-pipeline funnel, the corpus-scale figures and the full metric
catalogue (formula + placement per metric), all recomputed from Mongo and the
live artifact on 2026-08-18. Numbers there are citable on the same terms as the
ones below.

**Status:** Parts A and C complete. Part B measured except human agreement,
which was deliberately not run — see §2.5. Updated 2026-08-03. · **Measured at
commit** `29d0376` + M19/W6 (uncommitted at time of writing) · Raw data:
[`metrics-raw/`](metrics-raw/) · Scripts: [`scripts/eval/`](../../../scripts/eval/)

---

## 0. The measurement environment (every number below depends on it)

The DS server's ranking behaviour is environment-driven and `docker-compose.yaml`
sets none of these variables. A number measured here is only comparable to a
demo box running the same configuration.

| Setting | Value used | Default if unset |
|---|---|---|
| `SKILL_UBIQUITY_CAP` | 11 | 48 |
| `ROLE_COUNT_MIN_PREVALENCE` | 0.05 | 0.0 |
| `AGREEMENT_SIGNAL_ENABLED` | 1 | 0 |
| Model 1 artefact | `model.joblib`, `trained_at=20260728_005411` | — |
| Backend | `TITLE_LLM_FALLBACK_THRESHOLD` unset → 55; `OPENAI_MODEL=gpt-4o-mini`, temperature 0.2 | — |
| Frontend | `AUTO_MATCH_CONFIDENCE_MIN` = 60 (hard-coded) | — |

The configuration was verified **behaviourally**, not assumed: the DS server
exposes no status endpoint, so `scripts/eval/00-env-snapshot.js` compares live
`/title/skills` output against what each candidate configuration produces
offline from `model.joblib`. Under the defaults, `Software Engineer`'s top-5
skills include `nice` and `git`; under the measured configuration they do not.

> **Open coordination item (inherited from M06):** the demo environment is
> operated by another team member. Unless these variables are set there, the
> demo will not reproduce the numbers in this document.

---

## 1. Part A — Model 2: CV → job title

### 1.1 Headline: the full pipeline on 32 authentic CVs

Every CV was pushed through the **real product path** — multipart PDF upload →
text extraction → the title ladder — not through the model in isolation.

| Metric | Result |
|---|---|
| **Top-1 accuracy** | **26/29 (89.7%)** |
| **Top-3 accuracy** | **27/29 (93.1%)** |
| Pipeline errors | 0 |
| Negative fixtures correctly blocked | 3/3 |

**Denominator:** 32 fixtures − 3 negative fixtures (2 Hebrew, 1 scanned image)
excluded from accuracy by the fixture manifest's own instruction and reported
separately as guard behaviour. For the two CVs whose ground truth is `none`
(unsupported occupations), "correct" means the system did **not** auto-accept a
role.

By scenario:

| Scenario | n | Top-1 |
|---|---|---|
| clear-cut | 9 | 8 (88.9%) |
| ambiguous | 4 | 4 (100%) |
| career-changer | 3 | 3 (100%) |
| hybrid | 3 | 3 (100%) |
| niche-core | 5 | 5 (100%) |
| junior | 3 | 2 (66.7%) |
| unsupported (`none`) | 2 | 1 (50%) |

### 1.2 Why this is not the 62.3% in the older documents

The two numbers measure different things, and the gap is the architecture.

| Rung | n | Top-1 | Confidence scale |
|---|---|---|---|
| `title_extraction` (LLM reads the declared title → normalizer) | 26 | 92.3% | cosine similarity × 100 |
| `cv_classifier` (TF-IDF+MLP over the CV body) | 3 | 66.7% | renormalised softmax share |

**26 of 29 CVs never reach the classifier.** The published 62.3% / 0.732 macro-F1
describes a component the product barely depends on. Measured on this corpus the
classifier path alone scores **55.2%** (see 1.4) — consistent with the 55.9%
reported for real (lang-uk) CVs, and nowhere near 0.93.

### 1.3 Confidence calibration — and why one threshold cannot serve both rungs

The two rungs emit numbers on incompatible scales into the same 0-100 field.
Calibrated separately (n=29, full pipeline):

**`title_extraction` (cosine × 100):** raising auto-accept from 60 to 80 costs
**zero** correct detections and removes the one wrong auto-accept. Above 80 the
cost turns steep — at 90, twelve correct detections are demoted to the manual
picker.

**`cv_classifier` (softmax share):** measured on all 29 CVs via direct
`/cv/role` calls, **no threshold separates right from wrong.** Confidences
attached to *incorrect* predictions: 37.1, 54.3, 66.1, 75.8, 84.1, 92.9, 95.6,
96.2, 96.3, 98.2, 98.7, 99.98, 99.99. Even a 95 cut-off keeps 21 predictions of
which 7 are wrong.

| Auto-accept | Auto-accepted | Wrong among them | Correct demoted to manual |
|---|---|---|---|
| 60 (deployed) | 27/29 | 2 | 0 |
| **80 (recommended)** | 26/29 | 1 | 0 |
| 90 | 14/29 | 1 | 12 |
| 95 | 8/29 | 0 | 17 |

**Recommendation (not applied — M05 changes no thresholds):** raise the
frontend auto-accept bar from 60 to **80**. On this corpus it is free. The
training script's companion suggestion of a 95 LLM-fallback cut-off is **not**
supported: on the classifier path the confidence signal is too weakly correlated
with correctness for any cut-off to help.

### 1.4 The M19 agreement signal, measured

The signal only runs on the classifier rung, so it was measured there directly
(29 CVs, DS `/cv/role`, agreement ON vs OFF), with the backend's own decision
rules replayed offline.

| | OFF | ON |
|---|---|---|
| Accuracy | 16/29 (55.2%) | **17/29 (58.6%)** |
| Auto-accepted | 27/29 | 27/29 |
| LLM fallback fires | 2/29 | 2/29 |
| CVs helped / harmed | — | **1 / 0** |

Reach: 5 `agree`, 2 `disagree`, 22 skipped as provably no-op.

The single win is the case the signal exists for: a technical-writer CV
(ground truth `none`) was auto-accepted as *Product Manager* at 75.8 with the
signal off, and correctly capped to 50 and routed to the manual picker with it
on.

**Disclosed counter-effect, not captured by the accuracy metric:** on two CVs
the `agree` branch lifted confidence from 37.1 and 54.3 to 87 — converting
"below threshold, escalate to the closed-list LLM" into "auto-accepted" while
the underlying classifier answer was wrong in both cases. Whether the LLM rung
would have corrected them is **unmeasured**. The headline "1 helped, 0 harmed"
should be read with that caveat.

### 1.5 Training-data coverage over the 59 canonical titles

Recomputed from source (`scripts/eval/07_coverage_table.py`) by replaying the
repo's own mapping functions over both real corpora, because three conflicting
counts circulate in the repo (33, 32, 35).

| | |
|---|---|
| **Canonical titles with zero real CV training data** | **33 of 59 (56%)** |
| Titles with 1-49 real CVs | 0 |
| Titles clearing the 50-CV floor | 26 |

The distribution is binary: a title either has ≥100 real CVs or exactly none.
The 33 uncovered titles are the entire security-research, hardware/VLSI and
specialised-research space (FPGA Engineer, Malware Researcher, SOC Analyst,
Firmware Engineer, Reverse Engineer, Cryptographer, …).

**The measured consequence, and the mitigation:** on the classifier path these
roles fail exactly as the coverage gap predicts — the FPGA and malware-research
CVs are both classified `C++ Developer`. Through the full product ladder the
same CVs score **5/5**, because the declared-title rung normalises against all
59 titles regardless of classifier training data. The coverage gap is real; the
architecture, not the model, is what covers it.

### 1.6 Determinism

Same CV × 5 runs: the sklearn layer (`/cv/role`) and the full ladder
(`/api/cv/title`) both returned identical titles and confidences on every run.
No thread pinning was required. (Stability was established on two CVs, not
proven in general; the scoring agent's non-determinism is measured separately in
Part B.)

---

## 2. Part B — Scoring agent (Match Score)

**Partially complete.** The agreement-with-humans metrics (MAE, Spearman ρ, ±2)
await the blind annotation session. Everything below needs no labels and is
final.

### 2.1 The evaluation set

24 CV × JD pairs: 8 authentic CVs × 3 bands. Job descriptions are **real
postings** drawn from `careerlens.lang-uk-job-skills` (41,745 Djinni postings),
17 distinct postings, **all 17 reviewed and approved by the annotator on
2026-08-03** before use.

> **Disclosed for the reader's judgement:** three approved postings carry a
> headline title that differs from their corpus label — two labelled *Data
> Scientist* are titled "Data Engineer", and one labelled *QA Automation* is
> titled "QA Engineer (Manual)". The labels were reviewed and kept. Where a
> "matched" pair is in truth an adjacent one, some of the band overlap reported
> in §2.2 follows from the label rather than from the agent, so §2.2 should be
> read as an upper bound on the confusion attributable to the model. Bands are deliberate:
**matched** (CV and posting share the canonical title), **adjacent**
(neighbouring family, e.g. Backend × Data Engineer) and **mismatched**
(unrelated, e.g. Frontend × Cyber Security). Without that spread, every score
lands in the same narrow range and a rank correlation measures nothing.

### 2.2 Band separation — the agent barely distinguishes fit

This needs no annotator: within a single CV, a matched posting should outscore a
mismatched one. Only the **order** has to be right, so the result is immune to
disagreement about the correct value.

| Band | Mean match score |
|---|---|
| matched | **4.50 / 10** |
| adjacent | **4.50 / 10** |
| mismatched | **3.84 / 10** |

| Check | Result |
|---|---|
| Within-CV order correct (matched > mismatched) | **6 / 8** |
| Ties | 1 |
| **Inversions** | **1** |
| Mean margin (matched − mismatched) | **0.66 points** |

The separation is weak and, in places, absent:

* **`adjacent` is indistinguishable from `matched`** (4.50 vs 4.50). The single
  highest score in the whole set — **7.0/10** — went to a Data Engineer CV
  against a *Data Scientist* posting, above every correctly matched pair.
* One full inversion: the Software Engineer CV scored **2.3** against its
  matching posting and **2.9** against a UX Designer posting.
* One complete tie: the QA Automation CV scored **3.8** against all three
  postings, matched and mismatched alike.

**Reading:** on this set the Match Score behaves more like a CV-quality score
than a CV-to-job fit score. A 0.66-point mean margin on a 10-point scale is not
a basis for telling a user they are a good or poor fit for a specific role.

### 2.3 Stability (test-retest)

Same pair, same fixed skill list, re-scored through `/analyze/rescore` (which
performs no skill re-selection, isolating scoring variance):

| Metric | Value |
|---|---|
| Mean σ across repeats | **0.11 points** |
| Max σ | 0.36 |
| Mean spread (max − min) | 0.22 |
| Max spread | 0.80 |

This answers "the LLM is non-deterministic, how can you trust it?" concretely:
at temperature 0.2 the score moves by roughly a tenth of a point between runs —
an order of magnitude smaller than the 0.66-point band margin above, but also
small enough that it cannot explain the weak separation.

### 2.4 Keyword baseline

The same 240 skill ratings, scored by the token-overlap rule the backend keeps
as a fallback (`overlapScoreForSkill`):

| | LLM agent | Keyword baseline |
|---|---|---|
| Mean skill score | **4.28** | 5.73 |
| Zero scores | 92 / 240 | 88 / 240 |

The two agree within 2 points on **119 of 240 ratings (49.6%)**.

The two methods disagree by more than 2 points on **half** the ratings, so the
LLM is clearly doing something other than keyword counting. Which of the two is
*closer to human judgement* is exactly what the annotation session decides — it
is the one comparison that justifies (or does not justify) the agent
architecture, and it is not yet answered.

### 2.5 What the scoring prompt actually scores — and what was not measured

`scoreSkills(cvText, skills)` receives **only the CV text and the skill list**
(`scoring.agent.ts:38-51`). A repo-wide check confirms it: `jobDescription`
appears nowhere in `scoring.service.ts`, whose single call is
`scoreSkills(cvText, validatedSkills)` at line 182.

So the Match Score is **not a CV-to-posting fit score**. It is "how well does
this CV evidence these ten skills", where the posting decided *which* ten skills
were selected upstream but plays no part in the scoring itself. The weak band
separation in §2.2 is therefore structural rather than a prompt-wording defect:
the scorer never sees the posting it is implicitly being judged against.

The prompt itself is disciplined and its rules are visible in the output:
evidence-only scoring with no inference from job titles, an explicit anti-grade-
inflation instruction, independent per-skill judgement, and a defined 0-10 band
scale. Its behaviour matches those rules — it assigns 4/10 to skills that appear
as bare keywords where the keyword baseline assigns 10/10.

**Not measured (decision, 2026-08-03):** agreement with human judgement. The
blind sheet exists (`12-labeling-sheet.html`, 29 items, 290 ratings, verified
free of model output) and the session was deliberately not run. The consequence
is stated plainly rather than papered over: **MAE, Spearman ρ and ±2 agreement
against a human reference are not available, and neither is the answer to
whether the LLM agent beats the keyword baseline.** Everything in §2.2-2.4 is
measured; nothing here claims the scores are *correct*, only that they are
stable, weakly job-discriminative, and materially different from keyword
counting.

## 3. Part C — Model 1 (skill ranking) — **complete**

### 3.1 Result

Model 1 had **no quality metric of any kind** before this measurement: `train.py`
imports nothing from `sklearn.metrics`, performs no split, and the promotion gate
admits a model on row counts alone. This is its first.

| | precision@10 |
|---|---|
| **Live model** (`trained_at=20260728_005411`) | **97%** |
| Pre-M06 backup (`model.joblib.bak-20260728`) | 96% |
| Change | +0.8 pp |

12 roles × top-10, **191 skills marked, 100% coverage**, blind: the two models'
lists were merged, deduplicated and shuffled, so the annotator could not tell
which model proposed a skill — or that two models existed.

Per role: 3 improved (Data Engineer, Frontend Developer, Java Developer, +10pp
each), 2 regressed (Cyber Security, Software Engineer, −10pp each), 7 unchanged.

### 3.2 The aggregate hides the finding — the *kind* of error changed

Only 8 of 191 skills were rejected, and they split cleanly by model:

| Rejected skill | Role | Proposed by |
|---|---|---|
| `backend` | **Frontend Developer** | pre-M06 only |
| `backend` | Data Engineer | pre-M06 only |
| `python` | Java Developer | pre-M06 only |
| `cybersecurity` | Product Manager | pre-M06 only |
| `computer science` | Cyber Security | live only |
| `tracking` | Product Manager | live only |
| `writing` | Software Engineer | live only |
| `python` | C++ Developer | both |

The pre-M06 model's failures are **cross-role contamination** — a Frontend
Developer whose list contains `backend`, a Java role containing `python`. That
is precisely bug B6 from the readiness audit ("the #1 skill for Frontend
Developer is `backend`"), and it is **measurably absent from the live model**.

The live model's failures are of a different kind: `computer science`,
`tracking`, `writing` — vague or boilerplate, but not from the wrong role
family. Trading wrong-family errors for vague-but-adjacent ones is an
improvement in kind that a single averaged percentage cannot express.

### 3.3 Honest limitation of this metric

precision@10 measures **relevance**, and the M06 change targeted
**informativeness** (a ubiquity filter that removes skills appearing in nearly
every role). The annotation protocol explicitly instructed that a generic but
genuine skill — `software development`, `git` — counts as relevant. Under that
rule the ubiquity filter can only ever *lose* precision points by removing
relevant-but-uninformative skills, never gain them.

So the flat +0.8 pp is **not** evidence that M06 failed; the instrument is
structurally insensitive to what M06 changed. What the data does support is
narrower and still worth stating: the live model's top-10 lists are 97% relevant,
and the specific cross-role contamination that motivated M06 no longer appears.
Measuring informativeness directly would need a different instrument (e.g.
asking which list is more *useful* to a candidate, head to head).

### 3.4 Method

Both artefacts were read offline with `joblib`; `MODEL_PATH` was never repointed
and the running server was never touched, so there was no risk of leaving a demo
box serving the backup model. Serving configuration as in §0
(`SKILL_UBIQUITY_CAP=11`, `ROLE_COUNT_MIN_PREVALENCE=0.05`); the backup was read
the way it was actually served at the time — prevalence-only, no filter.

Scope: the **12** canonical titles that carry real data. The remaining 47 have
zero records in the current artefact and are a coverage limitation, not a
measurement gap.

<details>
<summary>Superseded plan (kept for provenance)</summary>

Scope: the **12** canonical titles that carry real data — not the 15 the brief
assumed. The remaining 47 have zero records in the current artefact and are
reported as a coverage limitation rather than measured on empty input.

Design: the live model (`model.joblib`, `trained_at=20260728_005411`) and the
pre-M06 backup (`model.joblib.bak-20260728`) each contribute their top-10 per
role; the two lists are merged, deduplicated and shuffled into a single
unlabelled list, so the rater cannot tell which model proposed a skill — or that
two models exist. **191 skills** to mark across the 12 roles; the two models
share only 49 skills in total, so the comparison has real room to separate them.

Both artefacts are read offline with `joblib`. `MODEL_PATH` is never repointed
and the running server is never touched, which removes the risk (R7) of leaving
the demo box pointing at the backup model.

precision@10 is then computed per model, per title and on average — a measured
before/after for the M06 change.

> **Correction to the milestone brief:** the brief asks to compare precision@10
> "before and after the `title_specificity` fix". That fix was never applied —
> `title_specificity` is still computed, stored and never read at serving time
> (`train.py:437-447` writes it; `skill_schema.py:236-244` ranks by prevalence
> then stability). What M06 actually shipped is a **ubiquity filter** plus a
> prevalence floor, so that is what this comparison measures.

</details>

---

## 4. Numbers that must NOT be cited

| Number | Where it appears | Why it is disqualified |
|---|---|---|
| **0.93 / 0.931 macro-F1** | `CV_TITLE_CLASSIFIER.md:50-54`, `docs/ds-models/01-*`, and ~10 more | Measured on synthetic structured data, on a **38-class model that is no longer deployed** |
| **0.981 → 0.932** (leakage ablation) | same files | Same obsolete model; also a within-corpus number |
| **15/15 passed** | `poc_files/RESULTS.md:3` | Circular: team-written CVs, team-defined score bands, and `MAX_ITERATIONS = 3` — "pass" means one of three attempts landed in range. The two band definitions in that suite also contradict each other (`test_poc.js:38` vs `cv_content.js:7`) |
| **62.3% / 0.732** | `TITLE_DETECTION_METHODOLOGY.md` §5.1 | Not wrong, but it measures the classifier **component**, not the product. Cite only alongside §1.2 above, never as "the system's accuracy" |

---

## 5. Limitations (must appear in the book)

1. **Single annotator.** The model-1 relevance ground truth was labelled by one
   team member; inter-annotator agreement cannot be computed. Mitigated by blind
   labelling — the two models' skill lists were merged and shuffled, so the
   annotator could not favour either.
1a. **No human reference for the scoring agent.** Its agreement with human
   judgement was not measured (§2.5), so no claim is made that its scores are
   correct — only that they are stable and distinct from keyword counting.
2. **33 of 59 supported titles have no real CV training data**, so classifier
   performance on them is unmeasurable and, where measured indirectly, poor.
3. **Small evaluation set.** 29 scored CVs. Per-scenario cells hold 2-9 CVs;
   those percentages are indicative, not precise.
4. **Fixtures are authored, not harvested.** The CVs are realistic and
   independently reviewed, but they are not a random sample of real applicants.
5. **The scoring agent is not deterministic** (temperature 0.2, no seed, no
   caching); its variance is reported in Part B rather than hidden.
6. **The job-posting corpus is Ukrainian (Djinni), 2019-2023**, with
   heuristically assigned canonical labels — not the Israeli market, and not
   current. Sampled postings are hand-checked before use.
7. **Environment-dependence.** See §0: with the DS defaults instead of the
   measured configuration, model-1 output changes materially.
