"""
Product-path metrics: how the title ladder actually resolves a CV, and the full
paired picture behind the scoring agent's band separation.

Both read existing raw files — no model or API calls.

Usage:  python scripts/eval/21_product_path.py
Writes: docs/final-sprint/outputs/metrics-raw/21-product-path.json
"""
from __future__ import annotations

import collections
import itertools
import json
import os
import statistics

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(REPO, 'docs', 'final-sprint', 'outputs', 'metrics-raw')
AUTO_ACCEPT = 60          # frontend AUTO_MATCH_CONFIDENCE_MIN
BAND_RANK = {'matched': 2, 'adjacent': 1, 'mismatched': 0}


def jsonl(name: str) -> list[dict]:
    with open(os.path.join(RAW, name), encoding='utf-8') as fh:
        return [json.loads(line) for line in fh if line.strip()]


# ── 1. Model 2 route distribution ───────────────────────────────────────────
rows = jsonl('01-title-benchmark-on.jsonl')
scored = [r for r in rows if not r.get('is_negative_fixture')]
negatives = [r for r in rows if r.get('is_negative_fixture')]

def is_correct(row: dict, *, strict_none: bool) -> bool:
    """Two defensible scoring rules; the corpus disagrees with itself on one fixture.

    'lenient' — the prediction is in the manifest's acceptable_titles.
    'strict'  — plus: a CV whose ground truth is `none` counts as correct only if the
                system did NOT auto-accept a role, which is the rule official-metrics
                1.1 states in prose. gamedev-mid-none carries true_title='none' AND a
                non-empty acceptable list, so the two rules disagree on it: 26/29 vs
                25/29. Both are reported rather than silently picking one.
    """
    ladder = row.get('ladder') or {}
    predicted = ladder.get('canonical_title')
    if strict_none and (row.get('true_title') or '').lower() == 'none':
        return float(ladder.get('confidence') or 0) < AUTO_ACCEPT
    return predicted in set(row.get('acceptable_titles') or [])


routes: collections.Counter = collections.Counter()
route_correct: collections.Counter = collections.Counter()
for r in scored:
    source = (r.get('ladder') or {}).get('source') or 'no_resolution'
    routes[source] += 1
    if is_correct(r, strict_none=False):
        route_correct[source] += 1

auto = [r for r in scored if ((r.get('ladder') or {}).get('confidence') or 0) >= AUTO_ACCEPT]
manual = [r for r in scored if r not in auto]
auto_correct = sum(1 for r in auto if is_correct(r, strict_none=False))
auto_correct_strict = sum(1 for r in auto if is_correct(r, strict_none=True))

out: dict = {
    'title_ladder': {
        'scored_cvs': len(scored),
        'negative_fixtures': len(negatives),
        'routes': {
            source: {
                'cvs': n,
                'pct_of_scored': round(n / len(scored) * 100, 1),
                'correct': route_correct[source],
                'accuracy_pct': round(route_correct[source] / n * 100, 1),
            }
            for source, n in routes.most_common()
        },
        'top1_accuracy': {
            'lenient_rule': f'{sum(1 for r in scored if is_correct(r, strict_none=False))}/{len(scored)}',
            'strict_none_rule': f'{sum(1 for r in scored if is_correct(r, strict_none=True))}/{len(scored)}',
        },
        'auto_accept': {
            'threshold': AUTO_ACCEPT,
            'auto_accepted': len(auto),
            'coverage_pct': round(len(auto) / len(scored) * 100, 1),
            'precision_pct': round(auto_correct / len(auto) * 100, 1),
            'precision_strict_none_pct': round(auto_correct_strict / len(auto) * 100, 1),
            'escalated_to_manual_picker': len(manual),
            'escalation_pct': round(len(manual) / len(scored) * 100, 1),
        },
        'note': 'LLM-fallback firing rate is measured separately in 06-signal-verdict.json '
                '(2/29 on this corpus); it is a backend decision the benchmark does not re-derive.',
    }
}

# ── 2. Scoring agent — the full paired picture ──────────────────────────────
pairs = jsonl('11-pair-scores.jsonl')
by_cv: dict[str, dict[str, float]] = collections.defaultdict(dict)
for p in pairs:
    by_cv[p['cv_file']][p['band']] = p['matchScore']

deltas = [b['matched'] - b['mismatched'] for b in by_cv.values()
          if 'matched' in b and 'mismatched' in b]
concordant = discordant = tied = 0
for bands in by_cv.values():
    for x, y in itertools.combinations(bands, 2):
        if BAND_RANK[x] == BAND_RANK[y]:
            continue
        hi, lo = (x, y) if BAND_RANK[x] > BAND_RANK[y] else (y, x)
        if bands[hi] > bands[lo]:
            concordant += 1
        elif bands[hi] == bands[lo]:
            tied += 1
        else:
            discordant += 1

total_pairs = concordant + discordant + tied
band_scores: dict[str, list[float]] = collections.defaultdict(list)
for p in pairs:
    band_scores[p['band']].append(p['matchScore'])

out['scoring_agent'] = {
    'cvs': len(by_cv),
    'pairs_scored': len(pairs),
    'band_means': {b: round(statistics.mean(v), 2) for b, v in sorted(band_scores.items())},
    'pairwise_ranking': {
        'comparisons': total_pairs,
        'concordant': concordant,
        'tied': tied,
        'discordant': discordant,
        'accuracy_pct': round(concordant / total_pairs * 100, 1),
        'accuracy_excluding_ties_pct': round(concordant / (concordant + discordant) * 100, 1),
        'inversion_rate_pct': round(discordant / total_pairs * 100, 1),
    },
    'matched_minus_mismatched': {
        'n': len(deltas),
        'mean': round(statistics.mean(deltas), 2),
        'median': round(statistics.median(deltas), 2),
        'min': round(min(deltas), 2),
        'max': round(max(deltas), 2),
        'positive': sum(1 for d in deltas if d > 0),
        'zero': sum(1 for d in deltas if d == 0),
        'negative': sum(1 for d in deltas if d < 0),
    },
}

dest = os.path.join(RAW, '21-product-path.json')
with open(dest, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)
print(json.dumps(out, indent=2))
print(f'wrote {dest}')
