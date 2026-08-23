"""
Model 1 in depth: per-role informative@10, the top-5 the user actually sees,
relevance@5 from the existing blind labels, environment sensitivity of the
displayed list, and Stable/Balanced/Trending preset separation.

Everything here reads artifacts and existing label files — no new annotation.

  ubiquity(skill) = # of the 12 data-carrying roles where prevalence >= 0.05
  generic         = ubiquity >= 6 (half the roles)
  informative@k   = 100 - generic@k

The displayed lists replicate the product exactly:
  /title/skills          top-10 by prevalence, re-sorted by stability_score, take 5
  /title/trending-skills top-n by prevalence
  personalization core   /title/trending-skills top-10, then min |stability - pref|,
                         tie-broken by prevalence (personalization.service.ts)
                         pref: stable=0.2, balanced=0.5, trending=0.8

Usage:  python scripts/eval/20_model1_depth.py
Writes: docs/final-sprint/outputs/metrics-raw/20-model1-depth.json
"""
from __future__ import annotations

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
BACKUP = os.path.join(REPO, 'ds', 'model', 'model.joblib.bak-20260728')

ROLES = ['Backend Developer', 'C++ Developer', 'Cyber Security', 'Data Engineer',
         'Data Scientist', 'DevOps Engineer', 'Frontend Developer', 'Java Developer',
         'Product Manager', 'QA Automation Engineer', 'Software Engineer', 'UX Designer']
YARDSTICK_FLOOR = 0.05
MAJORITY = 6
PRESETS = {'stable': 0.2, 'balanced': 0.5, 'trending': 0.8}


def load(path: str) -> dict:
    fm = joblib.load(path)['feature_matrix']
    return {t: fm[t] for t in ROLES if fm.get(t)}


def pools(fm: dict, cap: int, floor: float, size: int = 10) -> dict[str, list]:
    """Ubiquity-filtered top-`size` by prevalence — the candidate pool both endpoints use."""
    serving = compute_role_counts(fm, min_prevalence=floor)
    out = {}
    for title, skills in fm.items():
        kept = [(s, f) for s, f in skills.items() if serving.get(s, 0) <= cap] or list(skills.items())
        out[title] = sorted(kept, key=lambda kv: -float(kv[1].get('prevalence', 0.0)))[:size]
    return out


def displayed_five(pool: list) -> list[str]:
    """/title/skills: re-sort the prevalence pool by stability_score, take 5."""
    return [s for s, _ in sorted(pool, key=lambda kv: -float(kv[1].get('stability_score', 0.5)))[:5]]


def preset_five(pool: list, preference: float) -> list[str]:
    ranked = sorted(
        pool,
        key=lambda kv: (abs(float(kv[1].get('stability_score', 0.5)) - preference),
                        -float(kv[1].get('prevalence', 0.0))),
    )
    return [s for s, _ in ranked[:5]]


def jaccard(a: list[str], b: list[str]) -> float:
    sa, sb = set(a), set(b)
    return round(len(sa & sb) / len(sa | sb), 3) if sa | sb else 1.0


out: dict = {'definition': {'ubiquity_floor': YARDSTICK_FLOOR, 'majority_roles': MAJORITY,
                            'presets': PRESETS, 'roles': ROLES}}

# ── 1. informative@10 and @5, per role, live vs pre-M06 ──────────────────────
live_fm, backup_fm = load(LIVE), load(BACKUP)
live_yard = compute_role_counts(live_fm, min_prevalence=YARDSTICK_FLOOR)
backup_yard = compute_role_counts(backup_fm, min_prevalence=YARDSTICK_FLOOR)

live_pool = pools(live_fm, cap=11, floor=0.05)
backup_pool = pools(backup_fm, cap=48, floor=0.0)
default_pool = pools(live_fm, cap=48, floor=0.0)   # live artifact, DS default env


def generic_count(skills: list[str], yardstick: dict) -> int:
    return sum(1 for s in skills if yardstick.get(s, 0) >= MAJORITY)


per_role = {}
for title in ROLES:
    lp = [s for s, _ in live_pool[title]]
    bp = [s for s, _ in backup_pool[title]]
    l5, b5 = displayed_five(live_pool[title]), displayed_five(backup_pool[title])
    lg10, bg10 = generic_count(lp, live_yard), generic_count(bp, backup_yard)
    lg5, bg5 = generic_count(l5, live_yard), generic_count(b5, backup_yard)
    per_role[title] = {
        'live_top10': lp, 'live_displayed5': l5,
        'informative_at_10': {'live': round(100 - lg10 / len(lp) * 100, 1),
                              'pre_m06': round(100 - bg10 / len(bp) * 100, 1)},
        'informative_at_5': {'live': round(100 - lg5 / len(l5) * 100, 1),
                             'pre_m06': round(100 - bg5 / len(b5) * 100, 1)},
    }
    for k in ('informative_at_10', 'informative_at_5'):
        per_role[title][k]['delta_pp'] = round(
            per_role[title][k]['live'] - per_role[title][k]['pre_m06'], 1)

def aggregate(key: str) -> dict:
    live_v = [per_role[t][key]['live'] for t in ROLES]
    pre_v = [per_role[t][key]['pre_m06'] for t in ROLES]
    deltas = [per_role[t][key]['delta_pp'] for t in ROLES]
    return {
        'live': round(statistics.mean(live_v), 1),
        'pre_m06': round(statistics.mean(pre_v), 1),
        'delta_pp': round(statistics.mean(deltas), 1),
        'roles_improved': sum(1 for d in deltas if d > 0),
        'roles_unchanged': sum(1 for d in deltas if d == 0),
        'roles_regressed': sum(1 for d in deltas if d < 0),
        'min_delta_pp': min(deltas), 'max_delta_pp': max(deltas),
    }


out['informativeness'] = {'per_role': per_role,
                          'at_10': aggregate('informative_at_10'),
                          'at_5': aggregate('informative_at_5')}

# ── 2. relevance@5 vs relevance@10 from the existing blind labels ────────────
labels = json.load(open(os.path.join(RAW, '15-precision-labels.json'), encoding='utf-8'))['labels']
key = json.load(open(os.path.join(RAW, '14-precision-key.json'), encoding='utf-8'))
key_by_title = {e['title']: e for e in key['entries']}

rel = {'per_role': {}}
for scope, picker in (('at_10', lambda t, m: key_by_title[t][f'{m}_top10']),
                      ('at_5', lambda t, m: displayed_five(
                          live_pool[t] if m == 'live' else backup_pool[t]))):
    for model in ('live', 'backup'):
        hit = tot = unlabelled = 0
        for title in ROLES:
            if title not in key_by_title:
                continue
            marks = {k.lower(): v for k, v in labels.get(title, {}).items()}
            for skill in picker(title, model):
                mark = marks.get(skill.lower())
                if mark is None:
                    unlabelled += 1
                    continue
                tot += 1
                hit += 1 if mark == 'yes' else 0
        rel.setdefault(scope, {})[model] = {
            'relevant': hit, 'labelled': tot,
            'pct': round(hit / tot * 100, 1) if tot else None,
            'unlabelled_skipped': unlabelled,
        }
out['relevance'] = rel

# ── 3. environment sensitivity of the displayed list ────────────────────────
changed = []
overlaps = []
for title in ROLES:
    served = displayed_five(live_pool[title])
    default = displayed_five(default_pool[title])
    j = jaccard(served, default)
    overlaps.append(j)
    if set(served) != set(default):
        changed.append({'title': title, 'measured_config': served, 'default_config': default,
                        'jaccard': j, 'skills_changed': len(set(served) - set(default))})
out['environment_sensitivity'] = {
    'roles_with_changed_top5': len(changed),
    'roles_total': len(ROLES),
    'mean_jaccard': round(statistics.mean(overlaps), 3),
    'mean_skills_changed_per_role': round(
        statistics.mean([len(set(displayed_five(live_pool[t])) - set(displayed_five(default_pool[t])))
                         for t in ROLES]), 2),
    'details': changed,
}

# ── 4. Stable / Balanced / Trending preset separation ───────────────────────
preset_rows = {}
pairs = {('stable', 'trending'): [], ('stable', 'balanced'): [], ('balanced', 'trending'): []}
identical_st = 0
for title in ROLES:
    lists = {name: preset_five(live_pool[title], pref) for name, pref in PRESETS.items()}
    preset_rows[title] = lists
    for a, b in pairs:
        pairs[(a, b)].append(jaccard(lists[a], lists[b]))
    if set(lists['stable']) == set(lists['trending']):
        identical_st += 1
out['presets'] = {
    'per_role': preset_rows,
    'mean_jaccard': {f'{a}_vs_{b}': round(statistics.mean(v), 3) for (a, b), v in pairs.items()},
    'roles_where_stable_equals_trending': identical_st,
    'roles_total': len(ROLES),
    'mean_stability_of_selected': {
        name: round(statistics.mean([
            float(dict(live_pool[t])[s].get('stability_score', 0.5))
            for t in ROLES for s in preset_rows[t][name]]), 3)
        for name in PRESETS
    },
}

dest = os.path.join(RAW, '20-model1-depth.json')
with open(dest, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)

print('informative@10', out['informativeness']['at_10'])
print('informative@5 ', out['informativeness']['at_5'])
print(f"\n{'role':26s}{'inf@10 pre':>11s}{'live':>7s}{'delta':>7s}{'inf@5 pre':>11s}{'live':>7s}{'delta':>7s}")
for t in ROLES:
    a, b = per_role[t]['informative_at_10'], per_role[t]['informative_at_5']
    print(f"{t:26s}{a['pre_m06']:11.1f}{a['live']:7.1f}{a['delta_pp']:+7.1f}"
          f"{b['pre_m06']:11.1f}{b['live']:7.1f}{b['delta_pp']:+7.1f}")
print('\nrelevance', json.dumps(out['relevance']['at_10']), json.dumps(out['relevance']['at_5']))
print('env sensitivity:', out['environment_sensitivity']['roles_with_changed_top5'], '/12 roles change,',
      'mean jaccard', out['environment_sensitivity']['mean_jaccard'])
print('presets:', out['presets']['mean_jaccard'],
      'identical stable==trending:', out['presets']['roles_where_stable_equals_trending'], '/12')
print('mean stability of selected:', out['presets']['mean_stability_of_selected'])
print(f'wrote {dest}')
