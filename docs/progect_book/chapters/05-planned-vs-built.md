# 5.6 Planned vs. Built

The original project specification was written before a single line of code existed.
This section reads the finished system against that document, row by row — not to
grade the specification, but because the *pattern* of its misses is itself a finding:
nearly every deviation traces to one of two root causes — underestimating how much
intelligence the "simple" steps would need, or assuming external services would
cooperate. Every row below was re-verified against the code before writing; where the
specification's promise survives unchanged, we say so.

The clearest single view of the gap is visual — the architecture we drew before
writing code, next to the one the code now implements:

![Figure 14 — CareerLens as designed: the original specification's architecture, with a single "Python AI service" behind the backend.](../figures/figure-14-as-designed-spec.png)
*Figure 14 — CareerLens as designed: the original specification's architecture, with a single "Python AI service" behind the backend.*

![Figure 2 — CareerLens as built (repeated from Section 4.1 for side-by-side reading).](../figures/figure-2-system-overview.png)
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
