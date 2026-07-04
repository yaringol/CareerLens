"""Quality gate for promoting a newly trained model to production."""
from __future__ import annotations

import json
import os
from typing import Any


def parse_int_env(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


MIN_TOTAL_RECORDS = parse_int_env('MIN_TOTAL_RECORDS', 200)
MIN_TITLES_WITH_DATA = parse_int_env('MIN_TITLES_WITH_DATA', 8)
MIN_NON_LOW_TITLES = parse_int_env('MIN_NON_LOW_TITLES', 3)
NON_LOW_THRESHOLD = parse_int_env('NON_LOW_THRESHOLD', 50)


def non_low_title_count(counts: dict[str, Any], canonical_titles: list[str]) -> int:
    return sum(
        1 for title in canonical_titles
        if int(counts.get(title, 0)) >= NON_LOW_THRESHOLD
    )


def total_records(counts: dict[str, Any], canonical_titles: list[str]) -> int:
    return sum(int(counts.get(title, 0)) for title in canonical_titles)


def load_baseline_record_counts(
    fdb,
    *,
    model_out: str,
    canonical_titles: list[str],
) -> dict[str, int]:
    """
    Baseline for the quality gate:
    1) last promoted run in model_runs (live pipeline)
    2) optional JSON fallback when BASELINE_FROM_JSON=1 (legacy baked counts)
    """
    runs_coll = fdb[os.getenv('RUNS_COLLECTION', 'model_runs')]
    last_promoted = runs_coll.find_one({'promoted': True}, sort=[('trained_at', -1)])
    if last_promoted and last_promoted.get('record_counts'):
        return {t: int(last_promoted['record_counts'].get(t, 0)) for t in canonical_titles}

    if os.getenv('BASELINE_FROM_JSON', '0').lower() in ('1', 'true', 'yes'):
        json_path = os.path.join(model_out, 'canonical_titles.json')
        if os.path.isfile(json_path):
            with open(json_path, encoding='utf-8') as handle:
                raw = json.load(handle).get('record_counts', {})
            if raw:
                return {t: int(raw.get(t, 0)) for t in canonical_titles}

    return {}


def evaluate_promotion(
    new_counts: dict[str, int],
    baseline_counts: dict[str, int],
    canonical_titles: list[str],
) -> tuple[bool, str]:
    """Return (promoted, reason)."""
    if not baseline_counts:
        new_total = total_records(new_counts, canonical_titles)
        titles_with_data = sum(1 for t in canonical_titles if int(new_counts.get(t, 0)) > 0)
        non_low = non_low_title_count(new_counts, canonical_titles)

        if new_total < MIN_TOTAL_RECORDS:
            return False, f'first promote blocked: total {new_total} < {MIN_TOTAL_RECORDS}'
        if titles_with_data < MIN_TITLES_WITH_DATA:
            return False, (
                f'first promote blocked: titles with data {titles_with_data} '
                f'< {MIN_TITLES_WITH_DATA}'
            )
        if non_low < MIN_NON_LOW_TITLES:
            return False, (
                f'first promote blocked: non_low titles {non_low} '
                f'< {MIN_NON_LOW_TITLES} (threshold={NON_LOW_THRESHOLD})'
            )
        return True, 'first promote (no prior promoted run)'

    old_non_low = non_low_title_count(baseline_counts, canonical_titles)
    new_non_low = non_low_title_count(new_counts, canonical_titles)
    if new_non_low < old_non_low:
        return False, f'non_low titles dropped {old_non_low}->{new_non_low}'

    old_total = total_records(baseline_counts, canonical_titles)
    new_total = total_records(new_counts, canonical_titles)
    if old_total > 0 and new_total < old_total * 0.8:
        return False, f'total records dropped >20% ({old_total}->{new_total})'

    return True, 'ok'
