# CareerLens Final Project Book - Skeleton & Writing Plan

> Working document for M09. Every required template section is preserved 1:1; the
> Research chapter (Ch. 3) is ADDITIVE, following the MED example's structure, so
> template chapters 3/4/5 become 4/5/6. Word budget total: ~10,000.
> Status legend: ✍️ write now (phase A) | ⏳ M05 (metrics) | 🎤 M10 (interview) | 🖼️ M16 (figures) | 🏁 closure (wave 4)

---

## Front matter

### Cover page — ✍️
"CareerLens" by Amit Alon, May Eliyahu, Yarin Golzar, Reut Maduel. Approved by the
supervisor: Dr. Galit Haim. Submitted to the Computer Science Faculty of College of
Management. **August 2026, Rishon LeZion.** Repo: github.com/yaringol/CareerLens.

### Acknowledgments — 🏁 (~80 words)
Thanks to the CS faculty and Dr. Galit Haim's guidance through the pivots this project
took — from a five-role POC to a 59-role system with a daily learning pipeline.

### Executive Summary — 🏁 written LAST (250-300 words)
Will state: the ATS-rejection problem (anchored by the 88% employer-admission stat [1]),
the dual-model + LLM-agent architecture, the honest headline metrics from M05, and the
core finding that role detection from unstructured CVs required three cooperating
mechanisms (classifier, semantic normalizer, LLM fallback) rather than one model.

### Table of Contents — 🏁 generated at assembly.

### Table of Abbreviations — ✍️ seed now, grow while writing
ATS, CV, JD (job description), TF-IDF, MLP, SBERT, NER, LLM, RAG, IDF, KNN, API, SPA,
E2E, F1, MTTR (if SOC examples used), EMSI, ESCO.

### Table of Figures — 🖼️ Figures 1-7 DONE (M16, simple per-step set per user directive)
Fig.1 as-designed (spec image2) | Fig.2 system overview | Fig.3 nightly learning +
quality gate | Fig.4 Step 1 Upload & Role Detection | Fig.5 Step 2 Personalize |
Fig.6 Step 3 Analyze | Fig.7 Step 4 Improve — all in `../figures/`, embedded in Ch.4
and §5.6. Still pending: Fig.8+ model-2 results charts (M05); screen captures (M08).
Style rule (user directive): every diagram = own title inside the image, one step per
diagram, 4-6 boxes, readable over detailed.

---

## 1. Introduction (~1,200 words) — ✍️ phase A

### 1.1 Background
Job seekers are rejected before any human reads their CV: most mid-to-large employers
filter with Applicant Tracking Systems, and 88% of employers themselves admit that
qualified high-skills candidates are vetted out for not matching exact job-description
criteria [1]. The tooling asymmetry is the point: employers hold NLP-powered screening,
candidates hold a text editor. CareerLens exists to hand the candidate the same
analytical lens.

### 1.2 Problem Statement
Given a CV (PDF) and a job description, produce an evidence-based, per-skill match
assessment and an actionable improvement path — without the candidate having to know
which of 59 tech roles they "count as", and without trusting a single opaque score.
Sub-problems: reliable text extraction from real-world PDFs; role identification from
unstructured text; deciding which 10 skills matter (5 market-core, 5 posting-specific);
scoring each skill against CV evidence; and rewriting the CV without destroying it.

### 1.3 Objectives
From the original specification: parse real CVs; extract top-10 target skills (5 core +
5 dynamic); score each 1-10 with an LLM agent; compute a global Match Score; provide
gap analysis and phrasing suggestions; export an improved CV. Added during development
(scope grew): automatic role detection (no manual role dropdown), personalization
(stable/balanced/trending strategies), saved-CV comparison, and a daily
scrape-retrain-promote pipeline.

### 1.4 Scope and Limitations — honesty section, verified facts only
English-only by design. 33 of 59 supported roles (the cyber/hardware/research
specialties) were trained on synthetic title strings without real CV bodies — stated
plainly with its evaluation consequence. Privacy: uploaded CVs are stored in MongoDB
per authenticated user and sent to the OpenAI API for scoring; deletion endpoint
exists; no other distribution. LLM scoring is non-deterministic (test-retest σ reported
in Ch. 5). Job-posting URL fetching works for JSON-LD/og sites, not for logged-in
boards.

### 1.5 Methodology
Iterative build-measure-fix: POC (5 roles) → measurement → expansion (59 roles) →
adversarial self-audit → correction. Two models with different learning paradigms
(statistical aggregation vs. supervised classification), LLM agents where judgment is
required, and a nightly pipeline whose promotion gate refuses regressions. Evaluation
on a purpose-built corpus of 32 authentic-style labeled CVs (Ch. 5).

### 1.6 Organization of the Project Book
One paragraph mapping chapters 2-6 + appendices.

---

## 2. Literature Review (~1,500 words) — ✍️ phase A (source: literature-dossier.md ONLY)

### 2.1 Overview of Relevant Literature
Structured by our components: ATS screening and its documented failure modes [1][2];
resume parsing/IE [3]; skill extraction and taxonomies — SkillSpan/ESCO background,
SkillNer/EMSI as our extractor [4][5][13]; text representation and shallow classifiers —
IDF origins [6], fastText's "linear is often enough" [7] framing our TF-IDF+MLP choice;
sentence embeddings and centroid classification [8][9]; CV-JD matching — conSultantBERT
[10] including the honest tension with our TF-IDF result; LLM-as-a-judge and its
reliability limits [11][12]; labour-market trend mining [13]; leakage/shortcut learning
[14][15] grounding our scrub methodology. Red-flag sources are presented as design
tensions, not buried.

---

## 3. Research (~1,800 words) — ✍️ skeleton + documented episodes now; 🎤 enrichment
*(Additive chapter, MED-style — the experimental journey of the two models.)*

### 3.1 Model 1: from skill counting to a market model
POC aggregation over 5 roles → 59-role feature matrix (prevalence, IDF-based
specificity, recency weighting) → the discovery that the served ranking ignored the
specificity feature and its fix (Frontend's top skill was literally "backend") →
promotion-gate design: three real runs where the gate correctly rejected two degraded
models and promoted the merged-source run.

### 3.2 Model 2: proving it learns
The 77% leakage discovery: titles verbatim in summaries → scrub → honest F1 drop
0.981→0.932. The stop-words experiment that cratered F1 to ~0.2 (react/sql are skills,
not noise) — a failed "obvious" fix worth telling. Label-space consolidation 65→38→59+
__other__. Baselines: LogReg 57.6% vs deployed MLP 62.3% on scrubbed data (citable
per [15] only because measured post-scrub).

### 3.3 Role detection as a system, not a model
Why one classifier wasn't enough: char-ngram KNN mapped iOS→Kernel by spelling; the
fix ladder — SBERT centroid normalization (92.6% held-out) → classifier → closed-list
LLM fallback. 🎤 [M10: untold attempts that never reached git].

### 3.4 The pipeline that "ran" but didn't
The silently-broken daily pipeline (scraper wrote local JSONL in "w" mode, no Mongo,
no SkillNer) and what it taught us about verifying automation. 🎤 enrichment.

---

## 4. System Design and Implementation (~2,200 words) — ✍️ phase A (template Ch. 3, all subsections preserved)

### 4.1 System Architecture — 🖼️ Fig.2-4 placeholders
Three services on the request path: React SPA → Node/TS API (auth, orchestration,
**five** LLM agents: scoring, skill extraction, suggestions, title classification,
title extraction) → FastAPI DS server (model 1 title→skills; model 2 CV→title
TF-IDF+MLP over 59+other; SBERT title normalizer) → MongoDB (careerlens:
users/CVs/analyses; jobs: market data — backend holds a read-only admin connection).
Deployment view: 5 long-running containers + batch pipeline + cron. The frontend
never talks to the DS service directly. Verified against code (Ch.4 agent audit,
2026-07-21), not legacy docs.

### 4.2 Data Collection and Preprocessing
LinkedIn scraping with SkillNer extraction persisted at ingest (never re-extracted);
lang-uk datasets (210K CVs / 142K postings) as augmentation with taxonomy mapping;
skill_records schema v2 with observed_at; PDF upload path: pdf-parse → normalization +
preserved 25-line header window for title detection (the asymmetry and why it exists).

### 4.3 Implementation Details
Model 1 training as weighted aggregation + promotion gate (code-level); model 2
training with scrub; the five LLM agents (scoring, skill extraction, suggestions,
title classification, title extraction) with JSON-validation guards; per-section CV improvement
architecture (sections saved independently to avoid overwrite races); saved-CV
background comparison (3 starred, parallel, non-blocking). Selective code snippets
per template requirement.

### 4.4 Evaluation Metrics — ☑ M05 delivered (see outputs/official-metrics.md)
The evaluation corpus (32 labeled authentic-style CVs across 9 scenario types, ground
truth in the 59+none space). Metrics actually measured:
- **Model 2:** Top-1/Top-3 accuracy overall and per scenario, measured through the full
  product path (PDF upload → extraction → ladder), not the model in isolation;
  confidence calibration **split by ladder rung** (cosine similarity vs softmax share);
  auto-accept threshold sweep; agreement-signal ON/OFF ablation; determinism probe.
- **Model 1:** precision@10, blind single-annotator, live model vs the pre-M06 backup
  merged into one shuffled list. First quality metric this model has ever had.
- **Scoring agent:** test-retest stability, band separation (matched vs adjacent vs
  mismatched postings), and divergence from a keyword baseline — all label-free.
  **Human-vs-agent agreement (MAE/ρ/±2) was deliberately not measured** (team decision,
  2026-08-03); §5.5 states the consequence rather than implying the score was validated.
- **Coverage:** real-CV training coverage recomputed from the corpora themselves.

---

## 5. Results and Analysis (~1,600 words) — ⏳ M05 (all template subsections preserved)

### 5.1 Experimental Setup — ✍️ can draft now (M04 corpus + harness description)
### 5.2 Presentation of Results — ⏳ [tables from official-metrics.md]
### 5.3 Data Analysis and Interpretation — ⏳
### 5.4 Comparison with Existing Approaches — ✍️ partial now (vs. ATS/keyword tools,
     per-skill evidence scoring vs. single-score matchers; sources [2][7][10]) + ⏳
### 5.5 Discussion of Findings — ⏳ + 🎤
### 5.6 Planned vs. Built (ADDITIVE — the user's required chapter) — ✍️ phase A
The systematic table against the original spec: single Python AI service → three
services; Glassdoor/AllJobs+Selenium → LinkedIn+lang-uk+promotion gate; manual role
dropdown → automatic detection ladder; "weighted average" → unweighted mean (and what
we'd have to change to honor the word); Gap Analysis screen → [status per M15];
.txt export vs. mockup's PDF; 9-week/4-person plan → ~25 weeks with grown scope.
Each row: planned, built, and **what the spec missed** — the user's explicit demand.

---

## 6. Conclusion and Future Work (~500 words) — 🏁
Achievements against objectives; limitations restated honestly; future work seeded
from what M07 cut (pipeline trigger UI, model-2 59-class retraining) + embedding-
fallback evolution + multi-language support.

---

## 7. References — ✍️ seeded from literature-dossier.md (15 verified sources; [16+] reserved)

## 8. Appendix A — 🏁
Setup instructions (3 services + Mongo + git-lfs); spec-API → implemented-API mapping
table; evaluation corpus manifest excerpt.

---

## Writing rules (bind every contributor)

1. Voice: first-person plural "we", MED register. Collective attribution ONLY.
2. Honesty woven through chapters, not quarantined.
3. Every factual claim traces to: code (verified), a kickoff/audit doc, the dossier,
   or the spec. **M05 has delivered — `outputs/official-metrics.md` is now the single
   source for every performance number, and its "must NOT be cited" list is binding.**
   In particular the leakage figure 0.981→0.932 is **no longer usable** (it describes a
   38-class model that is not deployed); it was on the earlier pre-approved list and is
   now withdrawn. Other prior numbers that remain valid: 88% [1], stop-words ~0.2,
   LogReg 57.6% vs MLP 62.3% (component-level only — always alongside the 89.7% system
   figure), normalizer 92.6% held-out, 31,278 skills DB. Coverage is **33 of 59**,
   recomputed from the corpora; the older 32 and 35 counts are superseded.
4. No invented references — dossier's [1]-[15] plus nothing, until M09 closure.
5. Figures: numbered placeholders "[Figure N — M16/M08]" with intended captions.
