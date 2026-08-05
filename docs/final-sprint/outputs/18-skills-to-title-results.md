# Skills → Title (Reverse Model) — Results (M18)

**Date:** 2026-07-29 · Notebook: `ds/model/skills_to_24_titles.ipynb` (runs top-to-bottom,
verified, 0 errors) · Research artifact: `ds/model/skills_to_24_titles.joblib`
(local, not wired anywhere).

> **Round 2 (same day, per user directive):** master_resumes.jsonl added as a third
> training source with explicit class balancing, and a chunked SkillNer fallback
> fixed the zero-extraction failure. Round-2 numbers are the headline; the original
> lang-uk-only round is kept below for the record. See "Round 2" section.

## What was built

*Occupation prediction from skill profiles* — the reverse of the shipped
`/cv/role` classifier (raw-text TF-IDF+LogReg). Input: the SkillNer-extracted
skill set of a document as a multi-hot vector. Pre-declared primary model
(no cherry-picking): **CV-domain Logistic Regression**.

## Training data (both marked, reproducible from local Mongo)

| Domain | Docs (≥3 skills, post leakage-guard) | Labels | Features (min_df=5) |
|---|---|---|---|
| Job postings (`lang-uk-job-skills`, M06 extraction, real only — synthetic `augmented-2026` **excluded**) | 40,529 | `og_title` via the existing keyword mapping | 7,362 |
| CVs (`lang-uk-cv-skills`, 11,776 extracted this milestone, checkpointed) | 10,651 | corpus `Primary Keyword` via the same mapping | 3,067 |

Label space: the 12 lang-uk-covered canonical roles. Leakage guard: skills that
are literally canonical title names (+plurals, 118 strings) are dropped from
every skill set — the analog of the text classifier's title-scrub.

## Held-out metrics (80/20 stratified)

| Model | acc | top-3 acc | macro-F1 |
|---|---|---|---|
| jobs / LogReg | 0.808 | 0.953 | 0.796 |
| jobs / MLP(128) | 0.825 | 0.962 | 0.814 |
| **cvs / LogReg (primary)** | **0.793** | **0.937** | **0.792** |
| cvs / MLP(128) | 0.822 | 0.953 | 0.822 |

(12 classes; majority baseline ≈ 0.083.)

**Domain shift** (LogReg): trained on jobs → tested on CVs **0.776** acc;
trained on CVs → tested on jobs **0.754**. The skill vocabulary transfers well
between postings and CVs — a book-worthy finding on its own.

## The real test — 32 authentic CVs (PDF → text → SkillNer → predict)

Coverage: 20 CVs have at least one acceptable title inside the 12-role space
("in coverage" = fair fight); 7 engineering CVs are structurally out of coverage
(SOC, malware, firmware, FPGA, pentest, embedded, one MLE); 5 are `none`
fixtures.

| | skills-model | text-model (shipped) |
|---|---|---|
| In-coverage (n=20) | **15/20 (75%)** | **16/20 (80%)** |
| `none` fixtures (n=5, veto/reject) | no rejection class (by design) | 0/5 vetoed |
| Out-of-coverage (n=7) | maps to nearest covered family (see below) | same behavior |

**The shipped classifier wins the head-to-head by one CV (16 vs 15).** Honest
notes on the gap:

* `backend-senior-strong_Daniel-Peretz.pdf` yielded **0 skills** (a SkillNer
  parse failure on that PDF's text), so the skills-model had literally no input
  (predicted UX Designer at conf 0.107 — the empty-vector prior). The text
  model also missed it (Java Developer). Excluding this no-input case:
  15/19 (79%) vs 16/19 (84%).
* The skills-model **wins** where text misleads: the student CV
  (`student-junior-weak`) — skills → Software Engineer ✓ (conf 0.987), text →
  Java Developer ✗.
* Confidence is informative: mean conf ≈ 0.97 on correct in-coverage
  predictions vs ≈ 0.59 on wrong ones (one over-confident error:
  Software-Engineer CV → Backend Developer at 0.995 — adjacent roles).

**Out-of-coverage behavior is semantically sane** — every prediction lands in
the nearest covered family: SOC / Malware / Pentester → Cyber Security;
Firmware / FPGA / Embedded → C++ Developer; ML Engineer → Data Scientist.
The model degrades gracefully instead of randomly.

## Agreement analysis (the cross-validation claim)

On the 20 in-coverage CVs the two directions **agree on 15**:

| | text-model correct | skills-model correct |
|---|---|---|
| When they **agree** (n=15) | 86.7% | 86.7% |
| When they **disagree** (n=5) | 60.0% | 40.0% |

Agreement between the text→title and skills→title directions is a real
confidence signal: accuracy jumps from ~50-60% to ~87% when they concur.
This is exactly the low-confidence trigger the detection ladder could use.

## Wiring decision memo

**Recommendation: do not wire the skills-model as a replacement** — the shipped
classifier is equal-or-better on accuracy and already covers 59 roles + a
rejection class vs 12 roles here. **The valuable wiring candidate is the
agreement signal**: run both, and treat disagreement as "low confidence" →
route to the LLM fallback / manual role picker that already exist. That is a
small, low-risk addition — but it is production wiring, therefore **a separate
task with its own kickoff**, not part of M18.

## Draft paragraph for the book (Chapter 3 / Future Work) — round-2 numbers

> Following the failure of the rule-based title extractor, the team's stated
> direction (meeting, 05/07) was *bidirectional role-skill inference* —
> predicting the occupation from the extracted skill profile rather than from
> raw text. We implemented this reverse model as a research notebook: multi-hot
> skill vectors from 15,414 CVs across two corpora (plus 40,529 postings as a
> transfer domain) feed a class-balanced logistic regression over 24 canonical
> roles, reaching 84.4% held-out accuracy (95.1% top-3, 0.90 macro-F1) with a
> learning curve that converges rather than memorizes. On 32 real-world CVs the
> skills-based model ties the shipped text classifier (16/25 in-coverage each),
> transfers across the posting/CV domains with only a ~3-point drop, and
> degrades gracefully outside its label space. Where classes are well covered,
> agreement between the two directions is a practical confidence signal
> (~87% joint accuracy when they concur vs ~50% under disagreement); where both
> models share sparse training classes their errors correlate — locating the
> next improvement in per-class data, not architecture.

## Limitations

* 12-role label space (lang-uk coverage); no rejection class — `none` CVs are
  out of scope for this model by construction.
* One PDF produced zero skills (SkillNer parse failure) — the skills path is
  only as good as extraction; the production ladder's text path covers this.
* CV labels come from the corpus' self-declared `Primary Keyword` (noisy at the
  margins, e.g. multi-role careers).

---

# Round 2 — expanded label space + robustness fix (2026-07-29, user directive)

## Two changes

1. **Chunked SkillNer fallback** (`ds/model/skillner_utils.py`, used by both the
   extraction pipeline and the production `/text/skills` endpoint): when SkillNer's
   matcher crashes on a whole document (a library bug hit by one authentic CV),
   annotation retries in line-aligned chunks and merges. The failing CV went from
   0 → 37 extracted skills, verified live through `/text/skills`.
2. **Third training source — `master_resumes.jsonl`** (4,792 usable structured CVs,
   labels via `taxonomy.master_label`, title strings scrubbed from the text).
   Adds 12 classes the lang-uk corpus lacks (ML Engineer, Penetration Tester,
   Platform, Embedded, Security Analyst, MLOps, NLP, CV-Engineer, …).
   **Class balancing per explicit user requirement** — frequency must not weight
   titles: classes capped at 600 (seeded downsample) + `class_weight='balanced'`
   in the loss. Extra data enriches title↔skills variety, not priors.

## Round-2 numbers

| Metric | Round 1 (12 classes) | **Round 2 (24 classes)** |
|---|---|---|
| Held-out acc / top-3 / macro-F1 | 0.793 / 0.937 / 0.792 | **0.844 / 0.951 / 0.899** |
| 32 authentic — in coverage | 20 CVs | **25 CVs** (ML, Fullstack, Platform, Embedded, Pentester, SOC→Security-family now count) |
| skills-model in-coverage | 15/20 (75%) | **16/25 (64%)** |
| text-model on same set | 16/20 (80%) | **16/25 (64%) — a tie** |
| On the original 20-CV subset | 15/20 | **16/20 (80%) — now equal to the text model** |

The zero-extraction CV now predicts Software Engineer (0.703) instead of garbage —
still counted wrong vs `acceptable=[Backend Developer]`, an artifact of the
lang-uk convention that labels Python-stack postings "Software Engineer".
The previously-missed ambiguous Data-Scientist CV is now correct (0.765).

## The honest headline

**On the harder, wider exam both directions score identically (16/25).** The five
newly-covered-but-missed CVs (2×ML Engineer→Data Scientist, Embedded→C++,
Firmware→C++, Pentester→Cyber Security, SOC→Cyber Security) fail the same way in
**both** models: the new classes have only 100–206 training examples with heavily
overlapping skill profiles, and both models collapse them into the adjacent
large class. Errors on rare classes are **correlated**, which also dilutes the
agreement signal on this set (agree-accuracy 66.7% vs disagree 50%, compared with
86.7%/50% in round 1): agreement is a strong confidence signal **where classes
are well-covered**, and no signal where both models share the same data gap.

Confidence remains informative for the skills model: the `none` fixtures now get
low confidence (0.15–0.30) except one over-confident Hebrew-English mix — a soft
reject threshold is plausible future work.

## Data provenance disclosure (master_resumes.jsonl)

The exact origin of `master_resumes.jsonl` is **not documented in the repo**: no
generation script, no source reference. The project's own docs describe it as
"systematically created" data (uniform structured fields, ~100 balanced examples
per role) and explicitly warn that metrics measured on it are optimistic — its
characteristics indicate synthetic/curated generation rather than organically
collected CVs. Consequences drawn here: (a) it is used symmetrically — the
shipped classifier was trained on the same corpus, so the head-to-head stays
fair; (b) the authoritative test remains the 32 authentic CVs (authored
independently in M04, zero overlap); (c) this disclosure belongs in the book
alongside the `augmented-2026` disclosure. **Open action: confirm provenance
with the team member who produced the file.**

## Updated wiring memo

Unchanged in direction, sharpened in detail: don't replace the shipped
classifier; the agreement signal is worth wiring **for the well-covered roles**,
and for rare roles the real fix is training data (the master corpus helps the
head-to-head close from -5pts to a tie — more per-class data is the lever).
Wiring remains a separate task with its own kickoff.
