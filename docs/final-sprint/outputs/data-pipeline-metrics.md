# CareerLens — Data-Pipeline Metrics & the Metric Catalogue

Companion to [`official-metrics.md`](official-metrics.md). That document answers
*"how good is each model?"*. This one answers the question a reader of the book
asks first and that no accuracy figure addresses: **how does raw market data
become a skill list the product hands a user, and how much survives each step?**

**Measured 2026-08-18** against the local `careerlens` Mongo and the live
artifact `model.joblib` (`trained_at=20260728_005411`).
Reproduce with `scripts/eval/17_data_funnel.py`, `18_informativeness.py`,
`19_extraction_profile.py`, `20_model1_depth.py`, `21_product_path.py` and
`22_synthetic_ablation.py`; raw output in [`metrics-raw/`](metrics-raw/) files
`17-` through `22-`.

Every number below is recomputed from source. Where a milestone report quotes a
slightly different figure, the recomputed value wins and the difference is noted.

---

## 1. Five headline numbers

| # | Metric | Value |
|---|---|---|
| 1 | **Skill-extraction coverage** | **97.7%** of usable postings (40,778 / 41,745) yielded at least one recognised skill |
| 2 | **Skill density** | median **18** normalised skills per posting (p25 12 · p75 26 · mean 19.9 · max 105) |
| 3 | **Market coverage** | **12 of 59** canonical roles (20.3%) carry enough market data for skill ranking — all 12 clear the 50-record promotion floor |
| 4 | **Data scale** | **41,745** real job postings → **831,143** role–skill observations across **21,678** distinct skills |
| 5 | **Corpus retention** | **51,349 of 52,545** candidate records (97.7%) survived the training filters; **2 of 2** recorded training runs passed the promotion gate |

> **Honesty note on #5.** The brief for this metric was *"X of Y **nightly**
> retraining runs were promoted"*. That number does not exist **here** and must
> not be invented. The nightly schedule runs on the **deployment host**, which is
> operated by another team member and was not reachable from this measurement
> environment; the `model_runs` collection read for this document is the local
> one, and it holds **2** documents, both from manually launched runs on
> 2026-07-28. Locally the ofelia cron never fired successfully (readiness audit
> §3.5 — `secrets/mongo.env` was missing, so the job failed before reaching
> `train.py`). The promotion *gate* is implemented and exercised; the promote/block
> **rate of the scheduled runs is unmeasured**, not absent. #5 above is the honest
> substitute — and it is a statement about this environment, not about the
> deployment host.

> **Honesty note on #4.** The trained corpus is 51,349 records, of which
> **10,800 (20.6%) are the marked synthetic 2023H2→2026H1 continuation**
> (`source='augmented-2026'`, see the M06 report). Headline #4 deliberately
> reports the **real** postings only. Including synthetic records the totals are
> 961,966 role–skill observations across 21,722 distinct skills.

---

## 2. The data funnel

Each row is one stage; **retained** is against the previous stage, **of source**
against the 141,897 raw dataset rows.

| # | Stage | Count | Retained | Of source | What removes the rest |
|---|---|---:|---:|---:|---|
| 0 | Djinni / lang-uk job postings (raw dump) | 141,897 | — | 100% | — |
| 1 | Postings the taxonomy can label | 106,977 | **75.4%** | 75.4% | 34,918 out-of-taxonomy tags (Marketing, HR, Sales, Recruiter, Legal…); 2 descriptions under 100 chars |
| 2 | Balanced training sample (cap 4,000/role, seed 42) | 41,745 | **39.0%** | 29.4% | **Deliberate down-sampling**, not data loss — the cap stops Backend (22,308) and Frontend (17,903) from swamping Cyber Security (830) |
| 3 | Postings SkillNer extracted ≥1 skill from | 40,778 | **97.7%** | 28.7% | 967 postings produced no recognised skill (962 with zero raw matches at all) |
| 4 | Role-resolved postings | 40,778 | **100%** | 28.7% | Nothing — the canonical role is assigned at stage 1, so resolution is complete by construction |
| 5 | Plus marked synthetic 2023H2→2026H1 records | 52,545 | +10,800 | — | Real corpus ends 2023-09; the continuation is generated, marked and disclosed |
| 6 | Records `train.py` kept | 51,349 | **97.7%** | — | 1,195 postings carried fewer than 5 raw SkillNer matches; 1 further record failed skill normalisation |
| 7 | Role–skill observations produced | 961,966 | ×18.7 per record | — | — |
| 8 | (role, skill) feature rows in the artifact | 66,257 | — | — | Deduplication of 961,966 observations onto 21,722 distinct skills × 12 roles |
| 9 | Roles with sufficient data | 12 of 59 | **20.3%** | — | 47 canonical roles (all cyber-research, hardware/VLSI, specialised-research) have zero postings in the Djinni taxonomy |
| 10 | Model promoted | 2 of 2 runs | **100%** | — | Gate: ≥200 records, ≥8 roles with data, ≥3 roles ≥50 records, no >20% total drop, no drop in non-low roles |

**End to end: 28.7% of the raw market dump reaches the model, and 20.3% of the
product's supported roles are backed by it.**

**Loss attribution — the finding, not just the number.** Of the **101,119**
source postings that do not reach the model:

| Cause | Postings | Share of all loss |
|---|---:|---:|
| Taxonomy mismatch (Djinni tag has no canonical title) | 34,918 | **34.5%** |
| Deliberate role balancing (4,000/role cap) — a design choice, not loss | 65,232 | **64.5%** |
| Extraction failure (SkillNer found nothing) | 967 | **1.0%** |
| Description under 100 characters | 2 | 0.002% |

A further 1,196 records (2.3%) are dropped later by `train.py`'s own filters,
measured against a different base (52,545 candidates, synthetic included), so
they are reported separately rather than folded into the table above.

> **The dominant source of data loss is taxonomy coverage, not extraction
> quality.** SkillNer costs the corpus 2.3%; the mismatch between a Ukrainian
> mainstream-IT job board and a security/hardware-heavy canonical taxonomy costs
> it 24.6 pp of the source and 47 of the 59 supported roles.

### 2.1 Usable extraction, not just non-empty extraction

"At least one skill" is a low bar. The curve below is what the corpus actually
supports, and it is the sharper statement for the book
([`19-extraction-profile.json`](metrics-raw/19-extraction-profile.json)):

| Postings yielding… | Count | Share |
|---|---:|---:|
| ≥ 1 skill | 40,778 | **97.7%** |
| ≥ 5 skills | 39,950 | **95.7%** |
| ≥ 10 skills | 35,637 | **85.4%** |
| ≥ 15 skills | 28,025 | **67.1%** |
| ≥ 20 skills | 19,206 | 46.0% |
| ≥ 25 skills | 11,906 | 28.5% |

> **97.7% yielded ≥1 skill, 95.7% ≥5, 85.4% ≥10, 67.1% ≥15.**

The gap between ≥1 and ≥5 is only 2 pp, which says the failure mode is binary:
a posting either parses richly or not at all. There is almost no band of
"technically extracted but useless" postings — the 2.3% that fail, fail
completely (962 of the 967 empty postings produced *zero* raw matches).

### 2.2 Extraction density by role — is SkillNer biased toward technical roles?

Yes, but mildly, and not where it was expected:

| Role | n | median | p25 | p75 | extraction failure | ≥5 | ≥10 | ≥15 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Cyber Security | 830 | **23** | 16 | 32 | 3.49% | 95.7% | 89.8% | 79.2% |
| DevOps Engineer | 4,000 | **23** | 16 | 32 | 1.73% | 97.5% | 92.3% | 80.4% |
| Data Scientist | 2,262 | 21 | 14 | 28 | 2.70% | 95.8% | 88.4% | 73.7% |
| Data Engineer | 2,910 | 20 | 14 | 28 | 2.16% | 96.7% | 87.7% | 72.3% |
| Java Developer | 4,000 | 20 | 14 | 28 | 2.23% | 96.5% | 88.8% | 74.2% |
| QA Automation Engineer | 4,000 | 20 | 14 | 27 | 2.12% | 96.2% | 88.2% | 72.0% |
| Backend Developer | 4,000 | 18 | 12 | 24 | 2.05% | 95.8% | 84.1% | 64.0% |
| C++ Developer | 3,743 | 18 | 12 | 24 | 1.66% | 96.6% | 85.8% | 65.1% |
| Frontend Developer | 4,000 | 17 | 12 | 24 | 2.57% | 95.0% | 83.2% | 61.6% |
| Product Manager | 4,000 | 17 | 12 | 24 | 2.77% | 95.8% | 84.9% | 64.3% |
| Software Engineer | 4,000 | 17 | 11 | 23 | 2.33% | 94.9% | 81.4% | 60.2% |
| UX Designer | 4,000 | **15** | 10 | 21 | 3.00% | 92.2% | 75.4% | 52.3% |

**The spread is 15 → 23, a factor of 1.53** — real, but far from the collapse
the hypothesis assumed. Product Manager sits at 17, mid-pack, not at 9.
The two extremes are the informative ones: **UX Designer** is lowest on every
column (median 15, 3.00% failure, only 52.3% reach 15 skills) because design
vocabulary is thinly covered by SkillNer's software-engineering skill database;
**DevOps** is highest because its postings are dense lists of named tools.
No role's failure rate exceeds 3.5%, so the bias shows up as *thinner* skill
lists for non-engineering roles, never as missing coverage.

### 2.3 Real vs synthetic contribution, per role

20.6% overall hides a 2.8× spread. This is the table to put in the book:

| Role | Real records | Synthetic | Synthetic % | Real obs. | Synthetic obs. | Total obs. |
|---|---:|---:|---:|---:|---:|---:|
| **Cyber Security** | **830** | **900** | **52.0%** | 20,160 | 10,854 | 31,014 |
| Data Scientist | 2,262 | 900 | 28.5% | 50,174 | 11,889 | 62,063 |
| Data Engineer | 2,910 | 900 | 23.6% | 63,087 | 10,835 | 73,922 |
| C++ Developer | 3,743 | 900 | 19.4% | 70,807 | 10,396 | 81,203 |
| Backend Developer | 4,000 | 900 | 18.4% | 75,692 | 11,138 | 86,830 |
| DevOps Engineer | 4,000 | 900 | 18.4% | 98,146 | 11,055 | 109,201 |
| Frontend Developer | 4,000 | 900 | 18.4% | 72,673 | 10,846 | 83,519 |
| Java Developer | 4,000 | 900 | 18.4% | 88,212 | 11,013 | 99,225 |
| Product Manager | 4,000 | 900 | 18.4% | 73,382 | 10,727 | 84,109 |
| QA Automation Engineer | 4,000 | 900 | 18.4% | 84,060 | 10,837 | 94,897 |
| Software Engineer | 4,000 | 900 | 18.4% | 71,197 | 11,103 | 82,300 |
| UX Designer | 4,000 | 900 | 18.4% | 63,553 | 10,701 | 74,254 |
| **Total** | **41,745** | **10,800** | **20.6%** | **831,143** | **131,394** | **962,537** |

The generator emits a flat 900 records per role regardless of how much real data
the role has, so **the roles with the least real evidence receive the largest
synthetic share.** Cyber Security's skill ranking rests on more synthetic
records than real ones. Every Cyber Security claim must say so.

### 2.4 Did the sampling cap actually balance the corpus?

| | min | median | max | max/min | CV | Gini |
|---|---:|---:|---:|---:|---:|---:|
| Before cap (mappable postings) | 830 | 3,326 | 22,308 | **26.9×** | 0.994 | **0.410** |
| After cap (4,000/role, seed 42) | 830 | 4,000 | 4,000 | **4.8×** | 0.290 | **0.119** |

The cap cut the imbalance ratio from 26.9× to 4.8× and the Gini from 0.410 to
0.119. It is the reason the corpus is not simply "Backend + Frontend with
rounding error" — and the residual 4.8× is Cyber Security, which had only 830
postings to begin with, so no sampling policy could have fixed it.

### 2.5 Two distribution facts worth a chart of their own

* **Skill specialisation.** Of the 21,722 skills in the artifact, **10,324
  (47.5%) appear in exactly one role** and **754 (3.5%) appear in all twelve**.
  The long tail is what makes role-specific ranking possible; the 754 ubiquitous
  skills are exactly what the `SKILL_UBIQUITY_CAP` filter exists to suppress.
* **Synthetic share is not uniform.** Overall 20.6%, but per role it ranges from
  18.4% (the eight roles capped at 4,000 real postings) to **52.0% for Cyber
  Security**, whose 830 real postings are outnumbered by its 900 synthetic ones.
  Any claim about Cyber Security skill trends must carry that caveat.

*(The per-role observation counts above are taken before `train.py`'s own
filters; the funnel's 961,966 is the post-filter figure. The 571-observation
difference is the 1,196 dropped records.)*

---

## 3. Model 1 in depth — what the user actually sees

Source: [`20-model1-depth.json`](metrics-raw/20-model1-depth.json), produced by
`scripts/eval/20_model1_depth.py`. No new annotation was needed for any of it.

### 3.1 Generic contamination per role, before and after M06

`generic@k` = share of the served list whose skills clear the ubiquity bar
(present with prevalence ≥ 0.05 in **≥ 6 of the 12 roles**). `informative@k` is
its complement — the two are the same measurement, and **"generic-skill
contamination fell from 74.2% to 44.2%" is the phrasing to use in the book**,
because a reader understands contamination going down without a definition.

| Role | generic@10 pre-M06 | generic@10 live | Δ | generic@5 pre-M06 | generic@5 live | Δ |
|---|---:|---:|---:|---:|---:|---:|
| Frontend Developer | 100% | 20% | **−80** | 100% | 0% | **−100** |
| Data Engineer | 80% | 30% | −50 | 80% | 20% | −60 |
| C++ Developer | 100% | 60% | −40 | 100% | 80% | −20 |
| Cyber Security | 80% | 40% | −40 | 80% | 40% | −40 |
| Java Developer | 100% | 60% | −40 | 100% | 40% | −60 |
| Product Manager | 70% | 30% | −40 | 60% | 60% | 0 |
| Backend Developer | 100% | 70% | −30 | 100% | 80% | −20 |
| Software Engineer | 100% | 70% | −30 | 100% | 100% | 0 |
| UX Designer | 30% | 0% | −30 | 20% | 0% | −20 |
| DevOps Engineer | 70% | 60% | −10 | 80% | 40% | −40 |
| Data Scientist | 40% | 40% | 0 | 20% | 20% | 0 |
| **QA Automation Engineer** | **20%** | **50%** | **+30** | 20% | 40% | +20 |
| **Overall** | **74.2%** | **44.2%** | **−30.0** | **71.7%** | **43.3%** | **−28.3** |

**The improvement is broad, not carried by two roles: 10 of 12 improved, 1 was
unchanged, 1 regressed.** The single regression is QA Automation Engineer
(20% → 50% contamination), which was already the cleanest list before M06 — the
prevalence floor promoted `sql`, `api` and similar cross-role terms into its
top-10. That is the honest counter-example to keep in the results chapter.

### 3.2 Top-5 is what the user sees — and it is where precision goes blind

The product displays **5** core skills; top-10 is only the candidate pool. Both
metrics recomputed on the displayed five, reusing the existing blind labels:

| | live | pre-M06 | separates the models? |
|---|---:|---:|---|
| relevance@10 (blind labels) | 96.7% | 95.8% | barely — 1 skill |
| **relevance@5** (displayed) | **96.7%** | **96.7%** | **no — identical** |
| informative@10 | 55.8% | 25.8% | yes, +30.0 pp |
| **informative@5** (displayed) | **56.7%** | **28.3%** | **yes, +28.4 pp** |

This is the cleanest statement of `official-metrics.md` §3.3's warning: **on the
five skills a user actually reads, relevance cannot tell the two models apart at
all (96.7% vs 96.7%), while contamination separates them by 28 pp.** Relevance
was the wrong instrument; it was not merely insensitive, at k=5 it is flat.

### 3.3 Environment sensitivity, stated operationally

`official-metrics.md` §0 warns that the DS defaults change model-1 output. The
size of that change on the displayed list:

| | |
|---|---|
| **Roles whose top-5 changes under the default env** | **8 of 12** |
| Mean Jaccard between the two configurations | 0.758 |
| Mean skills replaced per role | 0.83 of 5 |
| informative@10 | 55.8% → 44.2% |

> **8 of 12 roles return a different top-5 under the default configuration.**
> That converts "an environment variable is unset" from a footnote into a
> user-visible difference on two thirds of the supported roles.

### 3.4 Stable / Balanced / Trending are very nearly the same list

The Personalization presets map to a single `stabilityPreference`
(stable = 0.2, balanced = 0.5, trending = 0.8), and `selectPersonalizedSkills`
picks the five candidates whose `stability_score` is closest to it. Replaying
that against the live artifact:

| Comparison | Mean Jaccard of the two top-5 lists |
|---|---:|
| **Stable vs Balanced** | **1.000 — identical in all 12 roles** |
| Stable vs Trending | 0.945 |
| Balanced vs Trending | 0.945 |
| Roles where Stable and Trending return the same five skills | **10 of 12** |

**The mechanism, not an accident.** In the served candidate pools **118 of 120
skills have `stability_score` ≥ 0.95** (median 0.994, min 0.039, max 1.000).
When every candidate sits above every preference value, `|stability − 0.2|`,
`|stability − 0.5|` and `|stability − 0.8|` all rank the candidates in the same
order, so the preset cannot change the selection. The only two roles where
Stable and Trending differ — DevOps Engineer and Java Developer — are exactly
the two whose pool contains a single degenerate skill at 0.039.

Mean `stability_score` of the selected five: stable 0.956, balanced 0.956,
trending 0.987 — the "Stable" preset does not select more stable skills.

**This is a product limitation, and it is measurable rather than suspected.**
It belongs in the limitations chapter with the mechanism stated: the slider is
implemented correctly against a feature whose distribution is too concentrated
for it to act on.

---

## 4. Which model actually runs — and which one could ever be promoted

Everything in §3 was measured against `ds/model/model.joblib`
(`trained_at=20260728_005411`). Three separate checks were run on whether that
artifact is the one a user is served, and whether an honest retrain could ever
replace it. Raw output:
[`22-synthetic-ablation.json`](metrics-raw/22-synthetic-ablation.json).

### 4.1 Synthetic-sensitivity ablation — the model was retrained without it

`train.py` was re-run against the real corpus only
(`SOURCE_WEIGHTS=lang-uk-job-skills:1.0`, same 365/365 time constants), fully
isolated: `PERSIST_FEATURES=0` suppressed every Mongo write and `MODEL_OUT_DIR`
pointed at a scratch directory, so neither `model_runs`, `role_skill_features`
nor the served artifact was touched (verified after the run: still 2 run
documents and 132,514 feature rows).

| | With synthetic | Real only |
|---|---:|---:|
| Training records | 51,349 | **40,549** (−21.0%) |
| Mean top-10 Jaccard vs the live model | — | **0.657** |
| Mean **displayed top-5** Jaccard | — | **0.336** |
| Roles with an identical displayed top-5 | — | **0 of 12** |
| informative@10 | 55.8% | **42.5%** |
| Trend labels: rising / stable / falling | 163 / 66,085 / 9 | **0 / 66,189 / 0** |

Three findings, in order of weight:

1. **The entire trend feature is synthetic.** Without the continuation, *every
   one of the 66,189 (role, skill) rows is labelled `stable`* — zero rising,
   zero falling. The rising/falling arrows the product shows exist only because
   the corpus was extended past 2023-09. The real Djinni data cannot produce a
   trend, because it ends before the trend window.
2. **The candidate pool is fairly robust; the displayed list is not.** Two
   thirds of the top-10 pool survives (Jaccard 0.657), but the five skills the
   user actually sees agree only 0.336 — and **no role keeps the same five**.
   The mechanism is the stability re-sort: `stability_score` is fitted over the
   corpus's own month buckets, so shortening the timeline by three years
   reshuffles the display order even where prevalence barely moved.
3. **The synthetic data *improves* informativeness** (42.5% → 55.8%), rather
   than merely adding 2026 buzzwords. It is not a free win, though — see §4.2.

Concretely, on the roles a reviewer will check:

| Role | Live top-5 | Real-only top-5 |
|---|---|---|
| Data Scientist | llm, generative ai, pytorch, data science, deep learning | algorithms, data science, machine learn, tensorflow, deep learning |
| Software Engineer | llm, python, docker, api, software development | backend, api, docker, python, git |
| DevOps Engineer | kubernetes, terraform, python, ansible, bash | devops, terraform, infrastructure, kubernetes, automation |
| Frontend Developer | typescript, react, node js, html, css | typescript, react, front end, html, git |
| **Cyber Security** (52% synthetic) | cloud security, cybersecurity, python, penetration testing, computer science | cybersecurity, cyber security, python, computer science, penetration testing |

**Cyber Security is the counter-intuitive result:** the role with the most
synthetic data has one of the *most* stable top-5 (Jaccard 0.667, one skill
different). Its real skills are so role-specific that the generator, which
samples base skills from the role's own real distribution, largely reproduced
them. The volatility sits in the mainstream roles instead, where `llm` and
`generative ai` displace real skills. `llm` reaches a served top-10 in 2 roles
with synthetic data and **0** without; `generative ai` in 1 and 0.

### 4.2 The promotion gate is now locked against real data

The ablation run did not merely differ — **it was refused by the project's own
quality gate**:

```
Baseline: last promoted run (51349 total records)
NOT promoted (total records dropped >20% (51349->40549)) - keeping existing model.joblib
```

The gate blocks any run whose corpus is under 80% of the last promoted one.
The last promoted run is the synthetic-augmented model, so the bar is
**41,079 records — and the entire real corpus is 40,549.** It falls short by
**530 records, 1.3%.**

> **Promoting a 20.6%-synthetic model raised the promotion baseline above what
> the real data can reach.** A model trained on real market postings alone can
> no longer be promoted, and the block is silent — `train.py` exits non-zero and
> `run_daily.sh` skips the DS restart. Nothing in the system reports *why*.

This is not hypothetical: it is the exact configuration the nightly pipeline is
built to run.

### 4.3 In *this* environment the pipeline would train on an empty corpus

**Scope.** Everything in this subsection describes the local machine the metrics
campaign ran on. The scheduled pipeline runs on the deployment host, whose
collections were not read for this document; nothing below is evidence about that
host. It is recorded because it is the environment every other number here came
from, and because the same check is worth running wherever the pipeline is
deployed.

The pipeline (`pipeline/run_daily.sh`) trains with `TRAIN_USE_UNIFIED=1` from
`role_skill_observations`, weighted `linkedin:1.0,lang_uk:0.3`. The state of the
collections it depends on, in the `jobs` database it points at:

| Collection | Documents |
|---|---:|
| `raw_postings` (LinkedIn scrape target) | **0** |
| `jobs` (SkillNer target) | **does not exist** |
| `role_skill_observations` (training source) | **0** |
| `model_runs` | 1 document, no `promoted` field (broken — readiness audit §3.4) |

So even with `secrets/mongo.env` restored, a run **launched here** would scrape
into an empty collection, train on zero observations, and be blocked at the
first-promote rule (`total 0 < 200`). **The pipeline is fail-safe rather than
fail-dangerous — on an empty corpus it cannot promote a degenerate model.** What
this does *not* show is anything about the deployment host, where the corpus is
populated and the schedule runs.

### 4.4 The deployment path may never serve the measured artifact

Every number in §3 describes `ds/model/model.joblib`. That is **not** the file
the DS container reads. In `docker-compose.yaml` the service reads
`MODEL_PATH=/models/model.joblib` from the named volume `model_data`, and
`ds/docker-entrypoint.sh` seeds that volume from the image-baked model **only
when the volume is empty**:

```sh
if [ ! -f "$MODEL_DIR/model.joblib" ] && [ -f /app/model.joblib ]; then
  cp /app/model.joblib "$MODEL_DIR/model.joblib"
fi
```

The only other writer is the nightly pipeline, which §4.3 shows cannot run. So
on any machine whose `model_data` volume was created **before the 2026-07-28
retrain** (commit `6e6ac47`), `docker compose pull && up` serves the **pre-M06
model** indefinitely — the one whose Frontend Developer top skill is `backend`
and whose generic contamination is 74.2%. Rebuilding the image does not help;
only `docker volume rm model_data` does, and nothing in the repo does it or
documents it.

> **The model that *should* be running in production is the 2026-07-28 artifact.
> Which model *is* running depends on when that box's `model_data` volume was
> created, and there is no way to tell from the outside — the DS server exposes
> no version endpoint.** This is the "model_data volume landmine" M06 deferred,
> and it is the single highest-risk item for the demo: it can silently
> invalidate every model-1 number in this document and in `official-metrics.md`.
>
> **Before the demo:** `docker volume rm model_data` on the demo box, bring the
> stack up so the volume re-seeds from the current image, and verify that
> `/title/skills?title=Frontend Developer` returns `typescript, react, node js,
> html, css` — not `backend`. That check takes ten seconds and is the only
> external evidence of which artifact is loaded.

### 4.5 What the synthetic continuation is — and is not — evidence of

This is the framing the book needs, because the numbers in §4.1 are easy to
misread in both directions.

**The continuation is not a claim about the 2024–2026 market.** Its skills come
from a hand-curated list (`market_2026_skills.py`) with hand-chosen prevalence
ramps. Reading `llm` back out of the model as Data Scientist's top skill is
reading back what was written in: the assertion and the evidence are the same
artefact. **No market claim may be sourced from it.**

**What it is, is a forward simulation of the system.** It answers a question the
real corpus cannot: *given a corpus that reaches the present with a known signal
in it, does the pipeline surface that signal correctly?* Because the ground truth
is known by construction, this is a controlled instrument test — and it passes:
skills injected on a rising ramp come out labelled `rising` (`llm` ratio 1.54,
`growth_trend` 1.0) and down-weighted skills come out negative
(`jquery` −0.28). The recency weighting, the monthly bucketing, the stability
fit and the trend labels are verified end to end against a known answer.

So the honest sentence is: **the model currently behaves the way it would behave
once postings from 2024–2026 have actually been collected — under the specific
assumption that the market evolved the way the curated list says it did.**

Two consequences follow, and both belong in the book:

1. **The trend feature is a demonstration, not market information.** §4.1 shows
   that without the continuation there are zero `rising` and zero `falling`
   labels. Therefore **100% of the trend signal the product displays is the
   injected signal read back.** The rising/falling arrows demonstrate that the
   mechanism works; they do not tell a user what is rising in the job market.
   The UI and the book must say so wherever an arrow appears.
2. **The current lists are not a preview of the real future.** The 0.336 top-5
   Jaccard in §4.1 measures how much the displayed list depends on *this*
   assumed continuation. When real 2024–2026 postings are eventually collected
   they will not match the curated list, so the displayed skills will move
   again — by roughly that much. The ablation quantifies the dependency; it does
   not validate the assumption.

**Why it was still the right call.** Without the continuation the product would
serve a 2023 snapshot with no trend feature at all, and the mechanism built for
time-aware ranking would be untestable and unshowable. The alternative was not
"more honest numbers" — it was "no numbers and a dead feature". The correct
posture is the one the project already takes: generate it, mark every record
(`source='augmented-2026'`, `augmented=true`, `augmentation_method`), disclose
it, and — now — quantify exactly how much of the behaviour rests on it.

---

## 5. The metric catalogue

**Status** — `measured` (recomputed here or in `official-metrics.md`) ·
`derived` (arithmetic on measured values) · `not measured` (no data exists; do
not state a number).
**Placement** — `Exec` executive summary · `Res` research/method chapter ·
`Results` results chapter.

### A. Data pipeline — measured 2026-08-18

| ID | Metric | Formula | Value | Status | Placement |
|---|---|---|---|---|---|
| D1 | Taxonomy coverage of the source market | `mappable postings / raw rows` | 106,977 / 141,897 = **75.4%** | measured | Res |
| D2 | Sampling retention | `sampled / mappable` | 41,745 / 106,977 = **39.0%** | measured | Res |
| D3 | **Skill-extraction coverage** | `postings with ≥1 skill_record / extracted postings` | 40,778 / 41,745 = **97.7%** | measured | **Exec** |
| D4 | **Skill density** | median of `len(skill_records)` per posting | **18** (p25 12, p75 26, mean 19.9) | measured | **Exec** |
| D5 | Raw-match density | median of `full_matches + ngram_matches` per posting | 29 (mean 32.0, max 215) | measured | Res |
| D6 | Normalisation yield | `skill_records / raw SkillNer matches` | 831,143 / 1,335,568 = **62.2%** | derived | Res |
| D7 | Training-record retention | `records kept / candidate records` | 51,349 / 52,545 = **97.7%** | measured | Results |
| D8 | **Data scale (real)** | postings → observations → distinct skills | 41,745 → **831,143** → **21,678** | measured | **Exec** |
| D9 | Data scale (as trained) | same, including synthetic | 51,349 → 961,966 → 21,722 | measured | Results |
| D10 | **Market coverage** | `roles with record_count > 0 / 59` | **12 / 59 = 20.3%** | measured | **Exec** |
| D11 | Role balance | min / median / max real postings per covered role | 830 / 4,000 / 4,000 | measured | Res |
| D12 | Synthetic share | `synthetic / (real + synthetic)` | 20.6% overall, **52.0%** worst role | measured | Results + Limitations |
| D13 | Skill specialisation | `skills in exactly 1 role / distinct skills` | 10,324 / 21,722 = **47.5%** | measured | Res |
| D14 | Skill ubiquity | `skills present in all 12 roles` | 754 (3.5%) | measured | Res |
| D15 | Promotion rate | `promoted runs / recorded runs` | 2 / 2 | measured | Results |
| D16 | Nightly-pipeline reliability | `promoted / nightly runs` | — | **not measured** (the deployment host's `model_runs` was not reachable from this environment) | Limitations |
| D17 | **Usable-extraction curve** | `postings with ≥k skills / extracted`, k ∈ {1,5,10,15} | 97.7% / **95.7%** / **85.4%** / **67.1%** | measured | **Exec** |
| D18 | Density by role | median skills/posting per role | 15 (UX) … 23 (DevOps, Cyber) — **1.53× spread** | measured | Res |
| D19 | Extraction failure by role | `postings with 0 skills / role postings` | 1.66% (C++) … 3.00% (UX) | measured | Res |
| D20 | Synthetic share by role | `synthetic / (real + synthetic)` per role | 18.4% … **52.0%** (Cyber Security) | measured | Results + Limitations |
| D21 | Imbalance before/after cap | max/min and Gini over per-role counts | 26.9× → **4.8×**; Gini **0.410 → 0.119** | measured | Res |
| D22 | Loss attribution | share of total loss per cause | taxonomy 34,918 · balancing 65,232 (deliberate) · extraction 967 · training filters 1,196 | derived | **Exec** |

### B. Model 2 — CV → job title

| ID | Metric | Formula | Value | Status | Placement |
|---|---|---|---|---|---|
| T1 | **Top-1 accuracy (full product path)** | `predicted ∈ acceptable / scored CVs` | **26 / 29 = 89.7%** | measured | **Exec** |
| T2 | Top-3 accuracy | `acceptable ∩ top-3 candidates ≠ ∅ / scored CVs` | 27 / 29 = 93.1% | measured | Results |
| T3 | **Auto-accept precision @60 (deployed)** | `correct auto-accepted / auto-accepted` | 25 / 27 = **92.6%** | measured | **Exec** |
| T4 | **Auto-accept coverage @60** | `auto-accepted / scored CVs` | 27 / 29 = **93.1%** | measured | **Exec** |
| T5 | Auto-accept precision / coverage @80 | as T3/T4 at threshold 80 | **96.2%** / 89.7%, 0 correct demoted | measured | Results |
| T6 | Error taxonomy by failure mode | errors grouped by mode | 3 errors, **all on the `title_extraction` rung**: 1 adjacent-family confusion (Backend→Frontend), 1 over-specialisation (Software Engineer→ML Engineer), 1 unsupported occupation not blocked (`none`→NLP Engineer). 0 classifier-rung errors, 0 pipeline errors | measured | Results |
| T7 | Negative-fixture block rate | `blocked / negative fixtures` | 3 / 3 | measured | Results |
| T8 | Rung split | CVs resolved per ladder rung | 26 `title_extraction` (92.3% acc) / 3 `cv_classifier` (66.7%) | measured | Res |
| T9 | Determinism | identical title + confidence over 5 repeats | 5 / 5 | measured | Res |
| T10 | Classifier training coverage | `canonical titles with 0 real CVs / 59` | 33 / 59 = 56% | measured | Limitations |
| T11 | **Route distribution** | `CVs resolved per rung / scored CVs` | **89.7%** declared-title (88.5% acc) · **10.3%** classifier (100% acc) · 6.9% escalated to the manual picker · LLM fallback fires 2/29 | measured (new) | **Exec** |

> **T3 scoring-rule note.** Two defensible rules exist for the two CVs whose
> ground truth is `none`: *lenient* (prediction ∈ the manifest's acceptable
> titles) and *strict* (a `none` CV is correct only if no role was
> auto-accepted, which is the rule `official-metrics.md` §1.1 states in prose).
> Top-1 is **26/29 under both**. Auto-accept precision is **92.6% strict** and
> 96.3% lenient — cite the strict figure, as the published metrics do.

### C. Model 1 — skill ranking

| ID | Metric | Formula | Value | Status | Placement |
|---|---|---|---|---|---|
| S1 | **precision@10** | `relevant skills marked / 191 blind-labelled` | **97%** | measured | **Exec** |
| S2 | **informative@10** | `1 − (top-10 pool skills with ubiquity ≥ 6 of 12 roles) / 120` | **55.8%** vs 25.8% pre-M06 = **+30.0 pp** | measured (new) | **Exec** + Results |
| S3 | Config sensitivity | informative@10 under the DS default env | 55.8% → **44.2%** | measured (new) | Res + Limitations |
| S4 | Cross-role contamination | wrong-family skills in top-10 | 4 pre-M06 → **0** live | measured | Results |
| S5 | **Generic contamination @10** | complement of S2 — the reader-facing phrasing | **74.2% → 44.2%** | measured (new) | **Exec** |
| S6 | **informative@5 / generic@5** (displayed list) | same, over the 5 skills the product shows | **56.7%** vs 28.3% (contamination 43.3% ← 71.7%) | measured (new) | **Exec** |
| S7 | **relevance@5** (displayed list) | `relevant / 60 blind-labelled displayed skills` | **96.7% — identical for both models** | measured (new) | Results |
| S8 | Consistency of the M06 gain | roles improved / unchanged / regressed on informative@10 | **10 / 1 / 1** (regression: QA Automation, +30 pp contamination) | measured (new) | Results |
| S9 | **Environment sensitivity (operational)** | roles whose displayed top-5 changes under the DS default env | **8 of 12**, mean Jaccard 0.758, 0.83 skills replaced/role | measured (new) | Res + Limitations |
| S10 | **Preset separation** | mean Jaccard between preset top-5 lists | Stable≡Balanced **1.000 (12/12 identical)**; Stable vs Trending 0.945, identical in **10/12** | measured (new) | **Limitations** |
| S11 | **Synthetic dependence of the displayed list** | mean Jaccard, live top-5 vs real-only top-5 | **0.336**; **0 of 12** roles keep the same five (pool: 0.657) | measured (new) | **Results** |
| S12 | **Synthetic dependence of the trend feature** | rising / falling labels without synthetic data | **0 rising, 0 falling** of 66,189 rows (vs 163 / 9) | measured (new) | **Results + Limitations** |
| S13 | Informativeness contribution of synthetic data | informative@10, real-only vs as-trained | 42.5% → **55.8%** (+13.3 pp) | measured (new) | Results |
| S14 | **Promotion headroom for real data** | `real-only records / (0.8 × promoted baseline)` | 40,549 / 41,079 = **98.7% — gate blocks it** | measured (new) | **Limitations** |
| S15 | Deployment-artifact verifiability | is the served model identifiable at runtime? | **no version endpoint; volume-seeded once** | measured (new) | **Limitations** |

> S2/S3 close the gap `official-metrics.md` §3.3 flags explicitly: precision@10
> is structurally blind to what M06 changed, because its annotation protocol
> counts a generic-but-genuine skill as relevant. informative@10 reads the same
> artifacts, needs no annotator, and moves in the direction M06 targeted.
> `ubiquity(skill)` = number of the 12 data-carrying roles where the skill's
> prevalence ≥ 0.05; the yardstick is held identical across both artifacts, only
> the serving filter differs (each model is read the way it was actually served).

### D. Scoring agent — Match Score

| ID | Metric | Formula | Value | Status | Placement |
|---|---|---|---|---|---|
| C1 | **Pairwise ranking accuracy** | `concordant band pairs / all within-CV band pairs` | 15 / 24 = **62.5%** (75.0% excluding 4 ties) | measured (new) | **Exec** |
| C2 | Within-CV matched > mismatched | `CVs ordered correctly / 8` | 6 / 8 (1 tie, 1 inversion) | measured | Results |
| C3 | Band margin | `mean(matched) − mean(mismatched)` | 4.50 − 3.84 = **0.66** / 10 | measured | Results |
| C4 | Test-retest stability | mean σ of repeated `/analyze/rescore` | **0.11** points | measured | Res |
| C5 | Keyword-baseline agreement | `ratings within 2 points / 240` | 119 / 240 = 49.6% | measured | Results |
| C6 | Agreement with human judgement (MAE, ρ, ±2) | — | — | **not measured** (§2.5) | Limitations |
| C7 | **Paired delta profile** | matched − mismatched per CV | mean **+0.66**, median **+0.70**, range −0.60 … +2.10; 6 positive / 1 zero / 1 negative | measured (new) | Results |
| C8 | Inversion rate | `discordant / all band comparisons` | 5 / 24 = **20.8%** (4 further ties) | measured (new) | Results |

> C1 and C7 belong together in the book. "62.5% pairwise ranking accuracy" alone
> reads as near-chance; paired with "mean margin +0.66 on a 10-point scale,
> median +0.70, one inversion" it reads as what it is — a weak but real signal,
> with the tie rate (4/24) doing much of the damage.

### E. CV improvement

| ID | Metric | Formula | Value | Status | Placement |
|---|---|---|---|---|---|
| I1 | Blind human preference | `improved preferred / (improved + original) blind pairs` | — | **not measured** | Limitations |
| I2 | Unsupported-claim rate | `claims in improved CV unsupported by the original / total claims` | — | **not measured** | Limitations |

I1 and I2 both need a labelling session that has not been run. I2 is the more
important of the two — it is the safety property of a CV rewriter — and it is
partly automatable: a first pass can flag entities (employers, tools, dates,
figures) present in the improved CV and absent from the source, leaving only the
flagged spans for human adjudication. **Until that session runs, no number.**

---

## 6. What must not be claimed from this document

* **No *quantified* "nightly pipeline" claim.** The cron is implemented, wired in
  `ofelia/config.ini` and `pipeline/run_daily.sh`, and runs on the deployment
  host — but no run counts, promote rate or block rate were collected from that
  host, so none may be cited. Describe the cadence and its gate; never attach a
  number to them.
* **No "we scraped X postings" claim.** The corpus is a HuggingFace dump of
  Djinni postings, not CareerLens's own scraping. The LinkedIn/AllJobs scrapers
  in `scraping/` contributed **zero** records to the live model.
* **No blended synthetic/real figure** without the 20.6% (and 52.0% for Cyber
  Security) disclosure alongside it.
* Recomputed values differ marginally from the M06 report (mappable postings
  106,977 vs 106,979; real observations 831,143 vs 773,696 — the report counted
  at a different point in the normalisation). Cite the values in this document.

---

## 7. Open — what still costs real work

Everything else in this document was recomputed from data that already existed,
and the synthetic-sensitivity ablation originally listed here has since been run
— see §4. What remains is one measurement and two engineering decisions.

### 7.1 CV-improvement metrics (product)

`unsupported-claim rate` and `blind human preference` (catalogue I1/I2). A
30-suggestion sample is enough to state something like *"0/30 suggestions
introduced an employer, project, date or quantified achievement absent from the
source CV"* — which is the safety property of a CV rewriter and currently the
largest unmeasured area in the project.

* **Feasible:** needs the backend running with an OpenAI key to generate the
  sample, then a blind human pass. The generation and the flagging pass can be
  automated; the adjudication cannot.
* **Cost:** the labelling session is the real cost, and it is a team member's
  time, not compute.

### 7.2 Decisions raised by §4 (not measurements — choices)

1. **The demo box's `model_data` volume** (§4.4). Either recreate it and verify
   the served top-5, or accept that the served model is unidentified and say so.
   This is the only item on this list that can invalidate published numbers.
2. **The promotion baseline** (§4.2). If real-data-only retraining is ever meant
   to be possible, the baseline has to be reset or the 20% rule made
   source-aware. Leaving it as is means the synthetic corpus is permanent — a
   defensible choice, but it should be a stated one rather than an accident.
