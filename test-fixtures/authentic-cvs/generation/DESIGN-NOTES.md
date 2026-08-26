# Authentic CV Set - Design Notes & Allocation

> Working doc for M04. Read this FULLY before writing any CV content.
> Goal: files that a human judge would accept as real CVs. Authenticity beats beauty.

## Research summary - what real CVs look like (web research 2026-07-14)

**Layouts in the wild:** single-column is still the majority; two-column with a 30-40%
sidebar (skills/contact/languages in the narrow column) is common in tech. Real CVs
frequently use tables, text boxes and columns even though they parse badly - per the
user's explicit instruction, our set must NOT be scan-friendly across the board.

**Typical section order (experienced):** Header (name, title, contact line) → Summary
(2-3 lines) → Skills → Experience (reverse-chronological, bullets) → Education → extras.
**Junior:** Education and Projects move up (projects with GitHub links, bootcamp
certificate entries, tech-stack sub-lines).

**Israeli-market conventions (our personas are Israeli):**
- **Military service section** - prominent, often right after or inside experience:
  "IDF, Unit 8200 - Intelligence Analyst (2016-2019)", "Mamram graduate", or plain
  "Full military service, Golani Brigade". Not every CV - vary it (~60% of ours).
- Education with **B.Sc. / M.Sc.** notation (BGU, Technion, TAU, HIT, Open University,
  college names). Languages section: "Hebrew - native, English - fluent".
- 1 page for junior/mid, up to 2 pages senior. Cities: Tel Aviv, Haifa, Ramat Gan,
  Beer Sheva, Herzliya, Petah Tikva, Rishon LeZion.
- Phone format 05X-XXXXXXX, sometimes +972. LinkedIn URL on most, GitHub on devs.

**Real-world imperfections (sprinkle - this is what makes them REAL):**
- Duty-listing without metrics on weaker CVs ("Responsible for maintaining...").
- Inconsistent date formats *within* one CV (2019-2021 vs Jan 2022 - Present) - 2-3 files.
- Centered headers / weak visual hierarchy on the "Word classic" ones.
- Dense cramped text on one; excessive whitespace padding a thin CV on another.
- ONE subtle typo in exactly 2 mediocre files ("recieved", "enviroment") - no more.
- Buzzword summary on 1-2 weak files ("results-driven team player").
- Strong CVs: metrics in bullets ("cut deploy time from 40m to 8m"), clean consistency.

**Hard constraints from the pipeline (verified in code):**
- Name + current title must appear within the FIRST 25 non-empty lines (header extractor).
- Text layer must extract via pdf-parse; ≥50 chars after normalization. PDF ≤ 8MB.
- Fictional people, fictional companies (Israeli-plausible: "Lumitech", "DataSphere",
  "CyberNexus", "Bluewave Systems", "Qualisense", "NetGuard Labs"...). NEVER real
  companies paired with people; NEVER real names/phones/emails (use example domains
  like gmail-lookalike fakes: firstname.lastname@gmail.com is fine - it's unverifiable
  and generic; avoid real LinkedIn slugs - use /in/firstname-lastname-fake numbers).

## File naming (user directive)

`<role-slug>-<seniority>-<strength-or-scenario>_<Person-Name>_CV.pdf`
e.g. `backend-senior-strong_Daniel-Peretz_CV.pdf`. HTML source: same name, `.html`.

## Templates (8) - `src/templates/`

| ID | File | Look | Used by |
|---|---|---|---|
| T1 | t1-word-classic.css | Word default: Calibri, centered name, plain headings, dense | mediocre/mid personas |
| T2 | t2-sidebar-dark.css | Two-column, 35% dark left sidebar (skills/contact/langs) - NOT scan-friendly | modern mid/senior |
| T3 | t3-minimal-exec.css | Georgia/serif, generous whitespace, small-caps headers, thin rules | polished seniors |
| T4 | t4-canva-creative.css | Accent banner header, unicode icons, CSS skill bars - NOT scan-friendly | designers/juniors |
| T5 | t5-academic.css | Times New Roman, education-first, tight, no color | students/researchers |
| T6 | t6-compact-tables.css | Right sidebar + bordered table experience blocks - NOT scan-friendly | dense engineers |
| T7 | t7-word-ugly.css | "Made in Word 2010": table layout, bold-everything, mixed fonts, centered titles | deliberately mediocre |
| T8 | t8-startup-modern.css | Segoe UI, subtle single accent color, links row, clean single column | strong tech CVs |

System fonts only (Calibri, Segoe UI, Georgia, Times New Roman, Arial, Courier New) -
that's what real Word/Canva exports use. `@page { size: A4 }`.

## Allocation table - 32 files

### Benchmark set (29 English, counted in M05 accuracy)

| # | Filename slug | true_title | acceptable_titles | Scenario | Level | Strength | Template |
|---|---|---|---|---|---|---|---|
| 1 | backend-senior-strong_Daniel-Peretz | Backend Developer | - | clear-cut | senior | strong | T8 |
| 2 | frontend-mid-strong_Noa-Shapiro | Frontend Developer | - | clear-cut | mid | strong | T2 |
| 3 | devops-senior-strong_Alex-Vaisman | DevOps Engineer | - | clear-cut | senior | strong | T3 |
| 4 | datascientist-mid-strong_Maya-Berkovich | Data Scientist | - | clear-cut | mid | strong | T8 |
| 5 | qa-automation-mid-mid_Yossi-Alfasi | QA Automation Engineer | - | clear-cut | mid | mid | T1 |
| 6 | ml-senior-strong_Amir-Dahan | Machine Learning Engineer | - | clear-cut | senior | strong | T3 |
| 7 | java-senior-mid_Marina-Feldman | Java Developer | Backend Developer | clear-cut | senior | mid | T1 |
| 8 | software-mid-mid_Tomer-Azulay | Software Engineer | - | clear-cut | mid | mid | T7 |
| 9 | dataeng-mid-strong_Shira-Golan | Data Engineer | - | clear-cut | mid | strong | T6 |
| 10 | fullstack-mid-ambiguous_Omri-Katz | Fullstack Engineer | Frontend Developer, Backend Developer | ambiguous | mid | mid | T2 |
| 11 | platform-senior-ambiguous_Igor-Bronstein | Platform Engineer | DevOps Engineer, Kubernetes Engineer | ambiguous | senior | strong | T6 |
| 12 | frontend-junior-ambiguous_Lior-Malka | Frontend Developer | Fullstack Engineer | ambiguous | junior | weak | T4 |
| 13 | datasci-ml-mid-ambiguous_Yael-Rosen | Data Scientist | Machine Learning Engineer | ambiguous | mid | mid | T8 |
| 14 | qa-to-automation-mid-careerchange_Dana-Peled | QA Automation Engineer | - | career-changer | mid | mid | T1 |
| 15 | support-to-devops-junior-careerchange_Eli-Mizrahi | DevOps Engineer | - | career-changer | junior | weak | T7 |
| 16 | electrical-to-embedded-mid-careerchange_Boris-Kagan | Embedded Engineer | Firmware Engineer | career-changer | mid | mid | T5 |
| 17 | ml-dataeng-senior-hybrid_Ronit-Avrahami | Machine Learning Engineer | Data Engineer, MLOps Engineer | hybrid | senior | strong | T3 |
| 18 | fullstack-devops-senior-hybrid_Nadav-Stern | DevOps Engineer | Fullstack Engineer, Platform Engineer | hybrid | senior | mid | T2 |
| 19 | security-backend-mid-hybrid_Michal-Weiss | Product Security Engineer | Backend Developer, Cyber Security | hybrid | mid | mid | T6 |
| 20 | student-junior-weak_Itay-Cohen | Software Engineer | - | junior | junior | weak | T5 |
| 21 | bootcamp-frontend-junior-weak_Sapir-Ohana | Frontend Developer | - | junior | junior | weak | T4 |
| 22 | analyst-to-ds-junior-mid_Gal-Nissim | Data Scientist | Data Engineer | junior | junior | mid | T1 |
| 23 | soc-analyst-mid-strong_Adi-Baruch | SOC Analyst | Security Analyst | niche-core | mid | strong | T8 |
| 24 | malware-researcher-senior-strong_Dmitry-Volkov | Malware Researcher | Reverse Engineer, Security Researcher | niche-core | senior | strong | T3 |
| 25 | firmware-senior-mid_Rami-Suissa | Firmware Engineer | Embedded Engineer | niche-core | senior | mid | T6 |
| 26 | pentester-mid-mid_Stav-Regev | Penetration Tester | Security Researcher | niche-core | mid | mid | T2 |
| 27 | fpga-mid-mid_Anna-Goldman | FPGA Engineer | Hardware Engineer, VLSI Engineer | niche-core | mid | mid | T5 |
| 28 | gamedev-mid-none_Ben-Harari | none | Software Engineer, C++ Developer | unsupported | mid | mid | T4 |
| 29 | techwriter-mid-none_Efrat-Landau | none | - | unsupported | mid | mid | T1 |

### Behavior fixtures (3, `is_negative_fixture: true`, NOT counted in accuracy)

| # | Filename slug | Expected behavior | Template |
|---|---|---|---|
| 30 | hebrew-reject_Rotem-Bar | Full-Hebrew CV (backend dev) → graceful rejection / clear message | T1 RTL |
| 31 | hebrew-mixed-reject_Shai-Levi | Hebrew CV with English tech terms → rejection/uncertain, not silent garbage | T2 RTL |
| 32 | scanned-image-reject_Old-Format | Image-only PDF (no text layer) → clear 400 "No extractable text" | screenshot→PDF |

## Content rules per strength

- **strong:** quantified bullets (%, times, scale), coherent progression, 2026-current
  skills in natural dosage (ML→LLM/RAG/agents; DevOps→K8s/Terraform/ArgoCD; FE→React 19/
  Next.js/TS; security→EDR/SIEM/MITRE ATT&CK), tight writing. No typos.
- **mid:** solid but partly duty-based bullets, 1-2 vague lines, decent but not
  exhaustive skills, small inconsistencies (one date format slip allowed).
- **weak:** thin experience, duty-listing, buzzwords, over-padded layout, skills list
  that overreaches vs the experience shown. (Still a REAL person's effort - not a joke CV.)

## Verification per file (blocking)

1. `pdf-parse` extracts text; ≥50 chars normalized; name+title within first 25 lines.
2. File < 8MB, opens, page count matches persona (1p junior/mid, ≤2p senior).
3. No real company+person pairing; no team-member names (May/Amit/Yarin/Reut); no typos
   beyond the 2 planned ones.
