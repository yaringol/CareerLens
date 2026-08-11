# Intake form — answers & upload manifest

Everything in this folder is real, taken from the shipping product or its design tokens.
Nothing here is a mockup or a redraw.

---

## Q1 — Approved logo / wordmark + brand guide

**Upload:** `brand/careerlens-logo-export.svg` · `brand/brand-guide.md`

PNG versions, in case the form rejects SVG (all rendered from the same vector source at 2×,
in real Inter — 1712×460 lockups, 1024×1032 mark):

| File | Use |
|---|---|
| `brand/careerlens-lockup-transparent.png` | Default. Mark + wordmark, alpha channel |
| `brand/careerlens-mark-transparent.png` | Mark only, alpha channel — for the logo animation |
| `brand/careerlens-lockup-on-brand-bg.png` | On `#eeeef8` — matches the app's own background |
| `brand/careerlens-lockup-on-dark.png` | On `#1e1b6e`, white mark + `#c084fc` "Lens" — for the dark scenes |

The SVG is a vector export of the live `AppLogo` React component, so it is byte-accurate to
what users see.

> ⚠️ **Two logo variants exist in this repo.** `frontend/public/favicon.png` is a *different*
> drawing — the magnifying glass contains a line chart and uses a blue→violet gradient. The
> header logo (`AppLogo.tsx`, and everything in this folder) has a plain violet dot in the lens
> and no gradient. **The header version is canonical** — it is what users actually see in the
> product on every screen. Do not mix the two in one film. The brand guide lists the exact hex tokens, weights, radii and shadow values
from `frontend/src/index.css`, plus explicit do-nots for the mark.

Public brand URL: none — this is a pre-release academic project, no public brand site.

---

## Q2 — Real UI captures

**Upload all six PNGs (1280×800, real app, real data):**

| File | Stage | What's visible |
|---|---|---|
| `screenshots/ui-01-upload-and-role-detect.png` | **Upload** | `sample-cv.pdf` accepted, "Save to My CV library" on, and the automatic **Detected role: Software Engineer — 92.52% match** card. `Analyse Match →` CTA. |
| `screenshots/ui-02-score-and-skills.png` | **Score + skills** | Hero shot. Circular gauge at **46% · MODERATE**, Core Skills column (`linux 7/10`, `algorithm 0/10`, `c++ 0/10`) and Dynamic Skills column (`python`, `kubernetes`, `integration`). Footnote: *"Based on continuously scraped job market data for this role."* |
| `screenshots/ui-03-gap-analysis.png` | **Gaps** | A weaker CV — **30% · WEAK** — with the Gap Analysis table open: `SKILL / REQUIRED / IN YOUR CV / GAP`, including `generative ai · ✗ Not found`. |
| `screenshots/ui-04-rewrite-suggestion.png` | **Rewrite** | Improve screen, skill chips (`algorithm`, `c++`, `debugging`…), ORIGINAL panel (pink) vs REPHRASED panel (green), with `Edit / Rephrase Again / Save`. Step `1 / 5`. |
| `screenshots/ui-05-rewrite-approved.png` | **Approval** | The same screen after approval — CURRENT SECTION (SAVED), button reads **`Saved`**, one chip marked `skip`. Step `2 / 5`. |
| `screenshots/ui-06-export-improved-cv.png` | **Export** | "Your improved CV is ready" with `Copy / Export / Re-analyze →` and the merged CV text below. |

**Also upload the motion clips** (real screen recordings of the app, webm):
`clips/clip-01-full-flow-reanalyze.webm`, `clips/clip-02-flow.webm`, `clips/clip-03-flow.webm`.

*Gap to flag:* there is no existing recording of the **Export button click → PDF download**
moment. If that beat matters, it needs a fresh 6-second capture.

---

## Q3 — Narration voice direction

**Answer: "Use a newly designed warm neutral narrator."**

Why: the emotional spine of the film is a person who crumpled their own CV and threw it away.
An authoritative voice over that beat reads as lecturing. The authority in this film is already
carried visually — a live score gauge, a gap table, and the line *"based on continuously scraped
job market data."* The voice's job is the opposite: to say *"Your CV isn't bad"* and be believed.
Warm neutral, unhurried, no upward sales inflection, no smile-through-the-vowels read.

Reference direction: measured documentary narration, ~135 wpm, full stop after
*"It just doesn't say what the market is looking for."*

---

## Q4 — On-screen professional: gendered or neutral?

**Recommendation: Androgynous / not emphasized.**

Three reasons, in order of weight:
1. The film's thesis is that CVs get filtered on *language*, not on who wrote them. Making the
   protagonist demographically specific invites a reading the product doesn't make.
2. Most of the human footage is close-up and partial anyway — hands crumpling paper, hands
   flattening it out of the bin, over-shoulder monitor glow. Face time is roughly two seconds.
3. Casting neutrality makes the hardest continuity requirement much easier: the same person,
   same room, same camera angle must appear in the frustration scene and the resolution scene.

This is a positioning call rather than a technical one — override freely if the submission
context calls for a specific protagonist.
