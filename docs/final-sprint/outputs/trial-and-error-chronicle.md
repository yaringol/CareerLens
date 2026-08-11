# CareerLens — Trial-and-Error Chronicle

> The evidence-backed record of what we tried, what failed, and what each failure
> changed. Sources: git history (153 commits, all branches), the public GitHub
> milestones/issues skeleton (5 milestones, 63 issues, 39 PRs), working-session
> records, and a structured team interview (2026-07-22, 25 anchored questions).
> Feeds the project book's Research chapter (Ch. 3). Every episode is tagged
> **(code)** — verifiable in the repository, **(board)** — from GitHub issues/milestones,
> or **(team)** — from the interview.
>
> Editorial rules set by the team: process/git-hygiene anecdotes are out of scope;
> deployment work is reported factually, without drama; collective attribution only.

## Timeline at a glance

| Period | What happened |
|---|---|
| Jan | Repo + first frontend concept; first scraper = a single company's careers page |
| Feb | **The pivot**: original 9-week plan re-scoped to a mandatory 5-role POC |
| Apr | Model-zero lives 3 days; the aggregation model replaces it; UI redesigned for clarity |
| May-Jun | Auth, improve screen, 59-role expansion, scoring recalibration |
| Late Jun | Docker migration; regex title detection tried and retired; classifier path built |
| Jul | Detection ladder rewrite, promotion-gate pipeline, QA pass, final-sprint audit |

---

## 1. The February pivot: from 9-week plan to mandatory POC **(board)**

The original specification's work plan mirrored into 22 January issues. One day after
milestone 2's deadline passed, a new milestone appeared — "POC Scope (Mandatory
Requirements)" — whose own description concedes the re-scope: exactly 5 predefined
jobs, 5 core skills. The 9-week plan was never formally closed; the POC scope simply
replaced it. **Lesson:** the estimate assumed the specified scope was final; a working
subset first was the correct call, and everything after (59 roles, personalization,
the pipeline) grew from a POC that judges could already touch.

## 2. Model-zero: three days, one spot check, a lasting blacklist **(code + team)**

The first model (Apr 9) was TF-IDF + 10-nearest-neighbours over 8,486 raw scraped job
titles — Hebrew fragments and mis-scraped postings included — returning the 5 most
frequent skills among a query's neighbours. The 4.77MB artifact was the entire dataset
serialized. There were never metrics, only manual spot checks; the one that survives
in saved notebook output shows `python developer` → *python, backend, scalable,
computer science, best practices* — three of five generic noise. The team's memory
("its results simply weren't good enough") is confirmed by the code in an unusual way:
the replacement's `UNIVERSAL_NOISE` blacklist contains, verbatim, the three bad
outputs of that spot check. Three days later the model was replaced by hand-curated
canonical roles with offline weighted aggregation, and the artifact shrank 34×.
**Lesson:** a failed manual check, taken seriously, is worth more than an unmeasured
model — but the next iteration (Ch. 5) had to replace spot checks with a labeled corpus.

## 3. Calibrating the score scale: the supervisor's zero **(team + code)**

The 1-10 skill scale was recalibrated twice, and neither change came from a metric.
First, a direct note from our supervisor, Dr. Galit Haim: *something truly bad must
start from zero — a candidate who does not know Linux cannot receive a 1 for it* —
so the scale was re-anchored at 0. Second, a product realization: real recruiter
screens effectively demand ≥80% fit, so the "strong" band was tightened to 8.0-10 —
the product should tell a candidate their CV is strong only when that is actually
true. **Lesson:** score scales are product statements, not statistics; both anchors
(the honest zero, the meaningful 8) encode a promise to the user.

## 4. Data sources: convenience first, then the heavy guns **(code + team)**

The first scraper ever targeted a single company's careers page — reachable, unblocked,
24 postings. AllJobs followed, with a Hebrew→English translation pipeline; the team's
verdict: the data was low-quality, outdated, irrelevant, and the whole path — translation
artifacts included — was retired. Glassdoor, named in the specification, was never
attempted (zero traces in history). Instead the team returned to LinkedIn, the source
it had avoided for fear of blocking, and — in their words — "brought out the heavy
guns" to work around the blocking. It worked, and it was worth it: the data quality
justified the effort. **Lesson:** the source-selection arc ran convenience → quality
disappointment → deliberate effort for the high-quality source; data quality, not
access ease, determines a market model's ceiling.

## 5. lang-uk: not a stopgap — a time machine **(team)**

Most training data ultimately comes from the external, verified lang-uk corpus
(2020-2023). Its role, as the team frames it, is deliberate: to simulate how the
system will behave after two-three years of real continuous scraping — demonstrating
how the personalization signals (stable/trending) work and respond over a long
horizon that a project-length scrape cannot produce. **Lesson:** an external
historical corpus can stand in for the system's mature future, turning "we lack
years of data" into a demonstrable simulation.

## 6. Proving model 2 learns: the 77% shortcut and the fix that failed **(code, documented)**

Verified and retained from the documented record: 77% of training CVs contained their
label verbatim (F1 0.981 → 0.932 after per-document scrubbing); the "obvious"
global stop-words fix cratered framework-centric classes to ~0.2 because label words
are also skills; the label space consolidated 65→38 and finally to the 59 canonical
roles + `__other__`. Baselines compared only on scrubbed data: LogReg 57.6% vs MLP
62.3%. **Lesson:** leakage is removed surgically, never globally — and comparisons
made on leaky data are not comparisons.

## 7. Filling 32 empty classes: a data-seeking bridge **(team + code)**

For the 32 specialist roles with no real CVs, the alternative the team weighed was
not shrinking the taxonomy or hand-labeling — it was finding another corpus, so that
all 59 roles would be usable and "the model would not go to waste." Synthetic title
strings were the bridge until such a corpus appeared. The cost surfaced only in
measurement: no-data roles can be guessed wrong at high confidence, below no safety
net. **Lesson:** a coverage bridge must ship with its own measurement; the risk of
confident-but-wrong was discovered by evaluation, not anticipated. (Follow-up
investigation assigned to the metrics milestone.)

## 8. Title detection: regex → the "both-ways" insight → a ladder **(code + team)**

A real attempt — not a placeholder — at regex-based title extraction taught the
defining lesson: *a CV is not structured; everyone writes their own*. Results were
poor, and the failure pushed the team to invert the problem: if the skills extracted
from a CV are reliable, the role can be inferred from them — the "both-ways model"
(formally: bidirectional role-skill inference; the skills→title direction is
occupation prediction from skill profiles). The shipped system realizes the inversion
partially — the classifier reads the CV body rather than the extracted skill set —
and the full skills→title direction is recorded as planned work. Alongside: the
char-ngram KNN fallback that matched spelling instead of meaning (iOS→Kernel) was
replaced by the three-rung ladder — semantic normalization, body classifier,
closed-list LLM. **Lesson:** in unstructured text, content beats structure; detection
became a system of mechanisms with disjoint failure modes rather than one model.

## 9. The closed list without an exit: a mistake, stated plainly **(team + code)**

Removing the manual role override left out-of-domain CVs (a nurse, say) with nothing
but nonsense suggestions and no way to say "my role is not on your list." The team's
answer is unusually honest: this was not by design — it was a developer's
misunderstanding of the task, and the book will present it as a known limitation,
not rationalize it. A restore of the escape hatch is a candidate fix in the remaining
work. **Lesson:** honesty about a mistake costs less than a retrofitted rationale.

## 10. The pipeline, discovered through architecture mapping **(code + team)**

While systematically mapping what connects to what, the team established that the
nightly scrape-train loop was not actually feeding the served model (the scraper
wrote local files; the trainer read an unpopulated collection). The team is explicit
that this was part of deliberately charting the project's architecture — and the
mapping produced the design that now defines the pipeline: the promotion gate.
In its first three real runs the gate rejected two degraded models and promoted the
merged-source run — behaving exactly as designed. Migrating the whole system onto
Docker in late June surfaced structural issues that took real fixing; that work
completed the deployment story. **Lesson:** "it runs nightly" and "it works" are
different claims; every piece of automation now carries an end-to-end assertion —
the gate for training, JSON guards for agents, a labeled corpus for evaluation.

## 11. Per-section rewriting: a UX problem that designed the architecture **(team, documented)**

The improve screen produced the project's cleanest example of UX driving
architecture: a skill may appear in a specific CV section; after rewriting that
section and moving to another skill *in the same section*, the screen must show the
most up-to-date version of the rewrite — never a stale one. That requirement forced
per-section versioning: each section saved independently, every improvement applied
to the latest version, sections merged only at the end. **Lesson:** the overwrite
hazard was found by walking the user's path, and the fix became a structural design.

## 12. A feature that dissolved — and returned as a screen **(code + team)**

An early "skill preferences" API (user-weighted skill ranking) was implemented,
then vanished in a later rewrite of the serving code; the team does not recall
deciding to remove it — its remnants (a failing test, README references, an ignored
request parameter) simply stayed behind. The idea itself, though, resurfaced months
later, properly productized, as the Personalization screen (stable/balanced/trending/
custom). **Lesson:** ideas survive their implementations; the cleanup of the orphaned
remnants is tracked in the final-sprint code-cleanup task.

## 13. Working test cases from flows, not hunches **(team + code)**

The 46-case acceptance set that drives the hard-case evaluation was built by
enumerating the system's possible flows — each case represents a path a real user
could take (clear title, no title, out-of-domain, ambiguous...). **Lesson:**
flow-coverage design gave the small hand-written set outsized diagnostic power.

## Threads intentionally left open

- **Experiments outside this repository:** model experiments conducted separately
  (Yarin's model work) are not captured here; a question set is pending handoff.
- **Threshold tension (60/55 deployed vs 80/95 auto-calibrated)** and the
  **niche-vs-mainstream separability hypothesis** — both assigned to the evaluation
  milestone (M05); their outcomes belong in the book's Results/Discussion.
- No single "most painful moment" was identified in the interview; the record
  suggests the pain was distributed — and mostly converted into mechanisms.
