#!/usr/bin/env python
"""
Emit the nightly training configuration as shell `export` lines.

`ds/final/model1_retrain.ipynb` is the source of truth for how Model 1 is
trained. The notebook is where the configuration is reasoned about - section 5
explains why the half-life and the trend window are 365 rather than the shipped
14/7 defaults - so the nightly pipeline reads its values out of the notebook
instead of keeping a second copy that can silently drift out of step with it.

The notebook is parsed, never executed: the config cell is located by the
`NIGHTLY_TRAINING_CONFIG = {...}` assignment and evaluated with
`ast.literal_eval`, so nothing in the notebook runs and no Mongo connection is
opened.

Usage (from run_daily.sh):

    eval "$(python /app/nightly_config.py)"

Or against an explicit path, for local checks:

    python pipeline/nightly_config.py ds/final/model1_retrain.ipynb
"""
from __future__ import annotations

import ast
import json
import os
import shlex
import sys

CONFIG_NAME = "NIGHTLY_TRAINING_CONFIG"

# In the pipeline image the notebook sits beside this script (see pipeline/Dockerfile);
# in a checkout it sits in ds/final. Try both so the same script works in either place.
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PATHS = (
    os.path.join(HERE, "model1_retrain.ipynb"),
    os.path.join(HERE, os.pardir, "ds", "final", "model1_retrain.ipynb"),
)


def find_notebook(argv: list[str]) -> str:
    if len(argv) > 1:
        return argv[1]
    for path in DEFAULT_PATHS:
        if os.path.isfile(path):
            return path
    raise SystemExit(
        "nightly_config: notebook not found; tried " + ", ".join(DEFAULT_PATHS)
    )


def extract(path: str) -> dict[str, str]:
    with open(path, encoding="utf-8") as handle:
        nb = json.load(handle)

    for cell in nb.get("cells", []):
        if cell.get("cell_type") != "code":
            continue
        source = "".join(cell.get("source", []))
        if CONFIG_NAME not in source:
            continue
        try:
            tree = ast.parse(source)
        except SyntaxError:
            continue
        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            names = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if CONFIG_NAME not in names:
                continue
            config = ast.literal_eval(node.value)
            if not isinstance(config, dict):
                raise SystemExit(f"nightly_config: {CONFIG_NAME} is not a dict")
            return {str(k): str(v) for k, v in config.items()}

    raise SystemExit(f"nightly_config: no {CONFIG_NAME} assignment in {path}")


def main(argv: list[str]) -> int:
    path = find_notebook(argv)
    config = extract(path)
    if not config:
        raise SystemExit(f"nightly_config: {CONFIG_NAME} is empty in {path}")

    # Existing environment wins, so an operator can still override a single value
    # for one run without editing the notebook.
    for key, value in config.items():
        print(f"export {key}=${{{key}:-{shlex.quote(value)}}}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
