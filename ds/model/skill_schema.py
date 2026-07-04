"""
Unified skill schema for normalized job collections (jobs, lang-uk-job-skills).

Job document fields:
  skills         - legacy SkillNer raw (full_matches / ngram_matches)
  skill_records  - normalized list with observed_at per skill

role_skill_features stores per (run, title, skill): prevalence, stability_score, ...
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable, Optional

MatchType = str

DEFAULT_STABILITY = 0.5
MIN_OBSERVATIONS_FOR_STABILITY = 2
MIN_WEEK_BUCKETS_FOR_STABILITY = 2


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith('Z'):
            text = text[:-1] + '+00:00'
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return None
    return None


def resolve_date_posted(item: dict[str, Any]) -> Optional[datetime]:
    """True job posting date (datePosted only). Null when unknown."""
    return _parse_dt(item.get('datePosted'))


def resolve_scraped_at(item: dict[str, Any]) -> Optional[datetime]:
    """When the job posting was scraped. Null when unknown."""
    return _parse_dt(item.get('scraped_at'))


def resolve_extracted_at(item: dict[str, Any]) -> Optional[datetime]:
    """When SkillNer extraction ran on this job. Null when unknown."""
    return _parse_dt(item.get('extracted_at'))


def resolve_observed_at(item: dict[str, Any]) -> Optional[datetime]:
    """Primary timeline for stability/recency: datePosted, else scraped_at, else extracted_at."""
    for key in ('datePosted', 'scraped_at', 'extracted_at'):
        parsed = _parse_dt(item.get(key))
        if parsed is not None:
            return parsed
    return None


def normalize_skill_name(raw: str, normalizer: Optional[Callable[[str], str]] = None) -> str:
    sk = raw.lower().strip()
    return normalizer(sk) if normalizer else sk


def build_skill_records(
    item: dict[str, Any],
    *,
    canonical: Optional[str] = None,
    normalizer: Optional[Callable[[str], str]] = None,
    is_valid: Optional[Callable[[str, Optional[str]], bool]] = None,
    force_rebuild: bool = False,
) -> list[dict[str, Any]]:
    existing = item.get('skill_records')
    if not force_rebuild and isinstance(existing, list) and existing:
        return existing

    skills = item.get('skills') or {}
    date_posted = resolve_date_posted(item)
    scraped_at = resolve_scraped_at(item)
    extracted_at = resolve_extracted_at(item)
    observed_at = resolve_observed_at(item)
    full_raw = {m.get('doc_node_value', '').lower() for m in skills.get('full_matches', [])}
    scores: dict[str, tuple[float, MatchType]] = {}

    for raw in full_raw:
        if not raw:
            continue
        sk = normalize_skill_name(raw, normalizer)
        if is_valid and not is_valid(sk, canonical):
            continue
        scores[sk] = (1.0, 'full_match')

    for m in skills.get('ngram_matches', []):
        raw = (m.get('doc_node_value') or '').lower()
        if not raw or raw in full_raw:
            continue
        score = float(m.get('score', 0.5))
        if score < 0.75:
            continue
        sk = normalize_skill_name(raw, normalizer)
        if is_valid and not is_valid(sk, canonical):
            continue
        prev = scores.get(sk)
        if prev is None or score > prev[0]:
            scores[sk] = (score, 'ngram')

    return [
        {
            'skill': sk,
            'score': round(score, 4),
            'match_type': match_type,
            'datePosted': date_posted,
            'scraped_at': scraped_at,
            'extracted_at': extracted_at,
            'observed_at': observed_at,
        }
        for sk, (score, match_type) in scores.items()
    ]


def weighted_scores_from_records(records: list[dict[str, Any]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for rec in records:
        sk = rec.get('skill')
        if not sk:
            continue
        out[str(sk)] = out.get(str(sk), 0.0) + float(rec.get('score', 1.0))
    return out


def week_bucket(dt: datetime) -> tuple[int, int]:
    iso = dt.astimezone(timezone.utc).isocalendar()
    return (iso.year, iso.week)


def compute_stability_score(observation_dates: list[datetime]) -> dict[str, Any]:
    if len(observation_dates) < MIN_OBSERVATIONS_FOR_STABILITY:
        return {
            'stability_score': DEFAULT_STABILITY,
            'observation_count': len(observation_dates),
            'observation_weeks': 0,
            'time_coverage_reliable': False,
        }

    weekly: dict[tuple[int, int], int] = defaultdict(int)
    for dt in observation_dates:
        weekly[week_bucket(dt)] += 1

    week_count = len(weekly)
    if week_count < MIN_WEEK_BUCKETS_FOR_STABILITY:
        return {
            'stability_score': DEFAULT_STABILITY,
            'observation_count': len(observation_dates),
            'observation_weeks': week_count,
            'time_coverage_reliable': False,
        }

    counts = list(weekly.values())
    mean = sum(counts) / len(counts)
    if mean <= 0:
        stability = 0.0
    else:
        variance = sum((c - mean) ** 2 for c in counts) / len(counts)
        cv = math.sqrt(variance) / mean
        stability = max(0.0, min(1.0, 1.0 - cv))

    sorted_dates = sorted(observation_dates)
    return {
        'stability_score': round(stability, 4),
        'observation_count': len(observation_dates),
        'observation_weeks': week_count,
        'first_observed_at': sorted_dates[0],
        'last_observed_at': sorted_dates[-1],
        'time_coverage_reliable': week_count >= MIN_WEEK_BUCKETS_FOR_STABILITY,
    }


def select_display_skills(
    feature_map: dict[str, dict[str, Any]],
    *,
    pool_size: int = 10,
    display_count: int = 5,
    fallback: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    if not feature_map:
        return [
            {'skill': s, 'prevalence': None, 'stability_score': DEFAULT_STABILITY}
            for s in (fallback or [])[:display_count]
        ]

    pool = sorted(
        feature_map.items(),
        key=lambda kv: -float(kv[1].get('prevalence', 0.0)),
    )[:pool_size]

    selected = sorted(
        pool,
        key=lambda kv: -float(kv[1].get('stability_score', DEFAULT_STABILITY)),
    )[:display_count]

    return [
        {
            'skill': skill,
            'prevalence': round(float(f.get('prevalence', 0.0)), 4),
            'recent_prevalence': round(float(f.get('recent_prevalence', 0.0)), 4),
            'stability_score': round(float(f.get('stability_score', DEFAULT_STABILITY)), 4),
            'trend': f.get('trend', 'stable'),
            'time_coverage_reliable': bool(f.get('time_coverage_reliable', False)),
        }
        for skill, f in selected
    ]

UNIFIED_SKILLS_COLLECTION = "role_skill_observations"
SCHEMA_VERSION = 2


def make_observation_id(source: str, job_id: str, skill: str) -> str:
    safe_job = str(job_id).replace(":", "_")
    return f"{source}:{safe_job}:{skill}"


def job_doc_to_observations(
    job_doc: dict[str, Any],
    *,
    source: str,
    canonical_title: str,
    normalizer: Optional[Callable[[str], str]] = None,
    is_valid: Optional[Callable[[str, Optional[str]], bool]] = None,
    force_rebuild: bool = False,
) -> list[dict[str, Any]]:
    """Flatten one job document into one Mongo row per skill (unified collection)."""
    job_id = str(job_doc.get("_id", ""))
    date_posted = resolve_date_posted(job_doc)
    scraped_at = resolve_scraped_at(job_doc)
    extracted_at = resolve_extracted_at(job_doc)
    observed_at = resolve_observed_at(job_doc)
    records = build_skill_records(
        job_doc,
        canonical=canonical_title,
        normalizer=normalizer,
        is_valid=is_valid,
        force_rebuild=force_rebuild,
    )
    return [
        {
            "_id": make_observation_id(source, job_id, rec["skill"]),
            "job_id": job_id,
            "source": source,
            "canonical_title": canonical_title,
            "skill": rec["skill"],
            "score": rec["score"],
            "match_type": rec["match_type"],
            "datePosted": date_posted,
            "scraped_at": scraped_at,
            "extracted_at": extracted_at,
            "observed_at": observed_at,
            "schema_version": SCHEMA_VERSION,
        }
        for rec in records
    ]
