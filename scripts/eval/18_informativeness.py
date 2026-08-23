"""
informative@10 / generic-contamination for Model 1 (skill ranking).

official-metrics.md 3.3 states that precision@10 is structurally insensitive to
what M06 actually changed (a ubiquity filter targeting *informativeness*, not
relevance). This is the instrument that measures it, and it needs no annotator.

  ubiquity(skill)   = # of the 12 data-carrying roles where prevalence >= 0.05
  generic@10        = share of a role's top-10 served pool with ubiquity >= 6
  informative@10    = 100 - generic@10

The yardstick (floor 0.05, same 12 roles) is held identical across artifacts, so
the two models are compared on the same scale; only the *serving* filter differs,
because each artifact is read the way it was actually served.

Usage:  python scripts/eval/18_informativeness.py
Writes: docs/final-sprint/outputs/metrics-raw/18-informativeness.json
"""
from __future__ import annotations

import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, 'ds', 'model'))

import joblib

from skill_schema import compute_role_counts

ROLES = ['Backend Developer', 'C++ Developer', 'Cyber Security', 'Data Engineer',
         'Data Scientist', 'DevOps Engineer', 'Frontend Developer', 'Java Developer',
         'Product Manager', 'QA Automation Engineer', 'Software Engineer', 'UX Designer']
YARDSTICK_FLOOR = 0.05
UBIQUITY_MAJORITY = 6   # half of the 12 roles
POOL = 10


def measure(path: str, cap: int, floor: float, label: str) -> dict:
    fm = joblib.load(path)['feature_matrix']
    fm = {t: fm[t] for t in ROLES if fm.get(t)}
    yardstick = compute_role_counts(fm, min_prevalence=YARDSTICK_FLOOR)
    serving = compute_role_counts(fm, min_prevalence=floor)

    per_role = {}
    total = generic = 0
    for title, skills in fm.items():
        kept = [(s, f) for s, f in skills.items() if serving.get(s, 0) <= cap] or list(skills.items())
        pool = sorted(kept, key=lambda kv: -float(kv[1].get('prevalence', 0.0)))[:POOL]
        g = sum(1 for s, _ in pool if yardstick.get(s, 0) >= UBIQUITY_MAJORITY)
        per_role[title] = {'generic': g, 'pool': len(pool), 'top5': [s for s, _ in pool[:5]]}
        total += len(pool)
        generic += g

    return {'label': label, 'artifact': os.path.basename(path), 'ubiquity_cap': cap,
            'role_count_min_prevalence': floor, 'roles': len(fm), 'pool_skills': total,
            'generic': generic, 'generic_at_10_pct': round(generic / total * 100, 1),
            'informative_at_10_pct': round(100 - generic / total * 100, 1),
            'per_role': per_role}


live = os.path.join(REPO, 'ds', 'model', 'model.joblib')
backup = os.path.join(REPO, 'ds', 'model', 'model.joblib.bak-20260728')

out = {
    'definition': {'ubiquity_floor': YARDSTICK_FLOOR, 'majority_roles': UBIQUITY_MAJORITY,
                   'pool': POOL, 'roles': ROLES},
    'results': [
        measure(live, 11, 0.05, 'live model, measured serving config'),
        measure(backup, 48, 0.0, 'pre-M06 backup, as served then'),
        measure(live, 48, 0.0, 'live model under DS default env (no filter)'),
    ],
}
dest = os.path.join(REPO, 'docs', 'final-sprint', 'outputs', 'metrics-raw', '18-informativeness.json')
with open(dest, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)
for r in out['results']:
    print(f"{r['label']:44s} informative@10 {r['informative_at_10_pct']:5.1f}%  "
          f"(generic {r['generic']}/{r['pool_skills']})")
print(f'wrote {dest}')
