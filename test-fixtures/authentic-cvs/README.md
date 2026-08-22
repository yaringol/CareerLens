# Evaluation corpus — 32 CVs

The corpus every role-detection and scoring number in Chapter 5 of the project
book is measured against. It was **designed**, not sampled: each file exists to
put a specific, named pressure on the pipeline, and the ground truth is fixed in
`manifest.json` before any measurement runs.

```
manifest.json     pinned ground truth - true_title, acceptable_titles, scenario, level
pdfs/             the 32 documents under test
generation/       how they were built - sources, templates, render and validate tools
```

## What the 32 files are

**29 positive cases** carrying ground-truth labels across **nine scenario
types**, chosen so that the corpus stresses the parts of role detection that
actually fail:

| Scenario | What it tests |
|---|---|
| clear-cut | the easy path, as a floor |
| ambiguous | CVs that legitimately fit two roles (Data Scientist / ML Engineer) |
| hybrid | genuine two-role profiles (Fullstack + DevOps) |
| career-changer | the previous career still dominates the document |
| junior / student | thin evidence, little history to reason from |
| niche-core | roles the market corpus barely covers (FPGA, malware research) |
| weak / none | little or no relevant signal, where over-confident answers are the risk |

**3 negative fixtures** the system is required to *reject* rather than
misclassify: two Hebrew CVs and one scanned image with no extractable text.
A corpus of only positives cannot tell a careful system from a confident one.

Eight document templates are used across the set — academic, compact-tables,
sidebar-dark, minimal-exec, startup-modern, canva-creative, word-classic and a
deliberately ugly Word layout — because PDF text extraction fails differently
per layout, and a corpus rendered from one template measures one code path.
Realistic imperfections (typos, inconsistent date formats, mixed heading
conventions) are present by design.

## Provenance

The documents were **authored to a written design brief**
(`generation/DESIGN-NOTES.md`) using fictional people and fictional companies.
They are not collected from real applicants, and no real personal data appears
in them. Section 4.4 of the project book describes the design; limitation (5) of
Section 5.5 states the provenance alongside the results it supports.

This is a deliberate trade. Authored fixtures cost external validity — the book
says so — and buy pinned ground truth, deliberate scenario coverage, negative
cases, and the ability to publish the whole corpus in a repository without
handling anybody's personal data.

## Running against it

```bash
node generation/validate.cjs        # every PDF opens, extracts, matches the manifest
```

`generation/render.ps1` rebuilds the PDFs from `generation/cvs/*.html` via
headless Edge. Regenerating changes the bytes under test — rerun the benchmarks
in `scripts/eval/` if you do.
