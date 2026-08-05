# Demo recordings

Both recorded 1440×900 against the live stack (DS :8000 with `SKILL_UBIQUITY_CAP=11`,
`ROLE_COUNT_MIN_PREVALENCE=0.05`, agreement signal on, model `trained_at=20260728_005411`;
backend :3000; frontend :8080). Nothing mocked, nothing sped up. Every score, suggestion and
merged paragraph was produced by the real pipeline during the recording.

| File | Length | Story |
|---|---|---|
| `improve-flow-tal-bar-on-devops.webm` | 2:09 | A good CV — the section-split feature in isolation |
| `full-loop-eli-mizrahi-devops.webm` | 4:08 | A weak CV — the whole product loop |

---

## 1. `improve-flow-tal-bar-on-devops.webm` — the section split

| Time | Step |
|---|---|
| 0:00 | Landing, scroll to the upload form |
| 0:10 | Upload `devops-improve-demo_Tal-Bar-On.pdf` → **role auto-detected: DevOps Engineer, 96.96%** |
| 0:22 | Paste the job posting |
| 0:30 | Analyze → dashboard, **54% match** |
| 0:50 | Gap Analysis expanded and collapsed |
| 1:05 | Improve → rate the five weak skills |
| 1:20 | `terraform` — absent → **"Target section: TECHNICAL SKILLS"** |
| 1:35 | `kubernetes` — one mention, in **PROFESSIONAL EXPERIENCE** |
| 1:50 | `python` — **4 mentions**, occurrence tabs, skill highlighted in both panels |
| 2:00 | Save, walk to the last mention, Submit → merged CV |

Why this CV: it is the only one of eight tested where a weak skill resolves to a section
**other than** the Skills list, so two adjacent tabs show genuinely different parts of the
document. Ranking in [`test-fixtures/improve-demo/README.md`](../../../../test-fixtures/improve-demo/README.md).

---

## 2. `full-loop-eli-mizrahi-devops.webm` — the whole loop

Persona: **Eli Mizrahi**, a support engineer moving into DevOps, applying to a role his CV
is not ready for. Script and shot list: [`02-SCRIPT.md`](02-SCRIPT.md).

| Time | Step |
|---|---|
| 0:00 | Landing → **My CVs** — three saved CVs |
| 0:12 | **Star `devops-improve-demo_Tal-Bar-On.pdf`** — star fills, `aria-pressed=true` |
| 0:22 | Upload `support-to-devops-junior-careerchange_Eli-Mizrahi.pdf` → role detected |
| 0:35 | Paste posting → **Analyze Match** |
| 0:50 | Dashboard **38% GOOD** — and the ⭐ banner **"Better match in your library"**, `5.4 vs 3.8 /10` |
| 1:05 | Gap Analysis expanded and collapsed |
| 1:20 | Improve → rate the five skills → every tab surveyed **and accepted** |
| 1:55 | Hero tab **`AWS` → section `EDUCATION AND COURSES`** — he learned AWS on a course, and the tool edits the course line, not the whole document |
| 2:20 | Hand-edit a suggestion, Save, Submit → merged CV with its sections intact |
| 2:40 | **Export** → real download: `support-to-devops-junior-careerchange_Eli-Mizrahi_improved.txt` (saved next to this README) |
| 2:50 | **Re-analyze →** → **41%**, up from 38% |
| 3:05 | **← Personalize** from the dashboard → presets **Stable → Trending → Custom**, slider raised, weights rebalance to **13 / 74 / 13** |
| 3:30 | Dynamic Skills chips — a 6th selection trips the toast *You can select up to 5 skills only*; deselect, reselect; **Remember this balance** |
| 3:45 | **Analyze with preferences** → **54%** |
| 3:55 | Banner (`6.6 vs 5.4`) → **Switch to this CV** → dashboard swaps in place to Tal Bar-On's analysis, **66%** |

The score arc is the spine of it: **38% → 41%** after taking the suggestions → **54%** after
retuning the balance → and Tal Bar-On, sitting in the library the whole time, still wins at **66%**.

### How the starred-CV comparison actually works

There is **no background job, no queue and no polling**. Every analyze request scores the
current CV *and every starred CV* in parallel inside the same request
([`compareSaved.service.ts:105-178`](../../../../backend/src/services/compareSaved.service.ts#L105-L178)),
and returns `bestSavedCv` only when a starred CV strictly beats the current score. The
banner is that result.

`loadStarredCandidates` filters only on `userId` and `isFavorite` — **there is no title
filter**. A starred nurse CV would be scored against a DevOps posting just the same. Both
CVs in this video being DevOps is what makes the comparison meaningful; the code does not
enforce it.

### What earlier takes got wrong, and why this order

Three takes were discarded. Both defects came from the flow, not from bugs:

1. **Personalizing before improving flattened the Improve screen.** The personalized
   analysis re-ranks the core skills; in take 2 it raised `kubernetes` from 4/10 to 6/10,
   pushing it out of the five weakest so it never reached the Improve screen at all. Every
   tab then pointed at `TECHNICAL SKILLS`. Moving personalization *after* the first analysis
   restored a tab set with real section variety — that is where the `AWS` →
   `EDUCATION AND COURSES` shot comes from.
2. **Re-analysis lowered the score** (39% → 36%) because **Submit does not require Save**.
   Generating a suggestion is not the same as accepting it: an unsaved suggestion is silently
   dropped from the merged CV, so only the one hand-edited change had actually landed. The
   recorder now clicks Save on every tab, and the score moves the right way: 38% → 41%.

That second point is a real UX gap, not just a recording problem — a user can walk the whole
Improve flow, hit Submit, and get a CV with none of their changes in it, with no warning.
Worth fixing in the product.

The recorder no longer hard-codes tab names. Which skills come back is the model's call, so
it surveys every tab at runtime and holds the long dwell on whichever points at the rarest
section.

---

## Re-recording

`record-improve-flow.js` and `record-full-loop.js` drive the two runs. They execute inside
the Playwright MCP runner — they need `page.context().browser()` to open a fresh context
with `recordVideo`.

1. Refresh `TOKEN` in the script. It is a short-lived JWT copied from a signed-in browser
   session (`localStorage.auth_token`) and it expires.
2. Reset state first, or the recording will not match: the CV library must hold exactly
   three CVs with **none starred** (the star click has to happen on camera), Eli's CV must
   **not** already be saved, and the saved personalize preference must be deleted so the
   screen opens on its default.
3. Run through the Playwright runner with the file path. The video lands here under a
   hashed name; rename it.

Waits are deliberate dwell time so the result is watchable. A faster run is not a better one.

## Note on repo size

The two `.webm` files are ~9 MB and ~14 MB and are **not** covered by the `.gitattributes`
LFS rules (only `ds/model/*.joblib` is). Route them through LFS or host them outside the
repo before committing.
