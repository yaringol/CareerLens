# Screen recordings — captured 2026-08-03

Recorded through Playwright against the **running product** (frontend :8080,
backend :3000, DS :8000) with the measured serving configuration
(`SKILL_UBIQUITY_CAP=11`, `ROLE_COUNT_MIN_PREVALENCE=0.05`,
`AGREEMENT_SIGNAL_ENABLED=1`). Real CVs from `test-fixtures/`, real LLM calls,
real model output — nothing staged or mocked.

1440×900, webm. They continue the numbering of `clip-01..03` in the parent
folder.

| Clip | What it shows | Why it is useful |
|---|---|---|
| `clip-04-upload-and-role-detect.webm` | A software-engineer CV is dropped in; the detection ladder returns **Software Engineer, 66.53% match** with the source line under it | The opening beat: no forms, no dropdowns — the product reads the CV |
| `clip-05-full-analysis-to-dashboard.webm` | Same CV + a real senior-backend job posting → **Analyse Match** → the score dashboard, scrolled through the per-skill breakdown | The payoff shot for the film |
| `clip-06-out-of-domain-manual-picker.webm` | A **registered-nurse** CV — a role the system does not support. Instead of guessing, it says *"We found Registered Nurse. Choose the closest supported role"*, offers three low-confidence candidates (29.1% / 26.3% / 24.7%) and a manual picker | The integrity beat. Most tools would invent an answer; this one admits the limit and hands control back |

## Known gap

There is still **no recording of Export → PDF download** (flagged in
`../00-INTAKE-ANSWERS.md`). It needs a ~6-second capture of the real download,
which a screen recorder has to do — the browser automation cannot film the OS
download shelf.

## Reproducing

The recordings are driven by Playwright with `recordVideo` on a fresh context,
seeding `auth_token` into `localStorage` so a clip opens on the product rather
than a login form. Any of the 32 CVs in `test-fixtures/authentic-cvs/pdfs/` can
be swapped in.
