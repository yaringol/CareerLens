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
measured failures. The result: on a purpose-built corpus of 32 labeled
authentic-style CVs, the full pipeline identifies the correct role with 89.7%
Top-1 accuracy — while its strongest individual component reaches only 55-62% —
and the market model's top-10 skill lists are 97% relevant under blind
annotation.

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

---

## Table of Contents

- 1. Introduction
  - 1.1 Background
  - 1.2 Problem Statement
  - 1.3 Objectives
  - 1.4 Scope and Limitations
  - 1.5 Methodology
  - 1.6 Organization of the Project Book
- 2. Literature Review
  - 2.1 Overview of Relevant Literature
  - 2.2 ATS Screening and Its Failure Modes
  - 2.3 Resume Parsing and Information Extraction
  - 2.4 Skill Extraction and Skill Taxonomies
  - 2.5 Text Representation and Shallow Classifiers
  - 2.6 Sentence Embeddings and Centroid Classification
  - 2.7 CV–Job Matching
  - 2.8 LLM-as-a-Judge
  - 2.9 Labor-Market Analysis
  - 2.10 Data Leakage and Shortcut Learning
- 3. Research
  - 3.1 Model 1: from skill counting to a market model
  - 3.2 Model 2: proving that it learns
  - 3.3 Role detection as a system, not a model
  - 3.4 Experiments that shaped the product, not the models
  - 3.5 What the pipeline taught us about believing automation
- 4. System Design and Implementation
  - 4.1 System Architecture
  - 4.2 Data Collection and Preprocessing
  - 4.3 Implementation Details
  - 4.4 Evaluation Metrics
- 5. Results and Analysis
  - 5.1 Experimental Setup
  - 5.2 Presentation of Results
  - 5.3 Data Analysis and Interpretation
  - 5.4 Comparison with Existing Approaches
  - 5.5 Discussion of Findings
  - 5.6 Planned vs. Built
- 6. Conclusion and Future Work
- 7. References
- Appendix A
  - A.1 Running the System
  - A.2 Specification API → Implemented API
  - A.3 Evaluation Corpus Manifest (excerpt)

---

# 1. Introduction

## 1.1 Background

Modern hiring begins with a machine reading text. Before a recruiter opens a CV, an Applicant Tracking System has usually already parsed it, matched it against the job description, and decided whether a human should ever see it. The overwhelming majority of employers rely on such systems to filter or rank incoming candidates, and the consequences are documented: 88% of employers themselves admit that qualified, high-skills candidates are vetted out of the process because they do not match the exact criteria established by the job description [1]. The rejection, in other words, is frequently about phrasing rather than ability.

What struck us about this situation is its asymmetry. Employers operate sophisticated NLP-powered screening pipelines; candidates operate a text editor. A job seeker cannot see which skills the screening software weighs, how their wording lands, or why nothing comes back after they submit. CareerLens is our attempt to correct that asymmetry: a web application that hands the candidate the same analytical lens the employer already points at them — showing, skill by skill, how a specific CV reads against a specific job posting, and how to close the gap before pressing "submit".

## 1.2 Problem Statement

The problem we set out to solve can be stated compactly: given a CV as a PDF and a job description as pasted text or a URL, produce an evidence-based, per-skill assessment of the match and an actionable path to improving it — without requiring the candidate to know which of the 59 technology roles we support they "count as", and without asking them to trust a single opaque score.

Stated that way, the problem decomposes into sub-problems that each proved substantial. Real-world PDFs must be converted to text reliably despite wildly inconsistent layouts. The candidate's role must be identified from unstructured prose, because job seekers do not label themselves with canonical titles. The system must decide which skills matter for the target position — in our design, 10 of them, split into 5 market-core skills and 5 posting-specific ones. Each skill must then be scored against actual evidence in the CV rather than mere keyword presence. Finally, the CV must be rewritten to strengthen weak areas without fabricating experience or destroying the document's voice. Each of these sub-problems shaped a component of the final system, and several of them resisted our first solutions, as Chapter 3 recounts.

## 1.3 Objectives

Our objectives fall into two groups, and the distinction is worth preserving: what we committed to in the original project specification, and what the system grew to include once real usage exposed assumptions the specification had not questioned.

From the specification, we committed to: parsing real CVs uploaded as PDF; extracting the top 10 target skills for a position, 5 core and 5 dynamic; scoring each skill on a 1–10 scale using an LLM agent; computing a global Match Score; providing gap analysis with concrete phrasing suggestions; and exporting an improved version of the CV.

During development the scope grew. We added automatic role detection — replacing the manual role selection we had originally planned — after realizing that asking candidates to classify themselves into a canonical title was itself part of the problem we claimed to solve. We added personalization, letting users steer skill selection through stable, balanced, or trending strategies depending on whether they want the analysis anchored to established market skills or emerging ones. We added comparison across a user's saved CVs. Most consequentially, we added a daily pipeline that scrapes fresh job-market data, retrains the underlying model, and promotes the new version only if it passes a coverage gate — turning a one-off trained artifact into a system that tracks the market it describes.

The system that emerged from both lists is best stated in one breath, because the rest of this book unpacks it: a React application over a Node API that orchestrates five JSON-guarded LLM agents and a Python model server, where role detection is a three-rung ladder with a second-opinion agreement signal, skill targets come half from a nightly-retrained market model and half from the posting at hand, every score is evidence-based on a 0–10 scale, and improvement happens section by section with the user in control.

## 1.4 Scope and Limitations

Several boundaries of this work matter for interpreting our results, so we state them up front.

CareerLens is English-only by design. All parsing, skill extraction, scoring, and model training operate on English text; CVs and postings in other languages are out of scope.

The system supports 59 technology roles, but not all of them rest on equal data. For 33 of the 59 — chiefly the cyber, hardware, and research specialties — the training data consisted of synthetically generated title strings without real CV bodies behind them. We disclose this because it has a direct evaluation consequence: for those roles, the role-detection model has never seen an authentic CV of that profession, and its behavior there is correspondingly less trustworthy. Chapter 5 treats these roles separately rather than letting them blend into aggregate results.

Privacy has real boundaries too. An uploaded CV is stored in MongoDB, associated with the authenticated user who uploaded it, and its text is sent to the OpenAI API for skill scoring. It is not distributed anywhere else, and a deletion endpoint lets users remove their data — but users should understand that a third-party API does see their CV text.

LLM-based scoring is not deterministic: the same CV analyzed twice against the same job can receive slightly different scores. We measured this test-retest variability and report its standard deviation in Chapter 5, rather than presenting the scores as exact.

Finally, fetching a job posting by URL works for sites that expose structured metadata (JSON-LD or Open Graph tags), but not for job boards that require a login; for those, users must paste the posting text manually.

## 1.5 Methodology

We worked iteratively, in a loop we came to think of as build–measure–fix. We began with a proof of concept covering a handful of roles, measured its behavior on real documents, and expanded to the full 59-role system. Then came the step we consider the most valuable of the project: an adversarial self-audit that went looking for the ways we might be fooling ourselves. Eight independent review agents swept the code and raised 74 findings; each finding was then attacked by a dedicated refuter, and the 52 that survived set the agenda for the project's final phase. Among them: a data-leakage problem whose correction lowered our headline numbers while raising our confidence in them, and three features that existed in the code but were dead in practice. The corrections they forced are documented in Chapter 3.

Architecturally, the methodology combines two models with different learning paradigms — one built by statistical aggregation of market data, the other by supervised classification — with LLM agents reserved for the places where semantic judgment is genuinely required. A nightly pipeline retrains on freshly scraped postings, and its promotion gate refuses to deploy any model that regresses against the incumbent. For evaluation we built a purpose-made corpus of 32 labeled, authentic-style CVs, spanning scenario types from straightforward matches to deliberately difficult and out-of-domain cases; Chapter 5 reports our results against it.

## 1.6 Organization of the Project Book

The remainder of this book is organized as follows. Chapter 2 reviews the literature relevant to each component of the system, from ATS screening and its documented failure modes through skill extraction and text classification to the reliability limits of LLM-based scoring. Chapter 3 presents our research journey — the experiments, false starts, and corrections through which the two models took their final shape. Chapter 4 details the system's design and implementation: the architecture, data collection and preprocessing, and the implementation of the models, agents, and daily pipeline. Chapter 5 presents the results and their analysis, including Section 5.6, where we systematically compare what was planned against what was built and account for every difference. Chapter 6 concludes the project and outlines future work. The References list all sources cited throughout the book, and Appendix A provides setup instructions and supplementary technical material.

---

# 2. Literature Review

## 2.1 Overview of Relevant Literature

The literature behind CareerLens spans two bodies of work: the empirical study of automated hiring — what Applicant Tracking Systems (ATS) do to candidates, and how accountably — and the NLP techniques needed for a candidate-side answer: parsing, skill extraction, text classification, semantic embeddings, and machine evaluation. We review both in the order of our pipeline, from the problem domain (2.2) to the leakage methodology that governs our evaluation (2.10). We deliberately include work that argues against our own design choices; those tensions are stated where they arise and taken up again in Chapter 5.

## 2.2 ATS Screening and Its Failure Modes

The clearest evidence that automated screening harms qualified candidates comes from Fuller et al. [1], a two-year Harvard Business School and Accenture study of 8,720 "hidden workers" and 2,275 executives in the US, UK, and Germany. Automated filtering is near-universal among the employers surveyed, and lossy by their own admission: 88% acknowledge that qualified high-skills candidates are vetted out for not matching the exact criteria of the job description — a figure that rises further still for middle-skills workers. Yet the excluded perform at or above the level of traditionally sourced hires once employed: rejection is frequently a phrasing failure, not an ability failure. Raghavan et al. [2] examine the same machinery from the accountability side: auditing 18 vendors of algorithmic pre-employment assessments, they find development and validation practices largely opaque, in tension with antidiscrimination law, and silent on foundational questions such as the choice of prediction target. Together they define our motivation and our obligation: [1] is the evidence base for handing candidates the analytical lens employers already hold, while [2] reminds us that our own automated pipeline inherits the transparency demands it critiques — a point we revisit in Chapter 5.

## 2.3 Resume Parsing and Information Extraction

Before any analysis, a CV must become machine-readable structure, and the literature shows why this first step is hard. Gaur et al. [3] tackle a single resume section — education — with named-entity recognition, and their account of the obstacles generalizes: heterogeneous layouts, inconsistent section conventions, free-form phrasing, and above all the scarcity of annotated resume corpora. Their workaround is semi-supervised bootstrapping: train on a small seed set, predict on unlabeled sections, correct against reference lists, and retrain, reaching 92.06% accuracy. The lesson we draw is the constraint, not the architecture: high-quality resume information extraction demands annotated data that most teams do not have — the scarcity that shaped CareerLens's extraction module, which pairs direct PDF text extraction with a pre-built skill extractor rather than a custom-trained resume NER model.

## 2.4 Skill Extraction and Skill Taxonomies

Skill extraction is now a research task in its own right. Zhang et al. [4] introduce SKILLSPAN, a span-level dataset of 14.5K sentences and over 12.5K annotated spans from job postings, with guidelines grounded in the ESCO taxonomy and a hard-versus-soft distinction. They argue the task is harder than classic NER — skill spans are longer and syntactically more complex — and show that domain-adapted language models significantly outperform non-adapted ones; the surrounding field and its taxonomies are consolidated in Senger et al. [13] (Section 2.9). Our production extractor sits deliberately at the other end of the spectrum: SkillNer [5], an open-source spaCy-based module that phrase-matches text against a curated vocabulary derived from the EMSI (now Lightcast) skills database — 31,278 canonical skills in its bundled SKILL_DB, each carrying a unique identifier that canonicalizes every surface form to one entry — rather than running a trained model; matching runs through spaCy's PhraseMatcher over exact, n-gram, and abbreviation forms. The virtues are real — no annotated data required, deterministic behavior, canonicalized surface forms — but [4] implies the cost: a recall ceiling on novel or freely-phrased skills, a price we accepted knowingly. SkillNer [5] is the exact tool at the heart of CareerLens: skills extracted from postings feed Model 1's aggregation, and CV-side skills feed the ten-skill list our scoring agent grades.

## 2.5 Text Representation and Shallow Classifiers

Sparck Jones [6] originated inverse document frequency (IDF), arguing that a term's specificity should be interpreted statistically — by its distribution across a collection, not its meaning — so matches on rarer terms deserve higher weight. The principle does double duty in CareerLens: it is the root of the TF-IDF representation feeding Model 2, and Model 1's specificity feature — an IDF-style measure of how exclusive a skill is to a role — applies the same statistics to skills rather than index terms (though, as Chapter 3 recounts honestly, the serving path never consumed that feature, and what curbs ubiquitous skills in production is a simpler filter built on the same insight). On the classifier side, Joulin et al. [7] show that a shallow fastText classifier over bag-of-words and n-gram features matches deep classifiers in accuracy while being orders of magnitude faster, scaling to hundreds of thousands of classes on CPU. This "linear is often enough" result sets expectations honestly: gains from adding modest depth to a sparse pipeline should be real but small, a framing we hold ourselves to in Chapter 5. Together, [6] and [7] justify Model 2's architecture class — TF-IDF with a shallow classifier over 59-plus-one job-title classes, fit for a small dataset and a CPU-deployable product.

## 2.6 Sentence Embeddings and Centroid Classification

Where sparse features fail — two job titles sharing no words yet meaning the same role — sentence embeddings take over. Reimers and Gurevych [8] introduce Sentence-BERT (SBERT): Siamese fine-tuning of BERT so individual sentences map to fixed vectors whose cosine similarity is semantically meaningful, collapsing a semantic search from roughly 65 hours to about 5 seconds and founding the sentence-transformers ecosystem from which our `all-MiniLM-L6-v2` model descends. For classifying in that space, Snell et al. [9] supply the canonical justification: prototypical networks represent each class by the centroid of its examples and assign by nearest centroid, a deliberately simple inductive bias that beats far more complex meta-learners when data per class is limited. These results jointly underpin CareerLens's title normalizer — raw scraped or user-supplied titles are embedded with a MiniLM sentence-transformer [8] and assigned to the nearest of 59 canonical-title centroids [9], the appropriate bias for our few-examples-per-class regime and cheap enough to run on every request.

## 2.7 CV–Job Matching

The closest published relative of CareerLens's core task is conSultantBERT [10], an industry-academic system from the staffing firm Randstad that fine-tunes a Siamese SBERT on more than 270,000 resume–vacancy pairs labeled by staffing consultants, substantially outperforming baselines built on TF-IDF features and off-the-shelf BERT embeddings while coping with noisy parsed resumes and cross-lingual matching. This both validates and challenges us: it confirms that semantic CV–vacancy comparison works, yet poses the sharpest tension in this review, since its TF-IDF baselines lose to embeddings while our Model 2 ships a TF-IDF pipeline. Our reconciliation is threefold: the tasks differ ([10] is pairwise matching, Model 2 is 59-plus-one-class classification); [10]'s advantage came from fine-tuning at a supervision scale we do not possess, and off-the-shelf embeddings were not the winning configuration even there; and [7] documents that sparse models remain competitive for classification specifically. We do not treat the tension as settled by argument — we return to it in Chapter 5. [10] thus anchors the comparison against which CareerLens's per-skill, evidence-based matching must position itself.

## 2.8 LLM-as-a-Judge

Zheng et al. [11] named and systematized the paradigm our scoring agent belongs to. Their central result is encouraging: GPT-4-class judges exceed 80% agreement with human preferences — the level at which humans agree with each other — making LLM judging a scalable, explainable approximation of human evaluation. The same paper catalogues the failure modes: position bias, verbosity bias, self-enhancement bias, and limited fine-grained grading ability. Wang et al. [12] sharpen the critique: positional bias is severe enough that merely reordering candidate responses can flip rankings, letting a weaker model "beat" a stronger one on a majority of queries; their remedy is a calibration framework combining multiple evidence generation, balanced position aggregation, and human-in-the-loop review. Both cut directly to CareerLens's scoring agent, which grades each of ten skills on an absolute 0–10 scale against the CV — single-answer grading that structurally avoids the pairwise positional bias of [12]. But the broader lesson — LLM scores are framing-sensitive and imperfect at fine-grained grading [11] — remains live, and motivates the consistency checks we report in Chapter 5. These sources are simultaneously the defense of our gpt-4o-mini per-skill judge and the honest bound on what its scores can claim.

## 2.9 Labor-Market Analysis

CareerLens does not only read one CV against one posting; it maintains a picture of what each role demands across the market, placing it in the field Senger et al. [13] survey as computational job market analysis. The survey consolidates the methods, public datasets, and terminology for extracting and classifying skills from large volumes of postings and mapping them onto taxonomies such as ESCO, positioning posting mining as the data source for labor-market intelligence. Direct academic literature on temporal skill-trend mining specifically remains thin, so [13] serves as the field's consolidation point and our adjacent-literature anchor. CareerLens's postings pipeline — scraping per role over time, aggregating extracted skills in Model 1, and surfacing demand dynamics through recency weighting — is an applied instance of this program, grounding the stable-versus-trending skill distinction our personalization feature exposes to the user.

## 2.10 Data Leakage and Shortcut Learning

The final body of work shaped not what we built but how we measure it. Geirhos et al. [14] unify many deep-learning failures as shortcut learning: models latch onto spurious cues that maximize benchmark performance but do not transfer, arising whenever training data offers an easier signal than the intended one; the remedy is evaluation under distribution shift. Kapoor and Narayanan [15] document the consequence at the scale of science: leakage affects 329 papers across 17 fields, organized in a taxonomy of eight types including features that proxy the label — and in their case study, every claim that complex ML beat logistic regression failed to reproduce once leakage was fixed. This literature reads like a diagnosis of our own early results: 77% of Model 2's training CVs contained the target job title verbatim — a textbook label-proxy feature [15] and the easiest available shortcut [14] — and scrubbing it visibly lowered the prototype's near-perfect F1, the drop itself being the evidence that the original score measured leakage rather than learning. [15] further mandates that comparisons against simpler baselines are meaningful only on scrubbed data, a discipline we adopt throughout. The discovery is told in Chapter 3 and its measurement consequences in Chapter 5; [14] and [15] turned a bug fix into the methodological backbone of our evaluation.

---

# 3. Research

This chapter is the story of how CareerLens's two models took their final shape:
what we tried, what failed, why it failed, and what we did next. Each section
opens with the solution that actually ships — the destination — and then walks
the road that led to it, because several of the mechanisms that define the final
system (the label-scrubbing step, the three-rung role-detection ladder, the
promotion gate) exist only because an earlier, simpler idea broke first and
taught us something we did not know. Figure 1 puts the whole journey on one
line; everything on it is told in full below.

![Figure 1 — Seven months in one line: above the line, what was built; below it, what failed or changed course.](figures/figure-1-timeline.png)
*Figure 1 — Seven months in one line: above the line, what was built; below it, what failed or changed course.*

## 3.1 Model 1: from skill counting to a market model

The market model that ships today is a nightly-retrained statistical aggregation
over 59 roles: prevalence-ranked, stability-selected, ubiquity-filtered skill
lists, guarded by a promotion gate, and — under blind annotation — 97% relevant.
Almost none of that was designed up front. It was arrived at, one failure at a
time, and this section walks that road.

It begins with a re-scope. One day after the original nine-week plan's second
milestone passed its deadline, a new milestone appeared on the project board: a
mandatory proof of concept, exactly five predefined roles and five core skills.
The nine-week plan was never formally closed; the POC simply replaced it. In
hindsight this was the right call. Everything that follows grew out of a small
working system that could be touched and judged, not out of a full specified
scope being built in parallel.

Our first model lasted exactly three days. It indexed 8,486 raw scraped job
titles with TF-IDF, found a query's ten nearest neighbours, and returned the most
frequent skills among them — with the entire dataset serialized into a 4.77MB
artifact. We never measured it; a manual spot check was enough to end it. Asked
about `python developer`, it returned *python, backend, scalable, computer
science, best practices* — three of the five generic noise. Three days later it
was gone. Its replacement's artifact weighed 139KB — thirty-four times smaller
and better at the same time, because the original had been carrying the whole
dataset as its "model" — and its training notebook shed over nine and a half
thousand of its ten thousand lines. What survives of model-zero is a fossil: the
replacement's noise blacklist still contains, verbatim, the three bad outputs of
that one spot check — the moment a failed check became an architecture decision.

What replaced it was barely a model at all, and that was the point. For each of a
handful of hand-curated POC roles, we summed the weighted skill matches that
SkillNer extracted from scraped postings and served the top of the list. It was
simple enough to demonstrate the product idea, and simple enough that retraining
was a cheap nightly aggregation rather than a training run. When the system later
grew to 59 canonical roles, the aggregation grew with it into a feature matrix:
for every (role, skill) pair we compute *prevalence* (how often postings for the
role ask for the skill, recency-weighted), *title specificity* (an IDF-style
measure of how exclusive the skill is to the role [6]), and time-based features
over the accumulating history.

Feeding this model was a search of its own, and it too moved by failure. The
first scraper we ever wrote targeted a single company's careers page, because it
was reachable and unblocked; it yielded twenty-four postings. AllJobs came next,
wrapped in a Hebrew-to-English translation pipeline, and was retired wholesale
once we saw what it produced: low-quality, outdated postings with translation
artifacts on top. Glassdoor, named in the specification, was never attempted. So
we went back to the source we had been avoiding for fear of blocking, LinkedIn,
and put in the engineering effort to collect from it reliably. It paid off; the
data quality justified every workaround. The last piece was the external lang-uk
corpus (2020-2023), and its job is more interesting than "more data": it is a
time machine. A five-month project cannot scrape the multi-year history that
trend and stability features need, so a verified historical corpus stands in for
the system's mature future, and the stable-versus-trending personalization
signals can be demonstrated today over a horizon our own scraping will only
reach years from now. From twenty-four postings to a corpus of over 180,000
postings and profiles, the arc taught us one thing above all: data quality, not
access convenience, sets a market model's ceiling.

Then, while mapping the project's architecture — establishing what actually
connects to what — we found something uncomfortable: the nightly scrape-and-train
loop was not feeding the served model at all. The scraper wrote to a local file,
and the trainer read from a collection that nothing populated. The pipeline had
every appearance of health, and it had never done anything. Charting that wiring
and fixing it produced what we now consider one of the project's better ideas: a
**promotion gate** between training and serving. A freshly trained model is
compared against the model currently in production on total record mass, role
coverage, and per-role confidence, and it is promoted only if it does not regress.
The gate proved itself almost immediately, in three consecutive real runs. The
first, trained on a partial scrape, was rejected: a fraction of the expected
records, one role covered. The second, broader but still narrow, was rejected
again, four roles with data where the gate demanded eight. The third, a LinkedIn
scrape merged with the external corpus at reduced weight, passed and became the
serving model. Without the gate, either of the first two runs would have quietly
replaced a working model with a broken one during the night.

The model's hardest lesson surfaced embarrassingly late, during a pre-submission
audit — and it turned out to be a *family* of failures, all with the same shape:
a feature that existed in the code and was dead in practice. The serving path, it
emerged, ranked skills by prevalence alone: the specificity feature was computed,
stored in the artifact, and described in the README's ranking formula, but the
code answering live requests never read it. The symptom was memorable — the
top-ranked skill for a Frontend Developer was "backend", because generic
engineering terms are prevalent everywhere, and only the unread specificity term
knew they were not distinctive. The same audit found the trend feature
mathematically dead: its rising/falling thresholds (1.25 and 0.80) sat entirely
outside the range the data could actually produce, so of 60,334 skills, exactly
zero had ever been labeled rising or falling — a feature that could not fire.
And a one-character-class bug in a key name (`time_coverage_reliable` read where
`time_features_reliable` was stored) had every reliability flag in the product
reading false. Each repair was chosen for safety days before code freeze: the
trend thresholds were recalibrated to percentiles at server load, leaving the
artifact untouched; the key was fixed in one line; and rather than wiring
specificity into serving — a change with unpredictable effects across all 59
roles — we attacked the ranking symptom directly with a ubiquity filter that
excludes skills appearing under nearly every role, retrained on the merged
corpus, and added a floor so that a role with only a handful of records now
answers `limited_data` instead of serving fabricated fragments. Then we measured
what changed (Chapter 5): the retrained model's top-10 lists are 97% relevant,
and the cross-role contamination that started this story — `backend` under
Frontend Developer, `python` under Java Developer — no longer appears in them.
The specificity feature remains computed and unread to this day, and Section 4.3
says so. What we carried forward: a feature that is computed but never consumed
is not a feature, and only inspecting what the serving code actually returns,
rather than the training code or the documentation, tells you what your model
does.

## 3.2 Model 2: proving that it learns

The classifier that ships today reads a scrubbed CV body and predicts over the
59 canonical roles plus an explicit reject class, and every number we publish
for it was measured after its training data was cleaned of the shortcut that
inflated its first results. Getting to "numbers we can defend" is this section's
story.

The CV→title classifier began with a suspiciously excellent number: a
near-perfect macro-F1 on held-out data, measured on an early 38-class prototype.
Numbers that good demand suspicion, so we went looking, and the training corpus
delivered the explanation. 77% of the CVs contained their labeled job title
verbatim in the summary section. The model was not reading careers; it was
copying the answer from the top of the page, a textbook shortcut in the sense of
Geirhos et al. [14]. The fix was a scrubbing step: at training time, the CV's own
title string is removed from its body, and the current position's heading is
dropped from the experience block. Scrubbed, the score fell visibly — a worse
number and a far better model, and the only kind of number we were willing to
keep [15]. We cite no figures from that prototype in this book: it is not the
deployed model, and its within-corpus scores describe a system that no longer
exists. The deployed classifier's numbers, component and system alike, appear in
Chapter 5.

The obvious next idea failed completely, and the failure drew a boundary we had
not known existed. If title words leak labels, why not add them all as
stop-words? Because in this domain label words *are* content words. "React",
"sql", and "java" are title fragments and legitimate skills at the same time,
and removing them cratered framework-centric classes to an F1 around 0.2. So
leakage had to be removed surgically, per document — this CV's own label — and
never globally, per vocabulary.

The label space went through three shapes of its own. The raw corpus carried 65
title strings, synonym-fragmented ("React Developer" vs. "Frontend Developer")
with a long tail of classes too rare to learn. We consolidated to 38 clean
classes, then mapped them through a hand-curated table into the 59 canonical
roles that model 1 understands. That bridge held until the project's final
phase, when the audit retired it: the deployed classifier is now trained
directly on the 59 canonical roles plus an explicit `__other__` reject class,
removing a whole layer of semantic drift between what the classifier says and
what the skills model can answer. The specialist third of the taxonomy posed a
harder choice. For 33 roles we could find no real CVs anywhere. We weighed
shrinking the taxonomy and hand-labeling, and chose a third path: synthetic
title strings as a bridge, so all 59 roles stay usable while we keep looking for
a real corpus. The cost of that bridge only became visible in measurement, not
in design review — a no-data role can be guessed wrong at high confidence, with
no safety net underneath. Chapter 5 measures exactly that, and shows how the
detection ladder's declared-title rung turned out to absorb it.

On architecture, the comparison that mattered was a linear baseline against a
shallow network on identical scrubbed features: logistic regression reached
57.6% accuracy, a one-layer MLP 62.3%. We kept the MLP and we present it as what
it is, a modest, validated increment over a strong linear baseline [7], measured
only after the leakage was gone, because comparisons made on leaky data are not
comparisons [15]. Both figures describe the classifier component in isolation.
The accuracy the user actually experiences belongs to the whole detection ladder
and is markedly higher; Chapter 5 measures both and explains the gap. How that
ladder came to exist is the next story.

## 3.3 Role detection as a system, not a model

What ships today for role detection is not a model but a system: a three-rung
ladder — read the declared title and normalize it semantically; failing that,
classify the CV body; failing that, ask a language model constrained to the
closed list — plus a second-opinion agreement signal that can veto a confident
answer. Every rung of that design is a scar from an attempt that failed, and the
scars are worth reading in order.

The first attempt was regex-based extraction of the stated title — a real
contender, not a placeholder — and its failure delivered the domain's defining
lesson: a CV is not structured, everyone writes their own. Next came the
matching problem, connecting whatever title we did find to our canonical list.
The cheap answer was a character-n-gram nearest-neighbour matcher,
dependency-free and semantically blind, and it became our most quotable failure.
It mapped "iOS Developer" to *Kernel Developer* (both contain "os"),
"JavaScript Developer" to *Java Developer*, and "SQL Developer" to *Frontend
Developer*. Spelling similarity, we learned, is not semantic similarity; for job
titles the two are frequently opposites. Its replacement was chosen by
measurement, not taste: the sentence-embedding normalizer that ships today
scored 92.6% on the same held-out split where the character matcher managed
69.4% — a twenty-three point jump that ended the argument.

Even the "solved" rung kept teaching. Late in the project we discovered that the
declared-title rung — the ladder's first and best step — had been *dead code for
every real PDF upload*: the text normalization that every other consumer
depended on stripped the line breaks, the header extractor skipped the resulting
CV-length "line", and every upload silently fell through to the classifier. We
found it not through a bug report but while recording demo videos, when a
textbook-clean CV refused to take the path it obviously should. The fix — a
preserved header window travelling alongside the flattened text (the asymmetry
Section 4.2 documents) — promptly opened two subtler holes, each caught and
closed in turn. First, splitting header lines on commas shredded summary
sentences into fragments, and a bare buzzword like "Kubernetes" could outscore
the real title against the canonical list and win a silent, confident,
wrong auto-accept. Then the repair for *that* — folding PDF line-wrap fragments
back into their sentences — initially folded email addresses onto genuine title
lines and destroyed them: twenty of twenty regression cases failed at once. The
regression suite caught it within the hour, and the final fix folds only lines
that are not independently recognizable as noise. The episode hardened a rule we
kept for the rest of the project: PDF text is an adversary, and no header
heuristic changes without the full suite running behind it.

The regex failure had also planted an idea that took months to mature. If the
title line cannot be trusted, but the skills we extract from a CV can, then the
role should be inferable from the skills themselves — a bidirectional role-skill
inference, title→skills and skills→title (the latter direction is known in the
literature as occupation prediction from skill profiles, within the job-title
classification family surveyed in [13]). We shelved the idea for lack of time
and built the pragmatic ladder instead: sentence embeddings [8] against per-role
centroids [9] over the 59 canonical roles for a stated title; the TF-IDF+MLP
classifier when no usable title exists; and a language-model agent choosing from
the *closed list* of 59 roles when confidence is too low, with a validation
guard that rejects any answer not literally on the list, because a fallback that
can invent roles is worse than no fallback. Detection, we concluded, is a system
property: no single mechanism survives contact with real CVs, but the ladder's
failure modes are disjoint. (Model experiments conducted outside this repository
are recorded separately in the project chronicle and are not claimed here.)

The closing weeks gave the shelved idea its turn, and gave us two last lessons
in discipline. The first came from our own rules: the production normalizer had
grown undocumented, so we reconstructed it in a notebook and compared the
rebuild against the live artifact — an exact aggregate tie, eight fixes against
eight regressions. Our equivalence gate therefore refused the swap, and we
obeyed it: the live artifact stayed, and the notebook became its specification.
The gates we build to stop bad models, it turns out, also stop us. The second
came from the reverse-direction notebook itself: a classifier predicting the
role from a CV's extracted skill set alone, trained over the well-covered
titles. Head-to-head on our authentic-CV corpus it tied the deployed text
classifier. Not an upgrade, and we did not ship it as one. But the experiment
surfaced something subtler and more useful: when the two directions *agreed* on
a CV, the answer was far more likely to be correct than either model's own
confidence score could indicate. A model's self-reported confidence is one
witness testifying about itself; two independently trained witnesses agreeing is
evidence of a different kind. That observation became the production **agreement
signal** of Section 4.3: boost on agreement, cap on disagreement, skip when the
check cannot change the outcome. Wiring it in produced one last, humbling
lesson. The signal was first attached to the DS endpoint that the design
documents said the product called — and tracing the real request path showed the
backend never called that endpoint at all. We re-wired the signal onto the rung
the product actually executes, and only then could its effect be measured
end-to-end (Chapter 5). Even in the project's final week, the gap between the
documented path and the executed path was still teaching us to verify the
wiring, not the wiring diagram.

## 3.4 Experiments that shaped the product, not the models

Not every experiment in this project happened inside a model. Some of the most
consequential trial-and-error happened in what the product says to its user, and
those episodes deserve the same telling.

Take the skill scale. It was recalibrated twice, and neither change came from a
metric. The first came from a direct note by our supervisor: something truly bad
must start from zero — a candidate who does not know Linux cannot receive a 1
for it. We re-anchored the scale at 0. The second change came from thinking
about recruiters rather than models: real screening effectively demands a high
fit before a human engages, so we tightened the "strong" band to 8.0–10, because
the product should tell a candidate their CV is strong only when that is
actually true. A score scale, we came to understand, is a product statement, not
a statistic; both anchors encode a promise to the user.

Another change taught us about our own mistakes. When automatic role detection
replaced the manual role dropdown, the manual override was removed along with
it, which left an out-of-domain CV — a nurse's, say — with nothing but nonsense
suggestions and no way to say "my role is not on your list." There was no design
rationale behind this. It was a misunderstanding of the task, and we would
rather say that than invent a justification after the fact. The escape hatch was
restored in the final phase: an unsupported CV now routes to "choose the closest
supported role" with a manual picker, and we verified the behavior live in the
shipped UI.

One feature managed to vanish without anyone deciding to remove it. An early
skill-preferences API (user-weighted skill ranking) was implemented, then
silently disappeared in a later rewrite of the serving code; no one recalls
choosing to drop it, and only its remnants stayed behind in the repository.
Months later the same idea resurfaced, properly productized this time, as the
Personalization screen with its stable, balanced, trending, and custom
strategies. Ideas outlive their first implementations — provided someone
eventually notices they were good.

The screens had their own hardest case. The Personalize screen absorbed more
consecutive fixes in one 48-hour stretch than any other part of the frontend,
and the post-mortem was unambiguous: we had built the screen before defining its
data contract. Where the skill pool comes from, how it grows from five skills to
ten without overlaps, how the user's selections travel to the next screen — all
of it was resolved while the screen already existed, one fix at a time. The
lesson pairs with the per-section versioning story of Section 4.3: design the
data contract before the UI that renders it. (The frontend as a whole went
through one deliberate full redesign, from the functional screens of January to
the product that ships — driven not by a failure but by a value the team held:
the application should be clear, pleasant, and readable, with an obvious flow.)

And finally, testing. The hand-written acceptance set that drove our hard-case
debugging was built by enumerating the system's possible user flows — clear
title, no title, out-of-domain, ambiguous, and so on — so that every case
represents a path a real user could take. That discipline is what gave a small
hand-written set its outsized diagnostic power, and it later shaped the scenario
taxonomy of the formal evaluation corpus (Section 5.1).

## 3.5 What the pipeline taught us about believing automation

We end the chapter where its hardest lesson lives, back at the pipeline of
§3.1, because that lesson generalizes beyond this project. The pipeline had
every appearance of health: a scheduler that fired nightly, a scraper that
logged success, a trainer that produced artifacts. What it lacked was a single
end-to-end assertion — *did the serving model actually change, and is it
better?*

The same lesson kept returning in new costumes. One July morning the product
was serving a model whose skill arrays were empty for all 269 stored roles — a
mid-training intermediate artifact had ended up on disk — and every analysis
request in the product failed until the next day's retrain. Nothing had
crashed; the model was simply hollow, and nothing between training and serving
had checked. Our own first test suite turned out to embody the opposite
failure: it retried each CV up to three times until the score landed inside a
band the team itself had defined — a test that, in effect, graded its own
homework. When the audit caught the circularity we demoted the suite from
evidence to smoke test, and built the labeled corpus of Chapter 5 in its place.

Every piece of automation we built after these discoveries carries an
end-to-end assertion in some form: the promotion gate for training runs,
JSON-schema validation guards on every LLM agent's output, and an evaluation
corpus with pinned ground truth (Section 4.4) in place of ad-hoc spot checks.
(Resolving the pipeline also closed the deployment story: migrating the whole
system onto Docker in late June surfaced structural issues that took real
fixing, and the containerized pipeline-plus-gate of Section 4.1 is the result.)
"It runs every night" and "it works" are different claims, and only the second
one is worth reporting. The next chapter describes the system that survived all
of the above.

---

# 4. System Design and Implementation

Chapter 3 told the story of how the pieces came to be; this chapter describes the system they add up to, as actually built and shipped, verified against the code rather than against our earlier design documents. Where the implementation diverges from the original plan, we say so here and analyze the divergence in Section 5.6.

## 4.1 System Architecture

CareerLens is composed of three cooperating services on the request path. A React single-page application (SPA) is the only surface the user touches. It talks exclusively to a Node.js/TypeScript API server, which owns authentication (JWT), request validation, orchestration, and all five LLM agents. The Node API in turn is the only client of a Python FastAPI data-science (DS) server, which hosts the learned models: the title-to-skills market model (model 1), the CV-body-to-title neural classifier (model 2), the sentence-embedding title normalizer, and the SkillNer skill extractor. Persistence is MongoDB with two logical databases: `careerlens` (users, saved CVs, analyses, improvement sessions) and `jobs` (scraped postings, extracted skill observations, training runs). ![Figure 2 — System overview: the user touches only the web app; the API server orchestrates the AI models, OpenAI, and the database.](figures/figure-2-system-overview.png)
*Figure 2 — System overview: the user touches only the web app; the API server orchestrates the AI models, OpenAI, and the database.*

Two boundary rules organize the design. First, the frontend never calls the DS service directly — the DS base URL exists only in the backend's environment — so every model invocation passes through one place that can validate inputs, apply thresholds, and fall back gracefully. Second, the `jobs` database is written only by the data-collection side (the scraper and the nightly pipeline); the backend opens a read-only connection to it solely for the admin model-status dashboard, never on the user request path.

In deployment (docker-compose) the system runs as five long-lived containers — MongoDB, backend, DS, scraper, frontend — plus two batch components: a `pipeline` container that runs the daily scrape–extract–retrain job, and an `ofelia` cron sidecar that launches it on schedule. The pipeline writes model artifacts to a `model_data` volume shared with the DS container; a container restart is the promotion mechanism, and the restart happens only when the training run passes the promotion gate (Section 4.3). The gate is a **coverage** check, not an accuracy check: it compares record counts, the number of titles carrying data, and how many of those clear a density threshold, refusing a run that shrinks the corpus. It cannot tell a more accurate model from a less accurate one. ![Figure 3 — Nightly learning: a newly trained model goes live only if the coverage gate confirms it describes at least as much of the market as the current one.](figures/figure-3-nightly-learning.png)
*Figure 3 — Nightly learning: a newly trained model goes live only if the coverage gate confirms it describes at least as much of the market as the current one.*

The Node API exposes the full product surface: authentication (`/register`, `/login`); CV management (`/upload`, a saved-CV library capped at ten files with up to three "starred" favorites); role detection (`/cv/title`, `/cv/extract-title`, `/title/match`); analysis (`/analyze`, `/analyze/personalized`, `/analyze/rescore`, `/analyze/compare-saved`); personalization (`/personalize/options`, saved preference endpoints); and the per-section improvement flow (`/cv-improve/prepare`, `/suggest`, `/merge`, plus session CRUD). A typical session flows upload → role detection → personalization → analysis → improvement. The user journey is four steps, each shown separately:

![Figure 4 — Step 1, Upload & Role Detection: three attempts from cheapest to smartest.](figures/figure-4-upload-detect.png)
*Figure 4 — Step 1, Upload & Role Detection: three attempts from cheapest to smartest.*

![Figure 5 — Step 2, Personalize: the user chooses what "important skills" means.](figures/figure-5-personalize.png)
*Figure 5 — Step 2, Personalize: the user chooses what "important skills" means.*

![Figure 6 — Step 3, Analyze: every skill graded 0–10 on CV evidence; the Match Score is their average.](figures/figure-6-analyze.png)
*Figure 6 — Step 3, Analyze: every skill graded 0–10 on CV evidence; the Match Score is their average.*

![Figure 7 — Step 4, Improve: section-by-section suggestions with the user in control.](figures/figure-7-improve.png)
*Figure 7 — Step 4, Improve: section-by-section suggestions with the user in control.*

## 4.2 Data Collection and Preprocessing

The market model learns from two sources. The primary source is LinkedIn job postings collected by our scraper into a raw collection, then annotated at ingest by SkillNer — a phrase-matching extractor over the EMSI skill taxonomy (31,278 skills) running on spaCy — and persisted with their extracted skills. Extraction happens once, when a posting enters the corpus; training and serving never re-run the extractor over old postings, which keeps the nightly pipeline resumable and its cost bounded. The second source is the lang-uk recruitment datasets (Djinni, English): 210,250 candidate profiles and 141,897 job descriptions imported from Hugging Face and passed through the same SkillNer batch extractor, with a mapping layer that projects the Djinni role categories onto our canonical taxonomy. Because the two sources differ in quality and closeness to our taxonomy, training weights them per source (LinkedIn 1.0, lang-uk 0.3 by default). The historical corpus also plays a role beyond volume: its 2020-2023 span simulates what the system's own scraping will only accumulate after years of operation, which is what lets the stable-versus-trending signals of the personalization feature be demonstrated over a realistic time horizon today (Chapter 3 tells the reasoning). Because that span predates the LLM era's skills, training adds a curated 2024-2026 continuation — 10,800 records, every one explicitly marked `source='augmented-2026'` in the database, so synthetic data can never masquerade as observation.

Both sources converge into a unified `role_skill_observations` collection (schema version 2): one row per (posting, skill) observation, already carrying the resolved canonical title, the extractor's confidence score, and an `observed_at` timestamp. That timestamp is what makes every time-aware feature possible — recency weighting, trend labels, and the monthly-bucket stability slope all anchor to when a posting was actually published, not to when we happened to scrape it.

On the serving side, preprocessing begins at PDF upload. We extract the text layer with pdf-parse, then apply deliberately aggressive normalization — lowercase, punctuation stripped, all newlines flattened to spaces — because the downstream consumers (LLM scoring, keyword matching, skill extraction) were built around that canonical form. That same flattening, however, destroys the one signal title detection needs: real line breaks ("Alex Cohen\nSoftware Engineer" and "alex cohen software engineer" are not the same input). Rather than change the normalized text every other consumer depends on, the upload path additionally preserves a bounded window of the CV's original first 25 non-empty lines — case and punctuation intact — and both texts travel together through the API. This asymmetry is not elegant, but it is honest engineering: it fixes the title-detection input without risking regressions in four other consumers, and it bounds the raw text sent to the extraction LLM.

## 4.3 Implementation Details

**Model 1 — the market model.** This is the third incarnation of the idea — Chapter 3 tells how a nearest-neighbour prototype and an unguarded serving path each died on the way here. Training (`ds/model/train.py`) is a statistical aggregation, not gradient-based learning: each of the 59 canonical roles accumulates evidence from its postings, with each posting's contribution decayed exponentially by age (half-life 14 days) so that current demand dominates. For every (role, skill) pair we compute a small feature vector — the load-bearing lines, verbatim:

```python
prevalence  = total_score / denom          # recency-weighted mean
idf         = np.log(n_titles / skill_title_count[skill])
specificity = idf / np.log(max(n_titles, 2))
```

Prevalence answers "how often does this role ask for this skill now"; specificity is an IDF-style penalty on skills that appear under many roles. We state plainly what our own audit found (Chapter 3): the serving path never consumed the specificity feature — it is computed, stored in the artifact, and to this day not read at ranking time. What actually curbs everywhere-skills in production is a different, simpler mechanism added after the audit: a **ubiquity filter** that drops any skill appearing under more than a configurable number of roles (`SKILL_UBIQUITY_CAP`), together with a minimum-prevalence floor for a role to count as covered. With the filter in place, serving ranks the surviving skills by prevalence into a top-10 pool, then selects the displayed five by stability score, so the list favors what is both demanded and durable. A trend label (rising/stable/falling) compares the last seven days against all-time prevalence, and the stability score fits a slope over monthly occurrence buckets. Both filter parameters are environment-driven — an operational detail with measurement consequences, because a demo box running the defaults produces materially different rankings than the configuration we evaluate in Chapter 5.

Every nightly run then faces the promotion gate (`promotion_gate.py`). A new model replaces production only if it does not regress on data volume relative to the last promoted run:

```python
old_non_low = non_low_title_count(baseline_counts, canonical_titles)
new_non_low = non_low_title_count(new_counts, canonical_titles)
if new_non_low < old_non_low:
    return False, f'non_low titles dropped {old_non_low}->{new_non_low}'

old_total = total_records(baseline_counts, canonical_titles)
new_total = total_records(new_counts, canonical_titles)
if old_total > 0 and new_total < old_total * 0.8:
    return False, f'total records dropped >20% ({old_total}->{new_total})'
return True, 'ok'
```

The limitation is worth spelling out: this gate counts records, not accuracy. It reliably blocks the failure mode we actually observed — a run trained on a broken or partial scrape (Chapter 3 documents two real rejections) — but it would happily promote a well-fed model that ranks skills badly. Closing that gap with a quality metric (precision@10, Section 4.4) is future work we return to in Chapters 5 and 6.

**Model 2 and the role-detection ladder.** The CV-body classifier is a scikit-learn pipeline of a word-level TF-IDF vectorizer and an MLP classifier with one hidden layer of 256 units, predicting directly over the 59 canonical titles plus a `__other__` rejection class for non-engineering CVs. The served confidence is a deliberate transformation: the raw softmax mass is spread over 60 classes, so the server renormalizes the top-3 non-`__other__` candidates into shares — while letting `__other__`'s probability mass keep deflating those shares, because that deflation *is* the rejection signal that routes a request onward.

Role detection as a whole is a three-rung ladder in the backend, because no single mechanism survived contact with real CVs — regex, character matching, and a bare classifier each failed in its own instructive way (Chapter 3). First, an LLM agent extracts the candidate's self-declared title verbatim from the preserved header window, and the extracted phrase is normalized to the canonical space by a sentence-embedding nearest-centroid model (SBERT `all-MiniLM-L6-v2` over 59 centroids, accepted above 0.55 cosine similarity; 92.6% held-out accuracy, replacing a char-n-gram matcher). Second, if no self-declared title exists, the full-CV-body classifier takes over. Third, when every remaining candidate falls below a calibrated confidence threshold (55), a final LLM call classifies the CV against the closed 59-title list — with a hallucination guard that rejects any answer not verbatim in the list. Every result is tagged with its source (`title_extraction`, `classifier`, `llm_fallback`) so the UI and our evaluation can treat the confidence scales separately. The tag reaches the user too: when the answer comes from the constrained LLM, the UI shows an "AI matched" badge instead of a percentage — a closed-list pick is not a similarity score, and displaying it as one would lend it a precision it does not have.

The classifier rung carries one further, late-project safeguard: an **agreement signal** born from the reverse-direction experiment of Chapter 3. When the classifier proposes a title, the DS server can cross-examine that proposal against a second, independently trained model that predicts the title from the CV's *extracted skills* rather than its raw text. If the two models agree, the served confidence is boosted; if they disagree, it is capped below the auto-accept threshold, so the user sees the manual role picker instead of a confidently wrong answer. The check is skipped whenever it provably cannot change the routing decision, and the whole mechanism sits behind an environment flag (`AGREEMENT_SIGNAL_ENABLED`) so it can be ablated cleanly — which Chapter 5 does.

**The LLM agents.** Five agents run in the Node backend against `gpt-4o-mini` (temperature 0.2, `gpt-4.1-mini` as automatic fallback): skill-pool extraction from postings (exactly 5 core-priority + 5 additional skills), per-skill scoring, improvement suggestions, title extraction, and closed-list title classification. Each agent's contract is JSON with a validation guard behind it. The scoring agent's contract, from the system prompt:

```
Output discipline - return ONLY valid JSON, no markdown, no explanation:
{
  "skills": [
    { "skill": "<skill name>", "score": <integer 0-10> }
  ]
}
Include every supplied skill exactly once, in the order given,
using the skill names verbatim.
```

The backend never trusts this output blind. Parsed scores are re-aligned to the expected skill list by name; a missing skill is filled by a deterministic keyword-overlap score; a response where every skill gets the identical score — a real gpt-4o-mini failure mode we observed — is discarded wholesale in favor of keyword scoring; and if the LLM is unreachable, the same keyword fallback serves the request, flagged as estimated. The global Match Score is the unweighted mean of the ten per-skill scores (the original specification said "weighted average"; Section 5.6 examines that gap).

**Personalization.** The Recommendation Balance screen offers stable/balanced/trending/custom strategies. The user's stable and trending weights collapse to a single preference scalar (trending ÷ (stable + trending)), and the five core skills are chosen from the model's candidate pool by minimizing the distance between each skill's own stability score and that preference — prevalence breaks near-ties but is never blended in, so a highly demanded skill cannot override the user's stated preference. The five dynamic slots are filled independently from the posting-derived pool, honoring the user's explicit focus-skill selections first. Preferences persist per user.

**Per-section CV improvement.** The improvement flow deliberately avoids whole-CV LLM rewrites — a lesson bought, not assumed (Chapter 3's data-contract episode). `prepare` splits the CV into stable, ordered sections and maps each weak skill to its best-matching section by Jaccard similarity of token sets; `suggest` asks the editor agent to rewrite one section for one skill at the user's self-declared proficiency (with an honesty rule: `no_knowledge` yields no fabricated experience); and `merge` composes the final CV deterministically by concatenating the current section texts in order — no LLM in the merge step at all. The design was forced by a concrete UX scenario rather than by architectural taste: two weak skills often map to the *same* section, and after the user accepts a rewrite for the first skill, the screen must present the *updated* section text when improving the second — never a stale copy that would silently discard the first improvement. Per-section identity and versioning is the structure that guarantees it: each section is saved independently, every suggestion applies to the latest version, two suggestions never race to overwrite the same document, and everything the user did not touch is preserved byte-for-byte.

**Saved-CV comparison.** When a user analyzes a CV, up to three starred CVs from their library are scored against the same job in parallel (a single `Promise.all` alongside the primary scoring call). If a starred CV beats the uploaded one, its analysis is persisted and surfaced as "a saved CV matches better"; otherwise the comparison stays invisible. A separate `compare-saved` endpoint lets the UI run the same comparison in the background without blocking the main result.

**The four steps as the user sees them.** Closing the implementation tour, Figures 8-11 show the running product at each step of the journey the diagrams above describe — all captured from the live system during verification sessions.

![Figure 8 — Step 1 in the product: the uploaded CV's role is detected automatically (here: Software Engineer, 92.52%), with a one-click manual override beneath it.](figures/figure-8-screen-upload-detect.png)
*Figure 8 — Step 1 in the product: the uploaded CV's role is detected automatically (here: Software Engineer, 92.52%), with a one-click manual override beneath it.*

![Figure 9 — Step 2 in the product: the Recommendation Balance screen with custom stable/trending/personal sliders, persistent preferences, and posting-derived focus skills.](figures/figure-9-screen-personalize.png)
*Figure 9 — Step 2 in the product: the Recommendation Balance screen with custom stable/trending/personal sliders, persistent preferences, and posting-derived focus skills.*

![Figure 10 — Step 3 in the product: the analysis dashboard with per-skill evidence-based scores, an expanded Skill Deep-Dive (strengths and missing elements), and the Gap Analysis table.](figures/figure-10-screen-analyze-gap.png)
*Figure 10 — Step 3 in the product: the analysis dashboard with per-skill evidence-based scores, an expanded Skill Deep-Dive (strengths and missing elements), and the Gap Analysis table.*

![Figure 11 — Step 4 in the product: per-section improvement, original beside the suggested rephrasing, with the user editing, regenerating, or saving each suggestion.](figures/figure-11-screen-improve.png)
*Figure 11 — Step 4 in the product: per-section improvement, original beside the suggested rephrasing, with the user editing, regenerating, or saving each suggestion.*

## 4.4 Evaluation Metrics

This section defines how we measure the system; all measured results appear in Chapter 5, drawn from a single audited metrics document. We report no numbers here.

**Evaluation corpus.** We built a purpose-made corpus of 32 authentic-style CV PDFs: 29 English benchmark files with ground-truth labels, two Hebrew files (full and mixed-language) expected to be rejected gracefully, and one scanned file with no text layer expected to produce a clear error — the latter three serve as negative fixtures and are excluded from accuracy counts. The 29 labeled files cover nine scenario types: clear-cut profiles, ambiguous/borderline (e.g., Fullstack vs. Frontend), career changers, hybrid profiles, junior/student CVs, niche roles in the taxonomy's cyber/hardware core, unsupported roles, visually noisy layouts (two-column, tables, icons), and bilingual fragments. Each file carries a manifest record with a `true_title` from the 59-canonical-title space or `none`, an `acceptable_titles` set for ambiguous and hybrid cases so Top-3 can be judged fairly, and a scenario tag; every label is validated automatically against the taxonomy. The files were deliberately rendered in visually diverse, not-ATS-friendly templates so the corpus stresses PDF extraction, not only classification.

**Model 2 metrics.** Every file runs through the full production pipeline — real PDF upload, text extraction, then the detection ladder — not through the model in isolation, because the user experiences the pipeline, not the classifier. We measure Top-1 and Top-3 accuracy overall and per scenario; guard behavior on the three negative fixtures; and confidence calibration *separately per rung*, because the two confidence scales are different distributions measured against the same UI threshold — cosine similarity on the extraction path versus renormalized softmax share on the classifier path. On top of calibration we run an auto-accept threshold sweep (what would each candidate threshold have cost in wrong auto-accepts versus correct detections demoted to the manual picker), an ON/OFF ablation of the agreement signal with the backend's decision rules replayed offline, and a determinism probe (the same CV uploaded repeatedly). We also recompute the training-coverage table directly from the source corpora — by replaying the repository's own mapping functions — rather than trusting any previously circulated count.

**Scoring-agent metrics.** The Match Score has no natural ground truth, so we split its evaluation into what can be measured without labels and what cannot. Without labels we measure: test-retest stability (the same CV × skill-list pair re-scored repeatedly through an endpoint that performs no skill re-selection, isolating scoring variance); band separation (each CV scored against a matched, an adjacent, and a mismatched real posting — within one CV, only the *order* of scores has to be right, which makes the check immune to disagreement about absolute values); and divergence from the deterministic keyword-overlap scorer the backend keeps as a fallback. A blind human-annotation protocol was designed and its 290-rating sheet built — but the team decided, late in the project, not to run the session. The consequence is stated rather than papered over: agreement with human judgement (MAE, Spearman ρ, ±2 share) is not available, and Chapter 5 claims only what the label-free metrics support — stability and distinctness from keyword counting, not correctness.

**Model 1 metrics.** Because the promotion gate measures volume only, model quality is assessed by precision@10 under a blind protocol: for every canonical role that carries real data, the current production model and the pre-retrain backup each contribute their top-10 skills; the lists are merged, deduplicated, and shuffled so a single annotator marks each skill relevant or irrelevant without knowing which model proposed it — or that two models exist. This yields both the model's first-ever quality figure and a measured before/after verdict on the retrain. Its structural limitation is examined alongside the results (Section 5.3): precision@10 measures relevance, while the retrain targeted informativeness, so the aggregate number is expected to move little even when the *kind* of error changes.

These are the instruments. The next chapter reports what they showed.

---

# 5. Results and Analysis

Every number in this chapter comes from one audited measurement campaign, run
against the final system after code freeze; the raw outputs and the harness
scripts are part of the repository. We measured three engines — the role-detection
pipeline (model 2 and its ladder), the market model (model 1), and the LLM scoring
agent — and we report what the instruments showed, including the two places where
they showed weakness.

## 5.1 Experimental Setup

The campaign earned its keep before producing a single table: its first end-to-end runs caught a live regression — the freshly wired agreement signal was invoking the skill extractor on every classifier call, pushing response times past the backend's timeout — which was fixed, re-verified, and only then measured. An evaluation harness, it turns out, is also an integration test.

**Corpus.** The evaluation corpus is the 32-file authentic-CV set of Section 4.4:
29 English CVs with ground-truth labels across nine scenario types, plus three
negative fixtures (two Hebrew CVs and one scanned image) that a well-behaved
system must reject rather than misclassify. All detection results below were
produced through the **full production path** — a real multipart PDF upload,
text extraction, then the detection ladder — never by calling a model directly,
because the user experiences the pipeline, not the classifier.

**Environment.** The DS server's ranking behavior is environment-driven, and the
measurement configuration is pinned and disclosed: a skill-ubiquity cap of 11, a
minimum-prevalence floor of 0.05, the agreement signal enabled, the retrained
model-1 artifact, and the backend's deployed thresholds (LLM fallback at 55,
frontend auto-accept at 60). Because the DS server exposes no configuration
endpoint, the configuration was verified *behaviorally*: a harness script
compares live server output against what each candidate configuration produces
offline from the model artifact, and the configurations disagree visibly (under
the defaults, `Software Engineer`'s top-five skills include `nice` and `git`;
under the measured configuration they do not). Any deployment that does not set
these variables will not reproduce these numbers — an operational fact we flag
rather than bury.

**Scoring-agent set.** For the Match Score, 8 authentic CVs were each paired with
three **real job postings** (17 distinct postings drawn from the 41,745-posting
corpus, each reviewed and approved by the annotator before use) in three
deliberate bands: *matched* (posting title equals the CV's role), *adjacent*
(neighbouring family, e.g. Backend × Data Engineer), and *mismatched* (unrelated,
e.g. Frontend × Cyber Security) — 24 pairs, 240 skill ratings. Three approved
postings carry a headline title that differs from their corpus label (two *Data
Scientist*-labeled postings are titled "Data Engineer", one *QA Automation* is
titled "QA Engineer (Manual)"); the labels were reviewed and kept, so the band
overlap reported in §5.2 is an upper bound on the confusion attributable to the
model.

## 5.2 Presentation of Results

### Role detection: the full pipeline

| Metric | Result |
|---|---|
| **Top-1 accuracy** | **26/29 (89.7%)** |
| **Top-3 accuracy** | **27/29 (93.1%)** |
| Pipeline errors | 0 |
| Negative fixtures correctly blocked | 3/3 |

Per scenario, Top-1 was perfect on ambiguous (4/4), career-changer (3/3), hybrid
(3/3) and niche-core (5/5) CVs; clear-cut profiles scored 8/9, junior CVs 2/3,
and unsupported-occupation CVs 1/2 — where "correct" for an unsupported CV means
the system declined to auto-accept any role.

The headline number, however, is a property of the *ladder*, not of any single
model — the decomposition by rung makes this concrete:

| Rung | n | Top-1 | Confidence scale |
|---|---|---|---|
| `title_extraction` (declared title → normalizer) | 26 | 92.3% | cosine similarity × 100 |
| `cv_classifier` (TF-IDF+MLP over the CV body) | 3 | 66.7% | renormalized softmax share |

**26 of the 29 CVs never reach the classifier.** Measured in isolation on this
corpus, the classifier path alone reaches 55.2% — consistent with its 62.3%
component-level accuracy on scrubbed held-out data (Chapter 3), and a world apart
from the 89.7% the user experiences. The system's accuracy *is* its architecture.

### Confidence calibration: one field, two incompatible scales

Both rungs emit a 0-100 confidence into the same field, judged against the same
frontend auto-accept threshold of 60 — but they are different distributions, so
we calibrated them separately (Figure 12).

On the extraction rung, the threshold sweep has a clean answer: raising
auto-accept from the deployed 60 to **80** costs zero correct detections and
removes the single wrong auto-accept in the corpus; above 80 the cost turns
steep (at 90, twelve correct detections are demoted to the manual picker).

| Auto-accept threshold | Auto-accepted | Wrong among them | Correct demoted to manual |
|---|---|---|---|
| 60 (deployed) | 27/29 | 2 | 0 |
| **80 (recommended)** | 26/29 | 1 | 0 |
| 90 | 14/29 | 1 | 12 |
| 95 | 8/29 | 0 | 17 |

![Figure 12 — Auto-accept threshold sweep on the 29-CV corpus: 80 removes a wrong auto-accept for free; beyond it, correct detections start paying the price.](figures/figure-12-threshold-sweep.png)
*Figure 12 — Auto-accept threshold sweep on the 29-CV corpus: 80 removes a wrong auto-accept for free; beyond it, correct detections start paying the price.*

On the classifier rung, calibration fails outright: measured across all 29 CVs,
**no threshold separates right from wrong**. Confidences attached to *incorrect*
predictions range from 37.1 to 99.99, and even a 95 cut-off retains 21
predictions of which 7 are wrong. The classifier's confidence is not evidence of
its correctness — which is precisely why the agreement signal exists.

### The agreement signal, ablated

With the backend's decision rules replayed offline over direct classifier calls
(agreement ON versus OFF): accuracy 17/29 versus 16/29, one CV helped, none
harmed. The single win is exactly the case the signal was built for — a
technical-writer CV (ground truth: no supported role) that the bare classifier
auto-accepted as *Product Manager* at confidence 75.8 was, with the signal on,
capped to 50 and routed to the manual picker. We disclose the counter-effect the
headline hides: on two CVs the `agree` branch lifted a wrong answer's confidence
past the auto-accept bar, converting "escalate to the LLM rung" into "auto-accept
the wrong title"; whether the LLM rung would have corrected them is unmeasured.

### Training coverage — and what absorbs it

Recomputed from the source corpora by replaying the repository's own mapping
functions (three conflicting counts circulated in older documents): **33 of the
59 canonical titles (56%) have zero real-CV training data** — the entire
security-research, hardware/VLSI and specialised-research space. The distribution
is binary: a title either has ≥100 real CVs or exactly none. The measured
consequence behaves exactly as predicted: on the classifier path, the FPGA and
malware-research fixtures are both misclassified as `C++ Developer`; through the
full ladder the same five niche-core CVs score **5/5**, because the declared-title
rung normalizes against all 59 titles regardless of classifier training data. The
coverage gap is real; the architecture, not the model, is what covers it.

### Determinism

The same CV uploaded five times returned identical titles and confidences on
every run, at both the sklearn layer and the full ladder (established on two CVs,
not proven in general). The scoring agent's non-determinism is measured
separately below.

### Model 1: first-ever quality figure

Under the blind merged-and-shuffled protocol of Section 4.4 (12 data-carrying
roles × top-10, 191 skills marked, 100% coverage):

| | precision@10 |
|---|---|
| **Live model** (retrained) | **97%** |
| Pre-retrain backup | 96% |

Only 8 of 191 skills were rejected, and they split cleanly by model — the
pre-retrain model's rejects are **cross-role contamination** (`backend` under
Frontend Developer and under Data Engineer, `python` under Java Developer,
`cybersecurity` under Product Manager: precisely the audit finding that
motivated the retrain), while the live model's rejects are vague-but-adjacent
(`computer science`, `tracking`, `writing`). The contamination class of error is
measurably absent from the live model.

### The scoring agent: stable, distinct — and weakly discriminative

Test-retest stability is excellent: re-scoring identical (CV, skill-list) pairs
through an endpoint that performs no skill re-selection, the mean per-skill
standard deviation is **0.11 points** (max 0.36) — at temperature 0.2 the score
moves by roughly a tenth of a point between runs.

Band separation is a different story (Figure 13):

| Band | Mean Match Score |
|---|---|
| matched | **4.50 / 10** |
| adjacent | **4.50 / 10** |
| mismatched | **3.84 / 10** |

Within-CV ordering (matched above mismatched) held for 6 of 8 CVs, with one tie
and one inversion; the mean margin is **0.66 points** on a 10-point scale.
Adjacent postings are indistinguishable from matched ones, and the single highest
score in the whole set (7.0) went to a Data Engineer CV against a *Data
Scientist* posting — above every correctly matched pair.

![Figure 13 — Band separation: matched, adjacent and mismatched postings receive nearly the same mean score; a 0.66-point margin separates matched from mismatched.](figures/figure-13-band-separation.png)
*Figure 13 — Band separation: matched, adjacent and mismatched postings receive nearly the same mean score; a 0.66-point margin separates matched from mismatched.*

Against the deterministic keyword-overlap fallback on the identical 240 ratings,
the LLM agrees within 2 points on only **119 of 240 (49.6%)** — it scores
markedly lower on average (4.28 vs 5.73) and assigns low scores to skills that
appear as bare keywords, exactly as its evidence-only prompt instructs. The agent
is clearly doing something other than keyword counting; whether that something is
*closer to human judgement* was deliberately left unmeasured (§5.5).

## 5.3 Data Analysis and Interpretation

Read together, the tables above reduce to three findings.

**The product's accuracy lives in the architecture, not in any model.** The
component-level classifier numbers (55-62%) and the system-level 89.7% are both
true; the gap between them is the declared-title rung resolving 26 of 29 CVs
before the classifier is ever consulted, and the same effect absorbs the 56%
training-coverage gap for niche roles. This validates the central design decision
of Chapter 3 — role detection as a ladder of mechanisms with disjoint failure
modes — more strongly than any single-model metric could.

**A confidence field is only as meaningful as its worst producer.** One UI
threshold judges two incompatible distributions. On the extraction rung the
signal is well-behaved and the sweep yields a free improvement (60 → 80, adopted
as a recommendation, not applied during the measurement freeze); on
the classifier rung no threshold works at all, and correctness has to come from
elsewhere. This is the measured justification for the final design's
second-opinion mechanism: where a confidence number cannot be trusted, the
agreement of two independently trained models can. The ablation
shows the mechanism working as designed, at small measurable benefit and with a
disclosed, unmeasured risk on two CVs.

**An aggregate metric can hide the finding.** Model 1's +0.8pp looks like noise
until the errors are read qualitatively: the retrain traded wrong-family errors
for vague-but-adjacent ones — a change in *kind* that precision@10 is
structurally almost blind to, since the annotation protocol counts a generic but
genuine skill as relevant. The instrument measures relevance; the retrain
targeted informativeness; the flat aggregate is therefore expected, and the
per-error analysis, not the average, carries the result.

The scoring agent's weak band separation is analyzed in §5.5, because its cause
turned out to be structural rather than statistical.

## 5.4 Comparison with Existing Approaches

Against the landscape of Chapter 2, CareerLens sits in a deliberate middle.
Keyword-matching ATS tooling [1][2] produces exactly the behavior our keyword
baseline reproduces — bare-mention counting, inflated by boilerplate — and the
measured 50% disagreement between that baseline and our evidence-based agent is
the quantitative version of the product's thesis: reading evidence is genuinely
different from counting words. Compared with end-to-end learned matchers such as
conSultantBERT [10], our detection stack is unapologetically shallower: a TF-IDF+MLP
component where linear-adjacent models suffice [7], sentence embeddings where
semantics are required [8][9], and LLM judgment only at the two points where
neither statistics nor embeddings can decide (reading a declared title out of
messy text; assessing evidence for a skill). The system-level result — 89.7%
through the ladder versus 55-62% for the strongest single component — supports
composing cheap components over training one heavy one, at least at our data
scale, where fine-tuning a transformer end-to-end was never on the table for
lack of labeled CVs (56% of our own taxonomy has no real training data at all).

## 5.5 Discussion of Findings

**What the Match Score actually measures.** Tracing the scoring path end-to-end
produced the campaign's most consequential finding: the scoring agent receives
**only the CV text and the ten skill names** — the job description never enters
the scoring prompt. The posting decides *which* skills are scored, upstream; it
plays no part in *how* they are scored. The weak band separation of Figure 13 is
therefore structural, not a prompt-wording defect: the scorer cannot distinguish
a matched posting from a mismatched one because it never sees the posting. On
this evidence, the Match Score behaves more like a *CV-quality score over
job-relevant skills* than a CV-to-job fit score — a mischaracterization in our
own UI copy, and we say so here. The 0.11-point test-retest σ shows the
weakness is not sampling noise (the band margin is six times the run-to-run
variance), and the fix — passing posting context into the scoring prompt, then
re-measuring band separation — is concrete, bounded future work.

**What was deliberately not measured.** Agreement between the scoring agent and
human judgement (MAE, Spearman ρ, ±2 share) was not measured: the blind
annotation sheet was built and verified, and the team decided not to run the
session within the submission timeline. The consequence is stated rather than
papered over — nothing in this book claims the agent's scores are *correct*,
only that they are stable (σ = 0.11), weakly job-discriminative (0.66-point
margin), and materially different from keyword counting (50% disagreement). The
one comparison that would justify or refute the agent architecture outright —
LLM versus keyword baseline against a human reference — remains open, and we
would rather report an open question than a manufactured answer.

**Limitations.** Seven bounds apply to every number above. (1) Ground truth for
model 1's relevance was labeled by a single annotator — mitigated by blind,
shuffled presentation, but inter-annotator agreement cannot be computed. (1a) The
scoring agent has no human reference at all, per the decision above. (2) 33 of 59
titles have no real-CV training data, so classifier performance on them is
unmeasurable directly — and poor where measured indirectly. (3) The evaluation
set is small: 29 scored CVs, with per-scenario cells of 2-9 — those percentages
are indicative, not precise. (4) The fixtures are authored and independently
reviewed, not harvested from real applicants. (5) The scoring agent is
non-deterministic by construction; its variance is reported, not hidden. (6) The
job-posting corpus is Ukrainian (Djinni, 2019-2023) with heuristically assigned
labels — not the Israeli market, and not current; sampled postings were
hand-checked before use. (7) Every number is conditional on the disclosed serving
configuration (§5.1); a deployment on the DS server's defaults will not reproduce
them.

---

## 5.6 Planned vs. Built

The original project specification was written before a single line of code existed.
This section reads the finished system against that document, row by row — not to
grade the specification, but because the *pattern* of its misses is itself a finding:
nearly every deviation traces to one of two root causes — underestimating how much
intelligence the "simple" steps would need, or assuming external services would
cooperate. Every row below was re-verified against the code before writing; where the
specification's promise survives unchanged, we say so.

The clearest single view of the gap is visual — the architecture we drew before
writing code, next to the one the code now implements:

![Figure 14 — CareerLens as designed: the original specification's architecture, with a single "Python AI service" behind the backend.](figures/figure-14-as-designed-spec.png)
*Figure 14 — CareerLens as designed: the original specification's architecture, with a single "Python AI service" behind the backend.*

![Figure 2 — CareerLens as built (repeated from Section 4.1 for side-by-side reading).](figures/figure-2-system-overview.png)
*Figure 2 — CareerLens as built (repeated from Section 4.1 for side-by-side reading).*

| # | Planned (specification) | Built | What the specification missed |
|---|---|---|---|
| 1 | A single "Python AI service" behind the backend | Three services: a FastAPI DS server hosting two trained models, plus five LLM agents living *inside* the Node backend | That the project would need two different kinds of intelligence — cheap, retrainable statistical models and per-request LLM judgment — with different scaling, latency, and deployment properties. One box could not hold both |
| 2 | Selenium scraping of Glassdoor/AllJobs to build the dataset | LinkedIn scraping with skill extraction persisted at ingest, augmented by an external 142K-posting corpus, feeding a nightly train-and-promote pipeline | Rate limiting and bot defenses on the named job boards; and more fundamentally, that a *one-time* dataset was the wrong goal — trend features require a pipeline that accumulates history, not a scrape |
| 3 | The user selects their target role from a list | A three-stage automatic detection ladder (semantic title normalization → CV-body classifier → closed-list LLM fallback), with manual search only as a fallback | That "which of 59 roles is this CV?" is itself a hard ML problem — and the more interesting one. The dropdown quietly assumed users know their canonical role label; ambiguous and hybrid careers show they often do not |
| 4 | 10 target skills: 5 "Core" = technical/hard, 5 "Dynamic" = soft/adaptive | 5 Core = what the *market* demands for this role (from model 1); 5 Dynamic = what *this posting* additionally demands (extracted from the job description) | The hard/soft split is not operational — our own extractor's vocabulary makes the point numerically: of SkillNer's 31,278 entries, only 336 are tagged as soft skills — and the split users actually need is market-baseline vs. this-job-specific |
| 5 | A "weighted average" Global Match Score | An **unweighted** mean of the ten per-skill scores — verified as such in the submitted code, and stated as such in Section 4.3 | Nothing forced a weighting scheme, and every candidate scheme (core-heavier? specificity-weighted?) embeds a product opinion the specification never stated. We kept the honest mean and report the word "weighted" as unimplemented rather than quietly inventing weights |
| 6 | A Gap Analysis comparison table and a per-skill "Skill Deep Dive" screen with Strengths / Missing Elements / Agent Feedback | **Built.** The scoring agent's contract was extended to return per-skill `evidence` and `missing` fields alongside the score; the dashboard renders a per-skill Deep-Dive panel (what the CV shows / what is absent) and a gap-analysis table, and a weak skill can be carried directly into the improvement flow | That per-skill *explanation* requires the scoring agent to return evidence, not just numbers — a contract decision that ripples from the LLM prompt through the database schema to the UI, which is why it was the last major feature to land |
| 7 | Export: "download the improved content"; the mockup shows side-by-side panels and a PDF button | Plain-text export of the merged improved CV; a late fix preserves the CV's original text verbatim through the improve-and-export flow, so untouched sections survive byte-for-byte | That *what* you export matters more than the button: an ATS-oriented product must export text that survives re-parsing, which constrains the whole normalization pipeline upstream. PDF rendering remains future work |
| 8 | Job input by pasted text **or URL** | Both work. URL fetching is implemented server-side (structured-data extraction), not with Selenium; it succeeds on standard job-posting markup and fails gracefully to "paste the text" elsewhere | Little — this promise was kept. The specification only misjudged the *mechanism*: browser automation was never needed for pages that publish structured data, and never sufficient for boards that block automation |
| 9 | A six-endpoint REST API (`/cv/upload`, `/analysis/score`, `/history`, …) | A larger API grown around the real flows (upload, title detection, personalization, analysis, improvement sessions, saved-CV comparison, admin); several specification endpoints exist under different names, and a user-facing analysis history exists only partially | That the API is a consequence of the user flows, not a deliverable. Appendix A maps every specification endpoint to its implemented counterpart or its fate |
| 10 | A 9-week plan for 4 people, through "Model Evaluation" in week 6 | Roughly 25 weeks of calendar time, with scope that grew mid-project (automatic role detection, personalization strategies, per-section CV improvement, saved-CV comparison, the daily pipeline — none of which appear in the specification) | The estimate assumed the specified scope was the final scope. The features users and supervisors asked for once a working system existed — and the research detours of Chapter 3 — were the majority of the project, and none were plannable in week zero |

Reading the table as a whole, three patterns stand out. First, the deviations cluster where the
specification touched *intelligence*: every step it labeled as a lookup or a dropdown
(role selection, skill categorization, scoring) turned out to hide a modeling problem,
and Chapter 3 is largely the record of discovering those. Second, the deviations that
cost the most calendar time — the detection ladder and the pipeline — are also the
parts we now consider the system's main contribution beyond the specification.
Third, one promise the specification made casually — "weighted average" — we
declined to implement rather than invent an unjustified weighting, and we flag it
here rather than let the word stand unexamined; not implementing seemed more
defensible than decorative complexity.

---

# 6. Conclusion and Future Work

What stands at the end of seven months is a working system a job seeker can use
today: upload a CV, watch the system identify the role by itself, choose what
"important skills" should mean, receive ten evidence-graded scores with the
reasoning behind each gap, and rewrite the CV one section at a time without
losing a word that was already good. Behind that four-step surface run three
trained models, five guarded LLM agents, and a pipeline that reteaches the
market model every night and refuses its own output when it regresses.

CareerLens set out to hand job seekers the analytical lens that employers already
point at them: given a real CV and a real job posting, produce an evidence-based,
per-skill assessment and an actionable path to improvement. Judged against the
original specification's objectives, the system delivers them — CV parsing of
messy real-world PDFs, ten market- and posting-derived target skills, per-skill
0–10 scoring with evidence, a global Match Score, gap analysis with a per-skill
deep dive, guided section-by-section improvement, and export — and it grew four
capabilities the specification never imagined: automatic role detection,
personalization strategies, saved-CV comparison, and a nightly
scrape-train-promote pipeline that keeps the market model current without human
attention.

The measured headline is architectural, and it is the project's central lesson.
No single model we built survived contact with real CVs; the shipped system's
89.7% role-detection accuracy belongs to a *ladder* of three modest mechanisms
with disjoint failure modes, and the same ladder is what absorbs the fact that
56% of our taxonomy has no real training CVs at all. We spent much of the project
discovering that intelligence in this domain is a systems property — and the
book's research chapter records what each failed single-mechanism attempt taught
us. The second lesson is about honesty as an engineering practice: a near-perfect
score revealed label leakage; a documented feature turned out to be unread by the
serving code; a signal was wired to an endpoint the product never called. In
every case, measuring the real path — not the documented one — is what moved the
project forward.

The system's open weaknesses belong in this chapter as much as its achievements. The Match Score
is stable and genuinely evidence-based, but it scores the CV against the skill
list without ever seeing the posting, and the measured consequence is weak
fit-discrimination; its agreement with human judgement remains unmeasured by our
own decision. These bounds define the future-work list, in priority order:

1. **Pass posting context into the scoring prompt**, then re-measure band
   separation — the one bounded change our measurements most directly motivate.
2. **Run the prepared human-agreement session** (the blind 290-rating sheet
   exists), settling whether the LLM scorer beats its keyword baseline against a
   human reference.
3. **Raise the auto-accept threshold from 60 to 80** on the extraction rung — a
   measured free improvement on our corpus (Chapter 5).
4. **Acquire real CVs for the 33 uncovered titles**, converting the coverage gap
   from architecturally-mitigated to actually-closed, and enabling a classifier
   retrain over the full 59-role space.
5. **Give the promotion gate a quality bar** — precision@10 is now measured and
   repeatable, and belongs inside the gate rather than beside it.
6. **Honor or retire the specification's "weighted average"** with a justified
   weighting scheme, and extend export to rendered PDF alongside plain text.
7. **Multi-language support**, beginning with Hebrew CVs — today rejected
   gracefully by design, tomorrow a market requirement.

The specification we started from imagined a simpler system than the one the
problem required. The gap between the two — measured, explained, and in places
deliberately left open — is what this project taught us, and we consider the
honest record of that gap as much a deliverable as the system itself.

---

# 7. References

[1] J. B. Fuller, M. Raman, E. Sage-Gavin, and K. Hines, *Hidden Workers: Untapped Talent*, white paper, Harvard Business School Project on Managing the Future of Work and Accenture, Sep. 2021. [Online]. Available: https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx

[2] M. Raghavan, S. Barocas, J. Kleinberg, and K. Levy, "Mitigating bias in algorithmic hiring: Evaluating claims and practices," in *Proc. 2020 Conf. Fairness, Accountability, and Transparency (FAT\* '20)*, Barcelona, Spain, 2020, pp. 469–481, doi: 10.1145/3351095.3372828.

[3] B. Gaur, G. S. Saluja, H. B. Sivakumar, and S. Singh, "Semi-supervised deep learning based named entity recognition model to parse education section of resumes," *Neural Comput. Appl.*, vol. 33, pp. 5705–5718, 2021, doi: 10.1007/s00521-020-05351-2.

[4] M. Zhang, K. Jensen, S. Sonniks, and B. Plank, "SkillSpan: Hard and soft skill extraction from English job postings," in *Proc. 2022 Conf. North Amer. Chapter Assoc. Comput. Linguistics: Human Lang. Technol. (NAACL-HLT)*, Seattle, WA, USA, 2022, pp. 4962–4984, doi: 10.18653/v1/2022.naacl-main.366.

[5] A. Ait Aomar, *SkillNER*, open-source software, ver. 1.0.3, MIT License, 2021. [Online]. Available: https://github.com/AnasAito/SkillNER

[6] K. Sparck Jones, "A statistical interpretation of term specificity and its application in retrieval," *J. Documentation*, vol. 28, no. 1, pp. 11–21, 1972, doi: 10.1108/eb026526.

[7] A. Joulin, E. Grave, P. Bojanowski, and T. Mikolov, "Bag of tricks for efficient text classification," in *Proc. 15th Conf. Eur. Chapter Assoc. Comput. Linguistics (EACL), Vol. 2, Short Papers*, Valencia, Spain, 2017, pp. 427–431.

[8] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence embeddings using Siamese BERT-networks," in *Proc. 2019 Conf. Empirical Methods Natural Lang. Process. and 9th Int. Joint Conf. Natural Lang. Process. (EMNLP-IJCNLP)*, Hong Kong, China, 2019, pp. 3982–3992, doi: 10.18653/v1/D19-1410.

[9] J. Snell, K. Swersky, and R. S. Zemel, "Prototypical networks for few-shot learning," in *Adv. Neural Inf. Process. Syst. 30 (NIPS 2017)*, Long Beach, CA, USA, 2017, pp. 4077–4087.

[10] D. Lavi, V. Medentsiy, and D. Graus, "conSultantBERT: Fine-tuned Siamese Sentence-BERT for matching jobs and job seekers," in *Proc. Workshop Recommender Syst. for Human Resources (RecSys in HR 2021)*, Amsterdam, Netherlands, 2021. arXiv:2109.06501.

[11] L. Zheng *et al.*, "Judging LLM-as-a-judge with MT-Bench and Chatbot Arena," in *Adv. Neural Inf. Process. Syst. 36 (NeurIPS 2023), Datasets and Benchmarks Track*, New Orleans, LA, USA, 2023. arXiv:2306.05685.

[12] P. Wang *et al.*, "Large language models are not fair evaluators," in *Proc. 62nd Annu. Meeting Assoc. Comput. Linguistics (ACL), Vol. 1: Long Papers*, Bangkok, Thailand, 2024, pp. 9440–9450, doi: 10.18653/v1/2024.acl-long.511.

[13] E. Senger, M. Zhang, R. van der Goot, and B. Plank, "Deep learning-based computational job market analysis: A survey on skill extraction and classification from job postings," in *Proc. 1st Workshop Natural Lang. Process. for Human Resources (NLP4HR 2024)*, St. Julian's, Malta, 2024, pp. 1–15, doi: 10.18653/v1/2024.nlp4hr-1.1.

[14] R. Geirhos, J.-H. Jacobsen, C. Michaelis, R. Zemel, W. Brendel, M. Bethge, and F. A. Wichmann, "Shortcut learning in deep neural networks," *Nature Mach. Intell.*, vol. 2, pp. 665–673, 2020, doi: 10.1038/s42256-020-00257-z.

[15] S. Kapoor and A. Narayanan, "Leakage and the reproducibility crisis in machine-learning-based science," *Patterns*, vol. 4, no. 9, Art. no. 100804, 2023, doi: 10.1016/j.patter.2023.100804.

<!-- [16+] reserved for sources added at closure (M09 wave 4). No source may be added without fetch-verification. -->

---

# Appendix A

## A.1 Running the System

CareerLens runs as a docker-compose stack of five long-lived containers
(MongoDB, backend, DS server, scraper, frontend) plus the nightly pipeline
container and its cron sidecar. To bring it up from a fresh clone:

1. **Prerequisites:** Docker with docker-compose, Git, and **Git LFS** — the
   trained model artifacts (`.joblib`) are stored with LFS, and a clone without
   it yields pointer files instead of models (the repository's install script
   checks for this and fails with a clear message).
2. **Clone and configure:** `git clone github.com/yaringol/CareerLens`, then
   create the environment files from their tracked `.env.example` templates. The
   backend requires an `OPENAI_API_KEY`; the DS server's ranking configuration
   should be set to the evaluated values (`SKILL_UBIQUITY_CAP=11`,
   `ROLE_COUNT_MIN_PREVALENCE=0.05`, `AGREEMENT_SIGNAL_ENABLED=1`) — Chapter 5
   documents why a deployment on the defaults produces materially different
   rankings.
3. **Start:** `docker-compose up`. The frontend serves the SPA; the backend
   listens under `/api`; the DS server is reachable only from the backend's
   network. Full service-by-service instructions, including running each service
   outside Docker for development, are in the repository README.

## A.2 Specification API → Implemented API

The original specification defined six endpoints. Every one has an implemented
counterpart — under different names, and surrounded by the larger surface the
real user flows required (Section 5.6, row 9).

| Specification | Implemented as | Notes |
|---|---|---|
| `POST /cv/upload` | `POST /api/upload` | Multipart PDF upload; parsing, normalization and the preserved header window happen here |
| `POST /jobs/extract` | `POST /api/jobs/extract` + `POST /api/jobs/fetch-description` | Kept almost verbatim; URL fetching is a separate endpoint using structured-data extraction rather than Selenium |
| `POST /analysis/score` | `POST /api/analyze` (also `/api/analyze/personalized`, `/api/analyze/rescore`) | The personalized variant applies the user's Recommendation Balance; rescore re-scores a fixed skill list |
| `GET /analysis/results/:id` | `GET /api/results/:id` | The match breakdown, core vs. dynamic, per-skill evidence and gaps |
| `GET /cv/optimized` | `POST /api/cv-improve/merge` + `GET /api/cv-improve/sessions/:id` | Improvement became a stateful per-section flow (prepare → suggest → merge) rather than a single GET |
| `GET /history` | `GET /api/cv` (saved-CV library), `GET /api/cv-improve/sessions` | **Partial:** libraries and improvement sessions persist per user, but a unified past-analyses history screen was not built |

Endpoints with no specification ancestor — the grown surface: authentication
(`/api/auth/register`, `/login`, `/password`), role detection (`/api/cv/title`,
`/api/cv/extract-title`, `/api/title/match`), personalization
(`/api/personalize/options`, `/preference`), saved-CV management
(`GET/PATCH/DELETE /api/cv/:id`), background comparison
(`/api/analyze/compare-saved`), and the admin model-status dashboard
(`/api/admin/...`).

## A.3 Evaluation Corpus Manifest (excerpt)

The 32-file evaluation corpus (Section 5.1) is driven by a manifest that binds
every PDF to its ground truth; labels are validated automatically against the
59-title taxonomy. Two representative records:

```json
{
  "file": "backend-senior-strong_Daniel-Peretz.pdf",
  "true_title": "Backend Developer",
  "acceptable_titles": ["Backend Developer"],
  "scenario": "clear-cut",
  "seniority": "senior",
  "strength": "strong",
  "is_negative_fixture": false,
  "notes": "Python/Django/K8s, metrics-rich"
}
{
  "file": "datasci-ml-mid-ambiguous_Yael-Rosen.pdf",
  "true_title": "Data Scientist",
  "acceptable_titles": ["Data Scientist", "Machine Learning Engineer"],
  "scenario": "ambiguous",
  "seniority": "mid",
  "strength": "mid",
  "is_negative_fixture": false,
  "notes": "Title line 'Data Scientist / ML Engineer'"
}
```

The `acceptable_titles` set is what lets Top-3 accuracy be judged fairly on
ambiguous and hybrid careers; `scenario` drives the per-scenario breakdown of
Section 5.2; and the three `is_negative_fixture` records define the guard
behavior the pipeline must show rather than an accuracy denominator.
