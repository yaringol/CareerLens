# improve-demo - CVs built to exercise the /improve section split

Three CVs whose only job is to demonstrate and test the section-splitting feature of
the CV improvement flow. **Deliberately separate from `test-fixtures/authentic-cvs/`** -
that set is the M05 benchmark and its manifest drives the reported accuracy numbers;
adding files there would move those numbers.

Rendered with the same toolchain and the same templates as the authentic set:

```powershell
.\test-fixtures\improve-demo\render.ps1     # src/*.html -> pdfs/*.pdf via headless Edge
```

Benchmark them:

```bash
node scripts/eval/16-section-split-benchmark.js --demo
```

## Why three, and what each one proves

The splitter reads headings out of the PDF text layer. Templates render headings in
ways that reach the text layer looking completely different, so each CV here uses a
different one **on purpose**:

| CV | Template | How headings arrive from `pdf-parse` | Matcher branch exercised |
|---|---|---|---|
| `frontend-improve-demo_Omer-Katzir` | T3 minimal-exec | `E x p e r i e n c e` (letter-spacing 2.5px) | whitespace-free vocabulary match + label de-spacing |
| `devops-improve-demo_Tal-Bar-On` | T8 startup-modern | `PROFESSIONAL EXPERIENCE` (text-transform: uppercase) | ALL CAPS |
| `datascientist-improve-demo_Roni-Shefer` | T1 word-classic | `Professional Experience` (Title Case, underlined) | Title Case vocabulary |

All three split into 7-9 fully labelled sections with no content lost:

```
Roni-Shefer   Header | Professional Summary | Technical Skills | Professional Experience | Projects | Education | Languages
Tal-Bar-On    Header | PROFESSIONAL SUMMARY | TECHNICAL SKILLS | PROFESSIONAL EXPERIENCE | PROJECTS | CERTIFICATIONS | MILITARY SERVICE | EDUCATION | LANGUAGES
Omer-Katzir   Header | Summary | Skills | Experience | Projects | Education | Languages
```

## Skill placement - each branch of the improve screen

Skills were placed so that one pass through the improve flow hits every path:

| Path in the UI | Demo skill | Where it sits |
|---|---|---|
| **Multi-mention** (occurrence tabs "Mention 1 / 2 / 3") | Jenkins (4), Python (4), React (4) | skills line + summary + experience + projects |
| **Single mention, tight localization** | Kubernetes, Accessibility | one experience bullet only |
| **Absent skill** ("Target section" panel) | Terraform, MLOps, Next.js | nowhere in the CV |
| **Shared section** (`sharedWith` notice + save sequencing) | Docker / Monitoring / Jenkins all primary in Technical Skills | tests that saving one does not clobber another |

The absent skills are also the honest ones for these personas - Tal-Bar-On's summary says
"currently expanding into container orchestration and infrastructure-as-code", so a
missing Terraform is consistent with the CV rather than a hole punched into it.

## Known weak spot

The Experience section is 46-52% of each CV, because nothing between two jobs looks like a
heading. A skill mentioned *only* in an experience bullet (Kubernetes, Accessibility) therefore
gets handed a section that is roughly half the document. Splitting per job entry - on the
role/company/date-range line - would tighten this further; not implemented.

## Content rules

Same as `authentic-cvs/src/DESIGN-NOTES.md`: fictional people, fictional companies,
Israeli-market conventions, English only, name and current title inside the first 25
non-empty lines.
