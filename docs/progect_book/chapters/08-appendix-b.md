# Appendix B — Selected Engineering Incidents

The body of this book keeps its incident stories short so that the findings stay
in front. This appendix preserves, for the interested reader, the fuller record
of four incidents referenced in Chapters 3 and 5 — each one an instance of the
same methodological pattern: a defect invisible to unit-level checks, exposed
only by exercising the real path, and closed with a verification that outlived
the fix.

**B.1 The header-extraction chain (Chapter 3.3).** After the declared-title rung
was revived with the preserved header window, two follow-on extraction bugs
appeared and were closed in sequence. First, splitting header lines on commas
fragmented summary sentences, and a bare buzzword ("Kubernetes", cosine 0.805
against *Kubernetes Engineer*) could outscore the CV's real title and win a
confident wrong auto-accept; the fix distinguishes a genuine "Title, Company"
line (exactly one comma, no sentence punctuation) from a comma-separated
technology list. Second, the repair for PDF line-wrap fragments initially folded
email addresses onto genuine title lines and destroyed them — twenty of twenty
regression cases failed at once. The regression suite caught it within the hour;
the final merge step folds only lines that are not independently recognizable as
noise, and the full suite has guarded every header change since.

**B.2 The empty-model incident (Chapter 3.5).** During a July QA pass, the DS
server was found serving a `model.joblib` whose skill arrays were empty for all
269 stored roles — a mid-training intermediate artifact had ended up on disk.
Every analysis request failed cleanly but universally until the next day's
retrain restored a full model. The incident sharpened the case for promotion
gating between training artifacts and the serving path.

**B.3 The measurement campaign's own catch (Chapter 5.1).** The evaluation
harness's first end-to-end runs surfaced a live regression: the freshly wired
agreement signal invoked the skill extractor on every classifier call, pushing
response times (1.2–7.4s) past the backend's 5-second timeout. The fix
short-circuits the signal whenever it provably cannot change the routing
decision, and makes the timeout environment-configurable. The campaign then
re-verified the path before taking a single measurement — an evaluation harness
doubling as an integration test.

**B.4 The sibling-endpoint bug (Chapter 3.4's data-contract family).** The
header-extraction fix of B.1 was applied to the primary detection endpoint, but
an equivalent code path on the personalization route still re-ran detection
without the header text — and preferred its own (wrong) fresh result over the
correct, already-confirmed title passed to it. The display showed a different
role than the one actually analyzed; scoring was unaffected. The fix trusts the
confirmed title and threads the header text through every sibling path — and the
episode is why "verify the wiring, not the wiring diagram" recurs in this book.
