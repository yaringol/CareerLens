<!-- FRONT MATTER — assembled before Chapter 1 -->

# CareerLens

### Final Project Book

**By:** Amit Alon · May Eliyahu · Yarin Golzar · Reut Maduel

**Approved by the supervisor:** Dr. Galit Haim

Submitted to the Computer Science Faculty of the College of Management

Repository: github.com/yaringol/CareerLens

**August 2026, Rishon LeZion**

---

## Acknowledgments

We thank our supervisor, Dr. Galit Haim, for steady guidance through every pivot
this project took — from a five-role proof of concept to a 59-role system with a
daily learning pipeline — and for insisting, at each checkpoint, that we measure
before we claim. We also thank the Computer Science Faculty of the College of
Management for the framework and the freedom to let the problem grow beyond its
original specification.

---

## Executive Summary

CareerLens is a working web application that gives job seekers the analytical
lens employers already point at them. A candidate uploads a CV and a real job
posting; the system identifies their target role automatically, scores ten
market- and posting-derived skills on CV evidence, explains each gap, and guides
a section-by-section rewrite of the CV itself. The need is documented: 88% of
employers themselves admit their screening systems reject qualified candidates
for not matching exact job-description wording — employers analyze candidates
with NLP, while candidates answer with a text editor.

Under the surface run three kinds of intelligence: a statistical market model
over 59 tech roles, retrained nightly behind a promotion gate that refuses
regressions; a supervised CV-to-role classifier; and five JSON-guarded LLM
agents where genuine judgment is required. None of this was the first design.
The book's central engineering finding is architectural: no single model
survived contact with real CVs, and the shipped role detector is a ladder of
three mechanisms with disjoint failure modes, arrived at through a chain of
measured failures. The result, on a purpose-built evaluation corpus of 32 labeled
authentic-style CVs: the full pipeline resolved the correct role for 89.7% of
the 29 positive cases (Top-1) — where its strongest individual component reaches
only 55-62% — and the market model's top-10 skill lists were judged 97% relevant
under blind annotation.

We report weaknesses with the same care: the Match Score is highly stable
(test-retest σ = 0.11) but only weakly separates matched from mismatched
postings, because — as our measurement campaign revealed — the scoring prompt
never sees the posting itself; and agreement with human judgment was deliberately
left unmeasured within the submission timeline. This book documents the system as
built, the road of experiments that led to it, every deviation from the original
specification, and the measured evidence — including the open questions — behind
every claim.

---

## Table of Abbreviations

| Abbreviation | Meaning |
|---|---|
| API | Application Programming Interface |
| ATS | Applicant Tracking System |
| CV | Curriculum Vitae |
| DS | Data Science (service) |
| E2E | End-to-End |
| EMSI | Economic Modeling Specialists International (skill taxonomy) |
| ESCO | European Skills, Competences, Qualifications and Occupations |
| F1 | Harmonic mean of precision and recall |
| IDF | Inverse Document Frequency |
| JD | Job Description |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| KNN | K-Nearest Neighbours |
| LLM | Large Language Model |
| MAE | Mean Absolute Error |
| MLP | Multi-Layer Perceptron |
| NER | Named Entity Recognition |
| PDF | Portable Document Format |
| POC | Proof of Concept |
| SBERT | Sentence-BERT (sentence embeddings) |
| SPA | Single-Page Application |
| TF-IDF | Term Frequency – Inverse Document Frequency |
| UI | User Interface |

---

## Table of Figures

| # | Figure | Section |
|---|---|---|
| 1 | Seven months in one line: the project timeline | 3 |
| 2 | System overview: who talks to whom | 4.1 |
| 3 | Nightly learning: the coverage gate as promotion mechanism | 4.1 |
| 4 | Step 1 — Upload & Role Detection: three attempts from cheapest to smartest | 4.1 |
| 5 | Step 2 — Personalize: the user chooses what "important skills" means | 4.1 |
| 6 | Step 3 — Analyze: every skill graded 0–10 on CV evidence | 4.1 |
| 7 | Step 4 — Improve: section-by-section suggestions with the user in control | 4.1 |
| 8 | Step 1 in the product: automatic role detection with manual override | 4.3 |
| 9 | Step 2 in the product: Recommendation Balance and focus skills | 4.3 |
| 10 | Step 3 in the product: dashboard, Skill Deep-Dive and Gap Analysis | 4.3 |
| 11 | Step 4 in the product: original beside suggested rephrasing | 4.3 |
| 12 | Auto-accept threshold sweep on the 29-CV corpus | 5.2 |
| 13 | Band separation: the Match Score barely distinguishes fit | 5.2 |
| 14 | CareerLens as designed: the original specification's architecture | 5.6 |
