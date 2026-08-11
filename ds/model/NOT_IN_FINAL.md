# Notebooks & Artifacts NOT in `ds/final/`

`ds/final/` holds only the four models production certainly serves (see
[`ds/final/README.md`](../final/README.md)). Everything below stays in `ds/model/`:
research that led to those models, superseded trainers, and versioned snapshots.
Nothing here is loaded by `server.py`.

## Notebooks

### `tfid.ipynb` — previous-generation CV→title trainer (superseded)
- **What it is:** the "proof of learning" notebook that trained the original 38-class
  TF-IDF + LogReg CV→title classifier from `master_resumes.jsonl` only.
- **Why not final:** the **deployed** `text_to_job_title_classifier.joblib` is the
  59-class TF-IDF + MLP artifact from `train_cv_classifier.py` (commit `1dbd8b4`,
  script recovered into `ds/final/`), whose docstring explicitly replaces this
  notebook. The 712 KB LogReg artifact this notebook produced survives only as the
  snapshot `text_to_job_title_classifier_20260701_104013.joblib`.
- **Referenced by:** history/methodology docs only (`CV_TITLE_CLASSIFIER.md`,
  `titles_model_progress.md` — both stale; current story:
  `TITLE_DETECTION_METHODOLOGY.md`).

### `training.ipynb` — first-generation Model 1 training (superseded)
- **What it is:** the original title→skills preprocessing/training over the scraped
  `linkedin` / `alljobs` corpora (`ds/extractor/*_translated_skills.jsonl`).
- **Why not final:** Model 1 training moved to `train.py`, and the current production
  artifact was retrained by `ds/final/model1_retrain.ipynb` (M06) on the lang-uk
  corpus. Kept as provenance of the first model generation.
  (`.ipynb_checkpoints/training-checkpoint.ipynb` is just Jupyter's editor
  auto-checkpoint of the same file.)

### `skills_to_24_titles.ipynb` (+ `skills_to_24_titles.joblib`) — M18 research
- **What it is:** the reverse skills→title model over 24 classes, trained on three
  balanced sources (job postings, lang-uk CVs, master_resumes). Held-out acc 0.844 /
  macro-F1 0.899. **This notebook produced the agreement-signal finding** (86.7%
  accuracy on agree vs 40–60% on disagree) that M19 shipped.
- **Why not final:** it has no rejection class, so it was superseded for production by
  its sibling `ds/final/skills_to_24_plus_other.ipynb` (adds `__other__`). Kept because
  the M18 results memo (`docs/final-sprint/outputs/18-skills-to-title-results.md`) and
  the M19 report cite it.

### `Copy_of_CV_to_title.ipynb` — Colab scratch copy (untracked)
- **What it is:** a Colab export experimenting with title prediction from
  `jobs.lang-uk-job-skills.json`, saving raw `pickle` files.
- **Why not final:** not referenced anywhere in the codebase, produces no artifact the
  system loads, and duplicates ground covered by the M18/M19 notebooks. Candidate for
  deletion or for `poc_files/`.

## Artifact snapshots (not loaded by anything)

| File | What it is |
|---|---|
| `model_20260704_175947.joblib` | Model 1 versioned snapshot (pre-M06 corpus) |
| `model_20260728_004852.joblib` | Model 1 M06 retrain, first pass |
| `model_20260728_005411.joblib` | Model 1 M06 retrain, final pass (= current `model.joblib`) |
| `model.joblib.bak-20260728` | backup of the pre-M06 production Model 1 |
| `text_to_job_title_classifier_20260701_104013.joblib` | last LogReg-generation classifier (from `tfid.ipynb`) |
| `skills_to_title_20260729_115813.joblib` | M18 round-1 reverse model (2 sources) |
| `skills_to_title_20260729_152942.joblib` | M18 round-2 reverse model (= `skills_to_24_titles.joblib`) |
| `title_normalizer_rebuilt.joblib` | M19/W2 reconstruction output — tied the live normalizer, equivalence gate kept the live artifact |

`train.py` writes `model_<timestamp>.joblib` on every run (`train.py:518`), which is
where the Model 1 snapshots come from; the timestamped classifier/reverse-model files
follow the same convention from their notebooks.
