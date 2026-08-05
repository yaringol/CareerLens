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
