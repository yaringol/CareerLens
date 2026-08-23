"""
Per-skill stability score: the slope of a skill's monthly occurrence over time,
fit from each job posting's own datePosted spread within a single training run -
no dependency on multiple calendar-spaced training runs or a scraper cron.

Factored out of train.py (which executes a live pipeline at import time, including
a MongoDB connection) so this pure function can be unit-tested directly against a
hand-built fixture - see test_stability.py.
"""
import numpy as np

# A (title, skill) pair needs data in >= MIN_RELIABLE_MONTHS distinct months to get
# a real score; below that it gets a neutral default + reliable=False.
MIN_RELIABLE_MONTHS     = 3
NEUTRAL_STABILITY_SCORE = 0.5
NEUTRAL_GROWTH_TREND    = 0.0


def _neutral_rows(role_skill_month_counts_for_title, history_months):
    return {
        skill: {
            'growth_trend': NEUTRAL_GROWTH_TREND,
            'stability_score': NEUTRAL_STABILITY_SCORE,
            'time_features_reliable': False,
            'history_months': history_months,
        }
        for skill in role_skill_month_counts_for_title
    }


def compute_stability_features(canonical_titles, role_skill_month_counts, role_month_totals):
    """
    Per (title, skill): fit a linear slope of monthly prevalence (skill-count /
    month-total-postings) over the postings' own datePosted spread within THIS
    training run.

    Args:
        canonical_titles: iterable of canonical title strings to compute for.
        role_skill_month_counts: {title: {skill: {month_key: count}}}
        role_month_totals: {title: {month_key: count}}

    Returns fm_stability[title][skill] = {
        'growth_trend':           float in [-1, 1],
        'stability_score':        float in [0, 1]  (0 = flat/stable, 1 = steep/trendy),
        'time_features_reliable': bool,
        'history_months':         int,
    }

    Reliability gate: a (title, skill) pair needs data in >= MIN_RELIABLE_MONTHS
    distinct months (the skill itself must be nonzero in that many months, not
    just "the title has that many months of history"). Below the threshold,
    values are neutral defaults with reliable=False rather than a noisy number.

    Normalization: percentile-rank of raw slope WITHIN the title's own reliable
    candidate pool, not a fixed sigmoid/tanh squash of the raw slope. Posting
    volume varies hugely per title, so a single global squash constant would
    mean different things for different titles; percentile-rank is scale-free
    by construction and matches the feature's inherently relative framing
    ("stable relative to this role's other skills").
    """
    fm_stability = {}
    for title in canonical_titles:
        months = sorted(role_month_totals.get(title, {}))
        skill_month_counts = role_skill_month_counts.get(title, {})
        if len(months) < MIN_RELIABLE_MONTHS:
            fm_stability[title] = _neutral_rows(skill_month_counts, len(months))
            continue

        month_totals = role_month_totals[title]
        month_index = {m: i for i, m in enumerate(months)}
        x = np.array([month_index[m] for m in months], dtype=float)

        raw_slopes = {}
        for skill, month_counts in skill_month_counts.items():
            y = np.array([
                month_counts.get(m, 0) / max(month_totals[m], 1)
                for m in months
            ], dtype=float)
            nonzero_months = int(np.count_nonzero(y))
            if nonzero_months < MIN_RELIABLE_MONTHS:
                continue
            slope, _intercept = np.polyfit(x, y, 1)
            raw_slopes[skill] = float(slope)

        if not raw_slopes:
            fm_stability[title] = _neutral_rows(skill_month_counts, len(months))
            continue

        # Percentile-rank the raw slopes within this title's reliable pool.
        skills_ranked = sorted(raw_slopes, key=lambda s: raw_slopes[s])
        n = len(skills_ranked)
        percentile = {
            skill: (idx / (n - 1) if n > 1 else 0.5)
            for idx, skill in enumerate(skills_ranked)
        }
        max_abs_slope = max(abs(s) for s in raw_slopes.values()) or 1e-9

        rows = {}
        for skill in skill_month_counts:
            if skill in raw_slopes:
                rows[skill] = {
                    'growth_trend': float(np.clip(raw_slopes[skill] / max_abs_slope, -1.0, 1.0)),
                    'stability_score': round(float(percentile[skill]), 4),
                    'time_features_reliable': True,
                    'history_months': len(months),
                }
            else:
                rows[skill] = {
                    'growth_trend': NEUTRAL_GROWTH_TREND,
                    'stability_score': NEUTRAL_STABILITY_SCORE,
                    'time_features_reliable': False,
                    'history_months': len(months),
                }
        fm_stability[title] = rows
    return fm_stability
