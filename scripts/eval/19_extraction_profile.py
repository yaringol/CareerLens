"""
Extraction profile: usability thresholds, per-role density, per-role real/synthetic
contribution, and role imbalance before/after the sampling cap.

Sharpens the single "97.7% yielded >=1 skill" figure from 17_data_funnel.py into a
usability curve, and exposes the per-role variance that the corpus-level medians hide.

Usage:  MONGO_URI=mongodb://localhost:27017/careerlens python scripts/eval/19_extraction_profile.py
Writes: docs/final-sprint/outputs/metrics-raw/19-extraction-profile.json
"""
from __future__ import annotations

import collections
import json
import os
import statistics
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, 'ds', 'model'))

from pymongo import MongoClient

from lang_uk_mapping import MIN_DESCRIPTION_LEN, map_primary_keyword

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/careerlens')
THRESHOLDS = (1, 5, 10, 15, 20, 25)

db = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000).get_default_database()


def quantile(sorted_values: list[int], p: float) -> int:
    return sorted_values[min(len(sorted_values) - 1, int(len(sorted_values) * p))]


def gini(values: list[int]) -> float:
    """Standard Gini over per-role posting counts; 0 = perfectly balanced."""
    xs = sorted(values)
    n = len(xs)
    total = sum(xs)
    if n == 0 or total == 0:
        return 0.0
    cum = sum((2 * (i + 1) - n - 1) * x for i, x in enumerate(xs))
    return round(cum / (n * total), 4)


def spread(values: list[int]) -> dict:
    return {
        'min': min(values), 'median': int(statistics.median(values)), 'max': max(values),
        'max_over_min': round(max(values) / min(values), 1),
        'coefficient_of_variation': round(statistics.pstdev(values) / statistics.mean(values), 3),
        'gini': gini(values),
    }


# --- per-posting skill counts, corpus-wide and per role ----------------------
per_role_counts: dict[str, list[int]] = collections.defaultdict(list)
per_role_zero: collections.Counter = collections.Counter()
all_counts: list[int] = []

for d in db['lang-uk-job-skills'].find({}, {'skill_records': 1, 'og_title': 1}):
    k = len(d.get('skill_records') or [])
    role = d.get('og_title')
    per_role_counts[role].append(k)
    all_counts.append(k)
    if k == 0:
        per_role_zero[role] += 1

n_total = len(all_counts)
curve = {
    f'at_least_{t}': {
        'postings': sum(1 for c in all_counts if c >= t),
        'pct': round(sum(1 for c in all_counts if c >= t) / n_total * 100, 1),
    }
    for t in THRESHOLDS
}

by_role = {}
for role, counts in per_role_counts.items():
    counts = sorted(counts)
    n = len(counts)
    by_role[role] = {
        'postings': n,
        'median': int(statistics.median(counts)),
        'mean': round(statistics.mean(counts), 1),
        'p25': quantile(counts, .25),
        'p75': quantile(counts, .75),
        'extraction_failure_rate_pct': round(per_role_zero[role] / n * 100, 2),
        'pct_at_least_5': round(sum(1 for c in counts if c >= 5) / n * 100, 1),
        'pct_at_least_10': round(sum(1 for c in counts if c >= 10) / n * 100, 1),
        'pct_at_least_15': round(sum(1 for c in counts if c >= 15) / n * 100, 1),
    }

# --- real vs synthetic contribution per role ---------------------------------
real_docs: collections.Counter = collections.Counter()
real_obs: collections.Counter = collections.Counter()
for d in db['lang-uk-job-skills'].find({}, {'skill_records': 1, 'og_title': 1}):
    real_docs[d.get('og_title')] += 1
    real_obs[d.get('og_title')] += len(d.get('skill_records') or [])

syn_docs: collections.Counter = collections.Counter()
syn_obs: collections.Counter = collections.Counter()
for d in db['augmented-2026'].find({}, {'skill_records': 1, 'og_title': 1}):
    syn_docs[d.get('og_title')] += 1
    syn_obs[d.get('og_title')] += len(d.get('skill_records') or [])

contribution = {}
for role in sorted(real_docs):
    r, s = real_docs[role], syn_docs[role]
    ro, so = real_obs[role], syn_obs[role]
    contribution[role] = {
        'real_records': r, 'synthetic_records': s,
        'synthetic_pct': round(s / (r + s) * 100, 1),
        'real_observations': ro, 'synthetic_observations': so,
        'synthetic_observation_pct': round(so / (ro + so) * 100, 1),
        'total_observations': ro + so,
    }

# --- role imbalance before and after the sampling cap ------------------------
before: collections.Counter = collections.Counter()
for d in db['lang-uk-job'].find({}, {'Primary Keyword': 1, 'Long Description': 1}):
    canonical = map_primary_keyword((d.get('Primary Keyword') or '').strip())
    if canonical is None:
        continue
    if len((d.get('Long Description') or '').strip()) < MIN_DESCRIPTION_LEN:
        continue
    before[canonical] += 1

out = {
    'usability_curve': curve,
    'by_role': by_role,
    'real_vs_synthetic': contribution,
    'role_imbalance': {
        'before_cap': {'per_role': dict(before.most_common()), **spread(list(before.values()))},
        'after_cap': {'per_role': dict(real_docs.most_common()), **spread(list(real_docs.values()))},
    },
}

dest = os.path.join(REPO, 'docs', 'final-sprint', 'outputs', 'metrics-raw',
                    '19-extraction-profile.json')
with open(dest, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)

print('usability curve:', {k: v['pct'] for k, v in curve.items()})
print(f"\n{'role':26s}{'n':>6s}{'med':>5s}{'p25':>5s}{'p75':>5s}{'fail%':>7s}{'>=5%':>7s}{'>=10%':>7s}{'>=15%':>7s}")
for role, v in sorted(by_role.items(), key=lambda kv: -kv[1]['median']):
    print(f"{role:26s}{v['postings']:6d}{v['median']:5d}{v['p25']:5d}{v['p75']:5d}"
          f"{v['extraction_failure_rate_pct']:7.2f}{v['pct_at_least_5']:7.1f}"
          f"{v['pct_at_least_10']:7.1f}{v['pct_at_least_15']:7.1f}")
print('\nimbalance before cap:', out['role_imbalance']['before_cap']['gini'],
      'after cap:', out['role_imbalance']['after_cap']['gini'])
print(f'wrote {dest}')
