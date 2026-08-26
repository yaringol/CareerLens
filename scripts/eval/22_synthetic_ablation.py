"""
Synthetic-sensitivity ablation: how much of Model 1's behaviour depends on the
marked 2023H2->2026H1 synthetic continuation?

The ablation artifact is produced by re-running train.py against the real corpus
only. The run is fully isolated from the live system:

  cd ds/model && \
  MONGO_URI=mongodb://localhost:27017/careerlens \
  SOURCE_WEIGHTS=lang-uk-job-skills:1.0 \
  RECENCY_HALF_LIFE_DAYS=365 TREND_WINDOW_DAYS=365 \
  PERSIST_FEATURES=0 \
  MODEL_OUT_DIR=<scratch> \
  python train.py

PERSIST_FEATURES=0 suppresses every Mongo write (model_runs, role_skill_features),
and MODEL_OUT_DIR keeps the artifact out of ds/model — so neither the promotion
baseline nor the served model is touched.

Usage:  python scripts/eval/22_synthetic_ablation.py <path-to-ablation-model.joblib>
Writes: docs/final-sprint/outputs/metrics-raw/22-synthetic-ablation.json
"""
from __future__ import annotations

import collections
import json
import os
import statistics
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, 'ds', 'model'))

import joblib

from skill_schema import compute_role_counts

RAW = os.path.join(REPO, 'docs', 'final-sprint', 'outputs', 'metrics-raw')
LIVE = os.path.join(REPO, 'ds', 'model', 'model.joblib')
ABLATION = sys.argv[1] if len(sys.argv) > 1 else None
if not ABLATION or not os.path.isfile(ABLATION):
    raise SystemExit('pass the path to the real-data-only model.joblib as argv[1]')

ROLES = ['Backend Developer', 'C++ Developer', 'Cyber Security', 'Data Engineer',
         'Data Scientist', 'DevOps Engineer', 'Frontend Developer', 'Java Developer',
         'Product Manager', 'QA Automation Engineer', 'Software Engineer', 'UX Designer']
CAP, FLOOR, MAJORITY = 11, 0.05, 6
# The curated 2024-2026 additions (market_2026_skills.py) the continuation injects.
MARKET_2026 = ['llm', 'rag', 'ai agents', 'generative ai', 'fine tuning', 'gitops',
               'argocd', 'platform engineering', 'llmops', 'playwright',
               'ai assisted testing', 'vector database', 'prompt engineering']


def prepared(path: str) -> tuple[dict, dict, dict]:
    fm = joblib.load(path)['feature_matrix']
    fm = {t: fm[t] for t in ROLES if fm.get(t)}
    serving = compute_role_counts(fm, min_prevalence=FLOOR)
    yardstick = compute_role_counts(fm, min_prevalence=FLOOR)
    pools = {}
    for title, skills in fm.items():
        kept = [(s, f) for s, f in skills.items() if serving.get(s, 0) <= CAP] or list(skills.items())
        pools[title] = sorted(kept, key=lambda kv: -float(kv[1].get('prevalence', 0.0)))[:10]
    return fm, pools, yardstick


def displayed_five(pool: list) -> list[str]:
    return [s for s, _ in sorted(pool, key=lambda kv: -float(kv[1].get('stability_score', 0.5)))[:5]]


def jaccard(a: list[str], b: list[str]) -> float:
    sa, sb = set(a), set(b)
    return round(len(sa & sb) / len(sa | sb), 3) if sa | sb else 1.0


live_fm, live_pools, live_yard = prepared(LIVE)
abl_fm, abl_pools, abl_yard = prepared(ABLATION)

per_role = {}
for title in ROLES:
    l10 = [s for s, _ in live_pools[title]]
    a10 = [s for s, _ in abl_pools.get(title, [])]
    l5, a5 = displayed_five(live_pools[title]), displayed_five(abl_pools.get(title, []))
    lg = sum(1 for s in l10 if live_yard.get(s, 0) >= MAJORITY)
    ag = sum(1 for s in a10 if abl_yard.get(s, 0) >= MAJORITY)
    per_role[title] = {
        'top10_shared': len(set(l10) & set(a10)),
        'top10_jaccard': jaccard(l10, a10),
        'top5_shared': len(set(l5) & set(a5)),
        'top5_jaccard': jaccard(l5, a5),
        'informative_at_10': {'with_synthetic': round(100 - lg / len(l10) * 100, 1),
                              'real_only': round(100 - ag / len(a10) * 100, 1) if a10 else None},
        'live_top5': l5, 'real_only_top5': a5,
        'skills_only_with_synthetic': sorted(set(l10) - set(a10)),
        'skills_only_real_only': sorted(set(a10) - set(l10)),
    }


def trend_counts(fm: dict) -> dict:
    c: collections.Counter = collections.Counter()
    for skills in fm.values():
        for f in skills.values():
            c[f.get('trend', 'stable')] += 1
    return dict(c)


market = {}
for skill in MARKET_2026:
    market[skill] = {
        'roles_present_with_synthetic': sum(1 for t in ROLES if skill in live_fm.get(t, {})),
        'roles_present_real_only': sum(1 for t in ROLES if skill in abl_fm.get(t, {})),
        'in_a_served_top10_with_synthetic': sum(
            1 for t in ROLES if skill in [s for s, _ in live_pools[t]]),
        'in_a_served_top10_real_only': sum(
            1 for t in ROLES if skill in [s for s, _ in abl_pools.get(t, [])]),
    }

out = {
    'ablation_artifact': os.path.basename(ABLATION),
    'training_records': {'with_synthetic': 51349, 'real_only': 40549,
                         'drop_pct': round((51349 - 40549) / 51349 * 100, 1)},
    'promotion_gate': {
        'verdict': 'BLOCKED',
        'reason': 'total records dropped >20% (51349->40549)',
        'note': 'the real-data-only model could not have been promoted by the '
                'projects own quality gate — removing the synthetic continuation '
                'trips the 20% corpus-shrink rule.',
    },
    'per_role': per_role,
    'summary': {
        'mean_top10_jaccard': round(statistics.mean(v['top10_jaccard'] for v in per_role.values()), 3),
        'mean_top5_jaccard': round(statistics.mean(v['top5_jaccard'] for v in per_role.values()), 3),
        'roles_with_identical_top5': sum(1 for v in per_role.values() if v['top5_jaccard'] == 1.0),
        'roles_total': len(ROLES),
        'informative_at_10_with_synthetic': round(statistics.mean(
            v['informative_at_10']['with_synthetic'] for v in per_role.values()), 1),
        'informative_at_10_real_only': round(statistics.mean(
            v['informative_at_10']['real_only'] for v in per_role.values()
            if v['informative_at_10']['real_only'] is not None), 1),
    },
    'trend_labels': {'with_synthetic': trend_counts(live_fm), 'real_only': trend_counts(abl_fm)},
    'market_2026_skills': market,
    'cyber_security_focus': per_role['Cyber Security'],
}

dest = os.path.join(RAW, '22-synthetic-ablation.json')
with open(dest, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)

print('summary', json.dumps(out['summary'], indent=1))
print(f"\n{'role':26s}{'top10 J':>9s}{'top5 J':>8s}{'inf@10 real':>12s}{'inf@10 live':>12s}")
for t in ROLES:
    v = per_role[t]
    print(f"{t:26s}{v['top10_jaccard']:9.3f}{v['top5_jaccard']:8.3f}"
          f"{v['informative_at_10']['real_only'] or -1:12.1f}{v['informative_at_10']['with_synthetic']:12.1f}")
print('\ntrend labels', out['trend_labels'])
print('\n2026 skills reaching a served top-10:',
      {k: (v['in_a_served_top10_real_only'], v['in_a_served_top10_with_synthetic'])
       for k, v in market.items() if v['in_a_served_top10_with_synthetic'] or v['in_a_served_top10_real_only']})
print('\nCyber Security  real-only top5:', per_role['Cyber Security']['real_only_top5'])
print('Cyber Security  live top5     :', per_role['Cyber Security']['live_top5'])
print(f'wrote {dest}')
