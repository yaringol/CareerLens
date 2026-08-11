# Title Detection Unification — Report (M19, W1-W3)

**Date:** 2026-07-31 · Status: W1-W3 complete; **W4 (ladder decision) awaits the
user, with these numbers on the table.**

## W1 — Naming (done 30/07)

The reverse model lives under self-describing stable names, in git (LFS):
`ds/model/skills_to_24_titles.ipynb` + `skills_to_24_titles.joblib`.

## W2 — Normalizer reconstruction (`title_normalizer_59.ipynb`)

The production normalizer had no notebook (NEW.ipynb lost, gitignored). The
reconstruction: variant generation from `taxonomy.py` (834 deterministic
strings) → `all-MiniLM-L6-v2` embeddings → 59 centroids.

| Measure | Live artifact | Rebuilt |
|---|---|---|
| Held-out (own split) | 0.926 (stored) | 0.934 |
| **Taxonomy ground-truth fidelity** (269 curated variants) | **82.2%** | **82.2%** — dead tie |
| Authentic-CV header normalization (28 titled CVs) | 23/28 | 22/28 |
| Decision-level top-1 agreement | — | 88.7% |

**Verdict:** aggregate-equivalent, decision-level different — the disagreements
are boundary strings (SW-abbreviations, security-family synonyms) where each
model fixes 8 of the other's errors and introduces 8 of its own. The
equivalence gate therefore **refused the swap** (it would buy nothing) — the
live artifact stays, the notebook stands as its reconstruction + spec, and the
provenance gap is closed. Bonus finding: the live normalizer mislabels listed
taxonomy variants ('SW Engineer' → Hardware Engineer) — variant-list enrichment
candidates documented in the notebook.

## W3 — The router model (`skills_to_24_plus_other.ipynb` → `skills_to_24_plus_other.joblib`)

The 24-titles model plus a **real rejection class**: `__other__` trained on
1,750 clearly-non-engineering lang-uk CVs (Marketing/HR/Sales/Support/
Recruiter/Lead-Gen/Artist; ambiguous analyst tags deliberately excluded so
career-changers aren't taught as rejects). No synthetic tail data (user
decision) — the 35 zero-example canonical roles stay out of the label space and
route via `__other__`/low-confidence to the closed-list LLM.

| Measure | Value |
|---|---|
| Held-out (25 classes) | acc **0.828** · top-3 0.945 · macro-F1 **0.887** |
| `__other__` on held-out | precision 0.662 · recall 0.767 · **f1 0.710** |
| Generalization | train 0.943 vs validation 0.829 (gap 0.11, curve converges) |
| 32 authentic — in-coverage | **16/25 (64%)** — identical to both the 24-model and the shipped text classifier |
| `none` fixtures rejected | **1/5** (scanned-image only) |
| Tail CVs (FPGA, malware) routed to `__other__` | 0/2 (nearest-family instead) |

**The honest finding on rejection:** `__other__` works on its own domain
(HR/sales-like profiles, f1 0.71) but does **not** fire on the M04 `none`
fixtures — gamedev and techwriter CVs are saturated with engineering-adjacent
skills, and the Hebrew/scanned fixtures reach the model as thin English
fragments. **The shipped classifier fails the exact same five** (its
`__other__` mass: 0.00-0.10). Production context matters: the real ladder
catches Hebrew CVs upstream (English-only check, M14) and scanned CVs at text
extraction — so the model-level rejection gap concerns genuinely hard cases
(gamedev/techwriter), where no measured model helps and the LLM/manual rungs
remain the answer.

## The full measured picture for W4 (the ladder decision)

| Detector | In-coverage acc (32) | Covers | Rejection | Notes |
|---|---|---|---|---|
| Shipped text classifier (TF-IDF+MLP) | 16/25 | ~24 real (59 nominal) | fails all 5 nones | tail classes never predicted (probed) |
| skills_to_24_titles | 16/25 | 24 | none by design | ties |
| **skills_to_24_plus_other** | **16/25** | 24 + `__other__` | 1/5 nones; works on clear non-tech | same accuracy, adds honest rejection |
| Agreement signal (text ⊕ skills) | **87% when agree** vs ~50% disagree | — | — | the one measured *win* |
| Normalizer (stage 1) | 23/28 on declared headers | all 59 | n/a | the tail's only cheap coverage |

**W4 options (user's call):**
1. **Wire the agreement signal + `__other__`-mass as low-confidence triggers**
   (the one measured improvement; LLM/manual unchanged) — the original M19
   design, now enriched.
2. **Swap the text classifier for the router model** — buys no accuracy,
   loses signal diversity; not recommended on these numbers.
3. **Wire nothing now** — ship as research + book material; production ladder
   already covers every case via upstream guards + LLM + manual. Legitimate
   given the across-the-board ties.

## Assets

| Asset | Where |
|---|---|
| Normalizer reconstruction notebook | `ds/model/title_normalizer_59.ipynb` (+ `title_normalizer_rebuilt.joblib` reference artifact) |
| Router model notebook + artifact | `ds/model/skills_to_24_plus_other.ipynb` + `.joblib` (LFS, unpickles anywhere) |
| Non-engineering sampler | `ds/model/sample_other_cvs.py` |
| Commits | `c6ffc4c` (naming), `d51cd3a` (W2+W3) |

---

# W4 — Agreement-signal wiring (2026-08-02, user decision: option 1)

## What was wired (`f66fd40`)

`/cv/title` runs the router (`skills_to_24_plus_other.joblib`) as a second
opinion on **every** request (user decision), behind `AGREEMENT_SIGNAL_ENABLED`:

* **agree** (ladder answer ∈ router top-3 — soft rule; top-1-only punished
  adjacent families like DS/MLE and was refined after round 1, disclosed below)
  → confidence lifted to ≥ 87 → the LLM rung never fires needlessly.
* **disagree / `__other__` rejection** → all candidates capped below the LLM
  threshold → the existing closed-list LLM fires; router's pick joins the UI
  candidates. **Guard:** a declared title above 85 is never overridden.
* not_covered / no_skills / router-missing → fully neutral; switch off =
  byte-identical legacy behavior. Serving applies the training-time leakage
  guard (feature-distribution parity).

Backend: log-only change (which signal triggered the fallback). `npm run build` ✓.

## Measurements (full disclosure, two ladder rounds + E2E)

* **Ladder-level round 1 (top-1 agreement):** OFF 29/32 → ON 28/32 — one real
  win (techwriter `none` no longer auto-matches) but two losses where the
  router second-guessed *correct* declared titles in its own sparse classes
  (Pentester, MLE). **Round 2 (top-3 agreement, rule refined after seeing
  round 1 — disclosed):** statuses improve (16 agree) but the same two losses
  remain: the sparse classes don't crack the router's own top-3. Further rule
  tuning stopped — it would overfit the 32.
* **End-to-end (real backend + real LLM calls), ON vs OFF: identical outcomes
  on all 32** (27/32 product-correct both ways; diffs: 0). The fixture set is
  header-dominated — every engineering CV resolves via a confident declared
  title, which the >85 guard correctly leaves alone. The signal's active zone
  (undeclared/gray-zone uploads, where M18 measured 87% vs ~50%) is not
  represented in these fixtures. Cost measured: ~+1s avg per upload.
* E2E failure notes (identical in both modes, pre-existing): the two Hebrew
  fixtures reach the route only because this test bypasses the upload flow's
  English-only guard (M14); gamedev auto-matches SE (known hard none);
  student CV lands below auto-match either way.

## Verdict & state

Per the user's criterion ("enabled once the measurement passes") the
measurement shows **zero regressions** and the guard behaves exactly as
designed — **the signal is ON locally** (DS start env:
`AGREEMENT_SIGNAL_ENABLED=1`, alongside `SKILL_UBIQUITY_CAP=11
ROLE_COUNT_MIN_PREVALENCE=0.05`). Its measurable value is protective (headerless
uploads) rather than fixture-visible; that framing goes to the book as-is.
Demo-environment enablement joins the coordination list with the stack operator.

**Playwright (signal ON):** Data-Scientist CV → auto-detected 96.16%
(`19-agree-datascientist-upload.png`); nurse CV → "We found Registered Nurse.
Choose the closest supported role" with low-confidence suggestions + manual
picker — the escape hatch intact (`19-nurse-protected-with-signal.png`).

---

# W5 — Rewiring onto the endpoint the product actually calls (2026-08-02)

## The discovery (user's finding, verified in code)

The backend **never calls `POST /cv/title`** — the only endpoint W4 wired. The
product's title ladder lives in `backend/src/services/dsModel.ts`
(`extractTitleFromCv`): LLM header extraction → `GET /title/normalize` →
fallback to `GET /cv/role` → closed-list LLM rung. The DS-side `POST /cv/title`
ladder is a legacy parallel implementation (historical docs describe
`/api/cv/extract-title` as its proxy; the route was since rewired to the
backend-local ladder). Consequences, disclosed:

* The W4 signal was live only for direct callers of the DS endpoint — **dead in
  the product flow**. `ladder.agreement` in `dsModel.ts` was always undefined.
* The W4 E2E "ON vs OFF identical" result is **explained by this gap**, not
  (only) by header dominance — the flow never traversed the signal. The
  ladder-level W4 measurements (taken directly against `POST /cv/title`)
  remain valid.

## The fix (user decision: option 1 — move the signal to `/cv/role`)

* **DS:** `apply_agreement_signal_to_roles()` — same policy as W4 (agree →
  top boosted to ≥ 87; disagree/`__other__` rejection with base < 85 → all
  candidates capped ≤ 50 + router's pick appended; not_covered/no_skills/off →
  untouched), adapted to `/cv/role`'s list shape. Signal fields attached to
  every candidate item — response stays backward compatible. `GET /cv/role` now
  returns `apply_agreement_signal_to_roles(classify_cv_role(text), text)`.
  `POST /cv/title` keeps its W4 wiring (measurement/legacy callers).
* **Backend:** `classifyRoles` reads the signal fields off the first candidate
  and `extractTitleFromCv` passes them through to `ExtractTitleResult` — the
  `(agreement signal: X)` LLM-fallback log line is now actually reachable.
  `npm run build` ✓.
* `/cv/role` is called **only** on the headerless path (no self-declared title
  found) — exactly the signal's measured active zone (87% agree vs ~50%
  disagree). The declared-title path (`/title/normalize`) stays unsignaled by
  design: the >85 guard made the signal near-moot there, and W4 round-1 showed
  the router second-guessing correct declared titles in its sparse classes.

## W5 measurements

* **Endpoint smoke (direct `GET /cv/role`):** nurse CV → classifier said
  Backend Developer, router `rejects` → capped 50.0 (below the 55 LLM
  threshold). FPGA CV → C++ Developer + `agree` → boosted 87.0. Fields present
  on every item.
* **E2E, 32 authentic CVs through the real backend (real LLM):** ON **27/32**
  vs OFF **27/32** — zero product-level regression, avg latency 1.02s both
  ways (the SkillNer+router cost lands only on the rare headerless path). The
  single row-level diff (hebrew-mixed fixture) is LLM-extraction
  nondeterminism, wrong in both modes, unrelated to the signal.
* **Headerless CVs through the real backend** (`/api/cv/extract-title`, the
  active zone the fixture set lacks): synthetic no-title DevOps CV →
  `agreement: agree`, DevOps Engineer, auto-matchable; synthetic no-title HR
  CV → `agreement: rejects`, capped/low-confidence, closed-list LLM correctly
  declines a non-engineering CV → manual picker. Both protections verified
  end-to-end in the product path.

## Verdict & state

The signal now runs where the product runs. Zero regression on the 32; both
signal behaviors (boost, protective rejection) verified through the real
backend on the headerless path. **ON locally** — DS start env unchanged:
`AGREEMENT_SIGNAL_ENABLED=1 SKILL_UBIQUITY_CAP=11
ROLE_COUNT_MIN_PREVALENCE=0.05`. Demo-env enablement remains on the
stack-operator coordination list.
