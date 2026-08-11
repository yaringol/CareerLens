# Video 2 — "The full loop" — SCRIPT FOR APPROVAL

**Status: RECORDED — `full-loop-eli-mizrahi-devops.webm` (4:08).**
Approved 2026-08-05 with Eli Mizrahi, full length. Acts 2 and 5 were reordered during
production: personalization moved to *after* the first analysis, because personalizing
first re-ranked the core skills and emptied the Improve screen. See the README for what
the discarded takes showed.

Persona: **Eli Mizrahi**, a support engineer moving into DevOps. He applies to a DevOps
posting with a CV that is not ready for it — and CareerLens tells him so, helps him fix it,
and then points out he already has a stronger CV sitting in his own library.

Target length **3:30–4:00**. Recorded 1440×900 against the live stack, nothing mocked.

---

## Setup before filming (not in the video)

The CV library is currently unusable for filming: **10/10 saved, nothing starred, all
duplicates** (3× Tal Bar-On, 7× Tomer-Azulay) left over from test runs.

1. Delete all 10.
2. Re-save three, so the library looks like a real person's: `Tal-Bar-On` (DevOps),
   `Tomer-Azulay` (software mid), `Dana-Peled` (QA→automation).
3. Star **Tal Bar-On only** — he must be the one who wins the comparison.
4. Confirm `GET /api/cv` shows 3 saved, 1 starred, no duplicates.

Also: refresh `TOKEN` in the recording script — it is a short-lived JWT and it expires.

---

## Shot list

### Act 1 — the library (0:00–0:25)

| Shot | On screen | Why it's here |
|---|---|---|
| 1 | Landing page, scroll to the form | orientation |
| 2 | Click **My CVs** tab — three saved CVs with size and date | the library exists |
| 3 | Click the **star** on `devops-improve-demo_Tal-Bar-On.pdf`; it fills in | ⭐ **your ask: star a CV** |
| 4 | Hover the star tooltip: *Add to favorites* → now *Remove from favorites* | shows it's a toggle, max 3 |

**Beat:** starring is not the same as saving. Saving keeps the file; starring says
*"use this one as my benchmark"*.

### Act 2 — upload the weak CV and personalize (0:25–1:20)

| Shot | On screen | Why it's here |
|---|---|---|
| 5 | Back to **Upload New CV**, drop `support-to-devops-junior-careerchange_Eli-Mizrahi.pdf` | the weak CV |
| 6 | **Detected role: DevOps Engineer** + confidence badge | title detection |
| 7 | Paste the DevOps posting (first line typed, rest pasted) | realistic input |
| 8 | Click **Customize recommendations** → `/personalize` | ⭐ **your ask: personalization screen** |
| 9 | Recommendation Balance: click **Stable**, then **Trending** — hint text changes | presets |
| 10 | Click **Custom** → three sliders appear. Drag *Trending* up; the others rebalance so the total stays 100% | the weights are real, not decorative |
| 11 | Dynamic Skills chips — deselect one, select another. Counter reads `(5/5 selected)`; try a 6th → toast *You can select up to 5 skills only* | the guard rail is visible |
| 12 | Tick **Remember this balance for next time** | preference persists |
| 13 | Click **Analyze with preferences** → *Analyzing…* | |

### Act 3 — the verdict (1:20–1:50)

| Shot | On screen | Why it's here |
|---|---|---|
| 14 | Dashboard: **32%**, role DevOps Engineer | honest low score |
| 15 | Core skills: `terraform 0`, `ansible 0`, `python 1`, `kubernetes`, `bash` | where he actually stands |
| 16 | **Banner: "Better match in your library"** — `3.6 vs 3.2 /10`, filename `devops-improve-demo_Tal-Bar-On.pdf`, button **Switch to this CV** | ⭐ **your ask: starred CVs get scored too.** Note: scored *inline during this same request*, in parallel — there is no background job. We do **not** click it yet. |
| 17 | Expand **Gap Analysis**, scroll, collapse | requirement-by-requirement |

### Act 4 — improve, export, re-analyze (1:50–3:10)

| Shot | On screen | Why it's here |
|---|---|---|
| 18 | **Improve your CV →**, rate the five skills | |
| 19 | Tab `terraform` — absent → **Target section: TECHNICAL SKILLS** | absent-skill branch |
| 20 | Tab **`kubernetes`** — 3 mentions, primary in **EDUCATION AND COURSES (8% of the CV)** | **the strongest shot in the video.** He learned K8s in a course, and the tool points at the course line, not at the whole document |
| 21 | Tab `bash` — 2 mentions, occurrence tabs, skill highlighted in both panels | multi-mention |
| 22 | Edit one suggestion by hand, **Save** | the user stays in control |
| 23 | Walk to the last mention → **Submit changes** → merged CV | |
| 24 | Click **Export** → download lands: `..._improved.txt` | ⭐ **your ask: export.** Note: it is a **.txt**, not PDF or DOCX |
| 25 | Click **Re-analyze →**, overlay *Analyzing your improved CV* | ⭐ **your ask: re-analyse** |

### Act 5 — the payoff (3:10–3:45)

| Shot | On screen | Why it's here |
|---|---|---|
| 26 | Back on the dashboard with the **new, higher score**; scores visibly moved | the loop closed |
| 27 | Banner still there → click **Switch to this CV** | ⭐ **your ask: choose the starred one** |
| 28 | Dashboard swaps in place to **Tal Bar-On's analysis** — his filename, his score, his skills | ⭐ **your ask: see its analysis** |
| 29 | Hold on the final frame | |

---

## Decisions I need from you

**1. Which weak CV?** I recommend **Eli Mizrahi**. The two axes fight each other — the
weaker the CV, the emptier the Improve screen becomes, because every skill is missing and
all five tabs then show the same Skills section:

| CV | Dashboard | Improve screen |
|---|---|---|
| **Eli Mizrahi (recommended)** | 32% | 2 distinct sections, 2 multi-mention, 2 absent |
| Dana Peled | 14% | 1 section, 1 multi-mention, 4 absent |
| Itay Cohen | 8% | 1 section, 0 multi-mention, 4 absent |

Eli keeps Act 4 alive and gives us the Kubernetes-in-EDUCATION shot. The price is that the
banner reads `3.6 vs 3.2` instead of something dramatic. **Pick Itay Cohen instead if you
want the bigger number gap and accept a flat Act 4.**

**2. Risk in Act 5 — the ending may not fire.** The banner only renders when a starred CV
*strictly beats* the current one. After Eli's CV is improved and re-analyzed his score goes
up; if it reaches 3.6+, the banner disappears and shot 27 has nothing to click. Options:
- **(a)** Keep the order and accept the risk — if it fires it is the best ending; if not I
  reach Tal's analysis through **My CVs → select → Analyze** instead (adds ~40s of loading).
- **(b)** Move the "Switch to this CV" moment to right after shot 16, before the improve
  step. Guaranteed to work, but the video then ends on the merged CV rather than the payoff.
- **(c)** Improve only 2 of the 5 skills so the score rises but stays under 3.6.

I recommend **(a)** and will report honestly which branch actually happened.

**3. Anything to cut?** At ~3:45 this is long for a promo. Act 1 and the Gap Analysis shot
are the most cuttable if you want a ~2:30 version.
