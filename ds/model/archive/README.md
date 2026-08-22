# ds/model/archive — Superseded & Research Notebooks

Nothing in this folder is loaded, run, or parsed by any part of the system. Each
notebook is kept as provenance of a model generation or a research round that shaped
the four production models in [`ds/final/`](../../final/README.md). The full
supersession story is in [`NOT_IN_FINAL.md`](../NOT_IN_FINAL.md).

| Notebook | What it was | Superseded by |
|---|---|---|
| `training.ipynb` | First-generation Model 1 (title→skills) training over the scraped linkedin/alljobs corpora | `ds/model/train.py` driven by `ds/final/model1_retrain.ipynb` (M06) |
| `tfid.ipynb` | Previous-generation CV→title trainer (38-class TF-IDF + LogReg) | `ds/final/train_cv_classifier.py` (59-class TF-IDF + MLP, the deployed artifact) |
| `skills_to_24_titles.ipynb` | M18 reverse skills→title research (24 classes, no rejection); produced the agreement-signal finding that M19 shipped | `ds/final/skills_to_24_plus_other.ipynb` (adds the `__other__` rejection class) |
| `Copy_of_CV_to_title.ipynb` | Colab scratch experiment on title prediction; produced no artifact the system loads | M18/M19 notebooks |
| `model1_retrain (1).ipynb`, `model1_retrain (2).ipynb`, `model1_retrain_only_delta.ipynb` | Colab download copies of the M06 retrain notebook from the 2026-08-20 session, with executed outputs. A scratch note (`Untitled`) marked `(2)` as the good run; its content was consolidated into the canonical notebook | `ds/final/model1_retrain.ipynb` (saved later the same day; contains everything in `(2)` plus the `NIGHTLY_TRAINING_CONFIG` cell that `pipeline/nightly_config.py` parses) |

Do not point the nightly pipeline or any doc at these copies — the only citable
Model 1 trainer is `ds/final/model1_retrain.ipynb`.
