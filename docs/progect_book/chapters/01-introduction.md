# Chapter 1

## 1. Introduction

### 1.1. Background

Modern hiring begins with a machine reading text. Before a recruiter opens a CV, an Applicant Tracking System has usually already parsed it, matched it against the job description, and decided whether a human should ever see it. The overwhelming majority of employers rely on such systems to filter or rank incoming candidates, and the consequences are documented: 88% of employers themselves admit that qualified, high-skills candidates are vetted out of the process because they do not match the exact criteria established by the job description [1]. The rejection, in other words, is frequently about phrasing rather than ability.

What struck us about this situation is its asymmetry. Employers operate sophisticated NLP-powered screening pipelines; candidates operate a text editor. A job seeker cannot see which skills the screening software weighs, how their wording lands, or why nothing comes back after they submit. CareerLens is our attempt to correct that asymmetry: a web application that hands the candidate the same analytical lens the employer already points at them — showing, skill by skill, how a specific CV reads against a specific job posting, and how to close the gap before pressing "submit".

### 1.2. Problem Statement

The problem we set out to solve can be stated compactly: given a CV as a PDF and a job description as pasted text or a URL, produce an evidence-based, per-skill assessment of the match and an actionable path to improving it — without requiring the candidate to know which of the 59 technology roles we support they "count as", and without asking them to trust a single opaque score.

Stated that way, the problem decomposes into sub-problems that each proved substantial. Real-world PDFs must be converted to text reliably despite wildly inconsistent layouts. The candidate's role must be identified from unstructured prose, because job seekers do not label themselves with canonical titles. The system must decide which skills matter for the target position — in our design, 10 of them, split into 5 market-core skills and 5 posting-specific ones. Each skill must then be scored against actual evidence in the CV rather than mere keyword presence. Finally, the CV must be rewritten to strengthen weak areas without fabricating experience or destroying the document's voice. Each of these sub-problems shaped a component of the final system, and several of them resisted our first solutions, as Chapter 3 recounts.

### 1.3. Objectives

Our objectives fall into two groups, and the distinction is worth preserving: what we committed to in the original project specification, and what the system grew to include once real usage exposed assumptions the specification had not questioned.

From the specification, we committed to: parsing real CVs uploaded as PDF; extracting the top 10 target skills for a position, 5 core and 5 dynamic; scoring each skill on a 1–10 scale using an LLM agent; computing a global Match Score; providing gap analysis with concrete phrasing suggestions; and exporting an improved version of the CV.

During development the scope grew. We added automatic role detection — replacing the manual role selection we had originally planned — after realizing that asking candidates to classify themselves into a canonical title was itself part of the problem we claimed to solve. We added personalization, letting users steer skill selection through stable, balanced, or trending strategies depending on whether they want the analysis anchored to established market skills or emerging ones. We added comparison across a user's saved CVs. Most consequentially, we added a daily pipeline that scrapes fresh job-market data, retrains the underlying model, and promotes the new version only if it passes a coverage gate — turning a one-off trained artifact into a system that tracks the market it describes.

The system that emerged from both lists is best stated in one breath, because the rest of this book unpacks it: a React application over a Node API that orchestrates five JSON-guarded LLM agents and a Python model server, where role detection is a three-rung ladder with a second-opinion agreement signal, skill targets come half from a nightly-retrained market model and half from the posting at hand, every score is evidence-based on a 0–10 scale, and improvement happens section by section with the user in control.

### 1.4. Scope and Limitations

Several boundaries of this work matter for interpreting our results, so we state them up front.

CareerLens is English-only by design. All parsing, skill extraction, scoring, and model training operate on English text; CVs and postings in other languages are out of scope.

The system supports 59 technology roles, but not all of them rest on equal data. For 33 of the 59 — chiefly the cyber, hardware, and research specialties — the training data consisted of synthetically generated title strings without real CV bodies behind them. We disclose this because it has a direct evaluation consequence: for those roles, the role-detection model has never seen an authentic CV of that profession, and its behavior there is correspondingly less trustworthy. Chapter 5 treats these roles separately rather than letting them blend into aggregate results.

Privacy has real boundaries too. An uploaded CV is stored in MongoDB, associated with the authenticated user who uploaded it, and its text is sent to the OpenAI API for skill scoring. It is not distributed anywhere else, and a deletion endpoint lets users remove their data — but users should understand that a third-party API does see their CV text.

LLM-based scoring is not deterministic: the same CV analyzed twice against the same job can receive slightly different scores. We measured this test-retest variability and report its standard deviation in Chapter 5, rather than presenting the scores as exact.

Finally, fetching a job posting by URL works for sites that expose structured metadata (JSON-LD or Open Graph tags), but not for job boards that require a login; for those, users must paste the posting text manually.

### 1.5. Methodology

We worked iteratively, in a loop we came to think of as build–measure–fix. We began with a proof of concept covering a handful of roles, measured its behavior on real documents, and expanded to the full 59-role system. Then came the step we consider the most valuable of the project: an adversarial self-audit that went looking for the ways we might be fooling ourselves. Eight independent review agents swept the code and raised 74 findings; each finding was then attacked by a dedicated refuter, and the 52 that survived set the agenda for the project's final phase. Among them: a data-leakage problem whose correction lowered our headline numbers while raising our confidence in them, and three features that existed in the code but were dead in practice. The corrections they forced are documented in Chapter 3.

Architecturally, the methodology combines two models with different learning paradigms — one built by statistical aggregation of market data, the other by supervised classification — with LLM agents reserved for the places where semantic judgment is genuinely required. A nightly pipeline retrains on freshly scraped postings, and its promotion gate refuses to deploy any model that regresses against the incumbent. For evaluation we built a purpose-made corpus of 32 labeled, authentic-style CVs, spanning scenario types from straightforward matches to deliberately difficult and out-of-domain cases; Chapter 5 reports our results against it.

Three findings organize this book's contribution, and the chapters that follow build toward them. First, role detection succeeds as a multi-stage decision ladder, not as any single classifier — the system outperforms every one of its components. Second, measuring the real execution path, rather than the intended one, is what separated working code from a working system, and it is the discipline behind every reliable number we report. Third, the evaluation exposed a structural boundary of the scoring engine — selecting skills by posting is not the same as scoring against it — which defines the clearest next step for this work.

### 1.6. Organization of the Project Book

The remainder of this book is organized as follows. Chapter 2 reviews the literature relevant to each component of the system, from ATS screening and its documented failure modes through skill extraction and text classification to the reliability limits of LLM-based scoring. Chapter 3 presents our research journey — the experiments, false starts, and corrections through which the two models took their final shape. Chapter 4 details the system's design and implementation: the architecture, data collection and preprocessing, and the implementation of the models, agents, and daily pipeline. Chapter 5 presents the results and their analysis, including Section 5.6, where we systematically compare what was planned against what was built and account for every difference. Chapter 6 concludes the project and outlines future work. The References list all sources cited throughout the book, and Appendix A provides setup instructions and supplementary technical material.
