"""
Standalone training script — equivalent to running the Train section of training.ipynb.
Produces model.joblib + canonical_titles.json in ds/model/.
"""
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

import joblib
import numpy as np
from pymongo import MongoClient
from promotion_gate import evaluate_promotion, load_baseline_record_counts
from skill_schema import build_skill_records, compute_stability_score, weighted_scores_from_records
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
EXTRACTOR  = os.path.join(BASE_DIR, '..', 'extractor')

# Where model.joblib + canonical_titles.json are written. In the deploy image this
# points at the shared `model_data` volume the DS service reads on (re)start.
MODEL_OUT  = os.getenv('MODEL_OUT_DIR', BASE_DIR)

# ── Mongo source (single source of truth, shared with the scraper) ─────────────
from mongo_env import get_mongo_uri

MONGO_URI = get_mongo_uri()
# Collection to train from — set MONGO_COLLECTION=JOBS_EXAMPLE to train on the
# synthetic trend dataset instead of the live scraped `jobs`. When
# TRAIN_USE_UNIFIED=1, training instead reads from UNIFIED_SKILLS_COLLECTION
# (role_skill_observations — one row per (job posting, skill) observation,
# already carrying canonical_title/skill resolved by the ingestion pipeline,
# schema_version 2 — see accumulate_from_unified below).
MONGO_COLLECTION = os.getenv('MONGO_COLLECTION', 'jobs')

# ── Recency / time-feature tuning ──────────────────────────────────────────────
# Postings decay by half every HALF_LIFE_DAYS, so recent jobs dominate prevalence
# and emerging skills rise. TREND_WINDOW_DAYS defines the "recent" slice used to
# label a skill rising/stable/falling vs its all-time prevalence.
HALF_LIFE_DAYS    = float(os.getenv('RECENCY_HALF_LIFE_DAYS', '14'))
TREND_WINDOW_DAYS = float(os.getenv('TREND_WINDOW_DAYS', '7'))
TREND_RISING      = 1.25
TREND_FALLING     = 0.80
NOW               = datetime.now(timezone.utc)

# ── Stability score (slope of monthly occurrence over time) ───────────────────
# Unlike the single-ratio TREND_WINDOW_DAYS 'trend' label above, this fits a real
# regression over each posting's own datePosted spread within THIS training run —
# no dependency on multiple calendar-spaced training runs or a scraper cron. Moved
# to stability.py (a pure function, no Mongo/side effects at import time) so it can
# be unit-tested directly — see ds/model/test_stability.py.
from stability import (  # noqa: F401  (re-exported for backwards compatibility)
    compute_stability_features,
    MIN_RELIABLE_MONTHS,
    NEUTRAL_STABILITY_SCORE,
    NEUTRAL_GROWTH_TREND,
)


def _parse_dt(raw):
    """Accept BSON datetime or ISO-8601 string (e.g. '2026-06-29T09:36:52.000Z')."""
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str) and raw:
        try:
            return datetime.fromisoformat(raw.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def age_days(item):
    """Age of a posting in days, preferring datePosted, falling back to scraped_at."""
    posted = _parse_dt(item.get('datePosted')) or _parse_dt(item.get('scraped_at'))
    if posted is None:
        return None
    return max(0.0, (NOW - posted).total_seconds() / 86400.0)


def recency_weight(item):
    """Exponential decay weight in (0, 1]; 1.0 when the posting date is unknown."""
    age = age_days(item)
    if age is None:
        return 1.0
    return 0.5 ** (age / HALF_LIFE_DAYS)

# ── Canonical title set ───────────────────────────────────────────────────────
# Moved to taxonomy.py — the shared single source of truth for the 59 canonical
# titles (also consumed by the CV->title classifier, train_cv_classifier.py).
from taxonomy import (  # noqa: F401  (re-exported for backwards compatibility)
    CANONICAL_TITLE_VARIANTS,
    CANONICAL_TITLES,
    VARIANT_TO_CANONICAL,
)

# ── Normalization constants ───────────────────────────────────────────────────

ROLE_NAME_NOISE = {w for title in CANONICAL_TITLES
                   for w in [title.lower(), title.lower() + 's']}

UNIVERSAL_NOISE = {
    'scale', 'scalable', 'scalability',
    'collaborate', 'collaborates', 'collaboration', 'collaborations',
    'communication', 'communications', 'communication skills',
    'best practices', 'best practice',
    'leadership', 'reliability', 'research',
    'track', 'translate', 'innovative', 'innovation', 'innovations',
    'workflow', 'workflows', 'computer science',
    'problem solve', 'problem solving',
    'management', 'manage', 'english', 'nice', 'plan', 'act', 'eye',
    'com', 'job description', 'product name', 'brand names',
} | ROLE_NAME_NOISE

SKILL_NORMALIZE = {
    'algorithms': 'algorithm', 'integrations': 'integration',
    'operations': 'operation', 'systems': 'system', 'platforms': 'platform',
    'pipelines': 'pipeline', 'services': 'service', 'frameworks': 'framework',
    'databases': 'database', 'technologies': 'technology',
    'environments': 'environment', 'deployments': 'deployment',
    'applications': 'application', 'solutions': 'solution',
    'requirements': 'requirement', 'components': 'component',
    'repositories': 'repository', 'features': 'feature',
    'microservices': 'microservice', 'containers': 'container',
}

def normalize_skill(sk):
    sk = sk.lower().strip()
    return SKILL_NORMALIZE.get(sk, sk)

def is_valid_skill(sk, canonical):
    if len(sk) < 3:
        return False
    if sk in UNIVERSAL_NOISE:
        return False
    if canonical.lower() in sk:
        return False
    return not any(tok in sk.split() for tok in canonical.lower().split())

def resolve_canonical(og_title, actual_title):
    if og_title in CANONICAL_TITLES:
        return og_title
    if actual_title and actual_title.lower() in VARIANT_TO_CANONICAL:
        return VARIANT_TO_CANONICAL[actual_title.lower()]
    return None

def extract_weighted_skills(item, canonical):
    records = build_skill_records(
        item,
        canonical=canonical,
        normalizer=normalize_skill,
        is_valid=is_valid_skill,
    )
    if records:
        return weighted_scores_from_records(records)

    full_raw = {m['doc_node_value'].lower() for m in item['skills'].get('full_matches', [])}
    scores = defaultdict(float)
    for sk in full_raw:
        sk = normalize_skill(sk)
        if is_valid_skill(sk, canonical):
            scores[sk] += 1.0
    for m in item['skills'].get('ngram_matches', []):
        sk_raw = m['doc_node_value'].lower()
        if sk_raw in full_raw:
            continue
        score = m.get('score', 0.5)
        if score < 0.75:
            continue
        sk = normalize_skill(sk_raw)
        if is_valid_skill(sk, canonical):
            scores[sk] += score
    return dict(scores)

def parse_source_weights():
    """
    Multi-source training:
      legacy:  SOURCE_WEIGHTS=jobs:1.0,lang-uk-job-skills:0.3
      unified: TRAIN_USE_UNIFIED=1 SOURCE_WEIGHTS=linkedin:1.0,lang_uk:0.3
    Falls back to MONGO_COLLECTION at weight 1.0 when unset.
    """
    raw = os.getenv('SOURCE_WEIGHTS', '').strip()
    if raw:
        sources = []
        for part in raw.split(','):
            part = part.strip()
            if not part:
                continue
            if ':' in part:
                name, weight = part.rsplit(':', 1)
                sources.append((name.strip(), float(weight.strip())))
            else:
                sources.append((part, 1.0))
        return sources
    return [(MONGO_COLLECTION, 1.0)]


def _empty_accumulators():
    return {
        'role_skill_scores': {t: defaultdict(float) for t in CANONICAL_TITLES},
        'role_skill_counts': {t: defaultdict(int) for t in CANONICAL_TITLES},
        'role_record_weight': defaultdict(float),
        'record_counts': defaultdict(int),
        'recent_skill_scores': {t: defaultdict(float) for t in CANONICAL_TITLES},
        'recent_record_count': defaultdict(int),
        'skill_observation_dates': {
            t: defaultdict(list) for t in CANONICAL_TITLES
        },
        # Monthly buckets for the stability slope (stability.py's
        # compute_stability_features): role_skill_month_counts[title][skill][month] =
        # count, role_month_totals[title][month] = postings-with-a-known-date count
        # that month. Independent bookkeeping from the recency/trend accumulators
        # above — anchored to the posting's own observed date, not scrape recency.
        'role_skill_month_counts': {
            t: defaultdict(lambda: defaultdict(int)) for t in CANONICAL_TITLES
        },
        'role_month_totals': {t: defaultdict(int) for t in CANONICAL_TITLES},
        # Tracks which (title, job_id) already contributed to role_month_totals,
        # so a job's multiple skill rows (unified source) don't double-count it.
        '_month_job_seen': set(),
    }


def _bucket_month(acc, canonical, job_key, posted_dt, skills):
    """Record one posting's month bucket for the stability slope, once per job."""
    if posted_dt is None:
        return
    month_key = f"{posted_dt.year:04d}-{posted_dt.month:02d}"
    seen_key = (canonical, job_key, month_key)
    if job_key is not None:
        if seen_key in acc['_month_job_seen']:
            return
        acc['_month_job_seen'].add(seen_key)
    acc['role_month_totals'][canonical][month_key] += 1
    for skill in skills:
        acc['role_skill_month_counts'][canonical][skill][month_key] += 1


def accumulate_from_collection(collection, source_weight, acc):
    """Read one Mongo collection into shared accumulators (weighted by source)."""
    loaded = 0
    skipped = 0
    for item in collection.find({}):
        try:
            og_title     = item.get('og_title') or item.get('og_tite')
            actual_title = item.get('title', '')
            canonical    = resolve_canonical(og_title, actual_title)
            if canonical is None:
                skipped += 1
                continue
            skills = item.get('skills') or {}
            total = (len(skills.get('full_matches', [])) +
                     len(skills.get('ngram_matches', [])))
            if total < 5:
                skipped += 1
                continue
            weighted = extract_weighted_skills(item, canonical)
            if not weighted:
                skipped += 1
                continue

            records = build_skill_records(
                item,
                canonical=canonical,
                normalizer=normalize_skill,
                is_valid=is_valid_skill,
            )
            for rec in records:
                obs = rec.get('observed_at')
                if obs is not None:
                    acc['skill_observation_dates'][canonical][rec['skill']].append(obs)

            w = recency_weight(item) * source_weight
            age = age_days(item)
            is_recent = age is not None and age <= TREND_WINDOW_DAYS

            for skill, score in weighted.items():
                acc['role_skill_scores'][canonical][skill] += score * w
                acc['role_skill_counts'][canonical][skill] += 1
                if is_recent:
                    acc['recent_skill_scores'][canonical][skill] += score
            acc['role_record_weight'][canonical] += w
            acc['record_counts'][canonical] += 1
            if is_recent:
                acc['recent_record_count'][canonical] += 1
            loaded += 1

            # Stability slope bucketing — anchored to when the job was POSTED
            # (falls back to scraped/extracted_at via _parse_dt's callers above).
            posted_dt = _parse_dt(item.get('datePosted')) or _parse_dt(item.get('scraped_at'))
            job_id = item.get('_id') or item.get('job_id')
            _bucket_month(acc, canonical, str(job_id) if job_id else None, posted_dt, weighted)
        except (KeyError, TypeError):
            skipped += 1
            continue
    return loaded, skipped


def accumulate_from_unified(collection, source_label, source_weight, acc):
    """Read flat role_skill_observations (one row per skill) into accumulators."""
    loaded = 0
    skipped = 0
    job_weights_added = acc.setdefault('_job_weights_added', set())

    for obs in collection.find({'source': source_label}):
        try:
            canonical = obs.get('canonical_title')
            if canonical not in CANONICAL_TITLES:
                skipped += 1
                continue
            skill = obs.get('skill')
            if not skill:
                skipped += 1
                continue
            score = float(obs.get('score', 1.0))
            observed_at = obs.get('observed_at')
            pseudo_item = {'datePosted': observed_at, 'scraped_at': observed_at}
            w = recency_weight(pseudo_item) * source_weight
            age = age_days(pseudo_item)
            is_recent = age is not None and age <= TREND_WINDOW_DAYS

            job_key = (canonical, str(obs.get('job_id', '')))
            if job_key[1] and job_key not in job_weights_added:
                job_weights_added.add(job_key)
                acc['role_record_weight'][canonical] += w
                acc['record_counts'][canonical] += 1
                if is_recent:
                    acc['recent_record_count'][canonical] += 1
                loaded += 1

            acc['role_skill_scores'][canonical][skill] += score * w
            acc['role_skill_counts'][canonical][skill] += 1
            if is_recent:
                acc['recent_skill_scores'][canonical][skill] += score
            if observed_at is not None:
                acc['skill_observation_dates'][canonical][skill].append(observed_at)

            # Stability slope bucketing — anchored to the observation's own
            # posted/observed date, once per (title, job_id, month).
            posted_dt = _parse_dt(observed_at)
            job_id = obs.get('job_id')
            _bucket_month(acc, canonical, str(job_id) if job_id else None, posted_dt, [skill])
        except (KeyError, TypeError, ValueError):
            skipped += 1
            continue
    return loaded, skipped


# ── Load & aggregate (from MongoDB, recency-weighted) ──────────────────────────

mongo = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
fdb = mongo.get_default_database()
USE_UNIFIED = os.getenv('TRAIN_USE_UNIFIED', '0').lower() in ('1', 'true', 'yes')
UNIFIED_COLL = os.getenv('UNIFIED_SKILLS_COLLECTION', 'role_skill_observations')
source_weights = parse_source_weights()
source_label = '+'.join(f'{n}:{w}' for n, w in source_weights)

acc = _empty_accumulators()
print(f"Reading from MongoDB: {MONGO_URI.split('@')[-1]} sources={source_label}")

if USE_UNIFIED:
    coll = fdb[UNIFIED_COLL]
    total_loaded = 0
    total_skipped = 0
    for source_name, weight in source_weights:
        loaded, skipped = accumulate_from_unified(coll, source_name, weight, acc)
        print(f"  {UNIFIED_COLL} source={source_name} (w={weight}): loaded_jobs={loaded} skipped={skipped}")
        total_loaded += loaded
        total_skipped += skipped
else:
    for coll_name, weight in source_weights:
        coll = fdb[coll_name]
        loaded, skipped = accumulate_from_collection(coll, weight, acc)
        print(f"  {coll_name} (w={weight}): loaded={loaded} skipped={skipped}")

role_skill_scores = acc['role_skill_scores']
role_skill_counts = acc['role_skill_counts']
role_record_weight = acc['role_record_weight']
record_counts = acc['record_counts']
recent_skill_scores = acc['recent_skill_scores']
recent_record_count = acc['recent_record_count']
skill_observation_dates = acc['skill_observation_dates']
role_skill_month_counts = acc['role_skill_month_counts']
role_month_totals = acc['role_month_totals']

print("Records loaded per role (raw count | weighted):")
for title in CANONICAL_TITLES:
    n = record_counts[title]
    print(f"  {n:4}  (w={role_record_weight[title]:6.1f})  {title}  "
          f"({len(role_skill_scores[title])} unique skills)")

# ── Sort skills (backward-compat list) ───────────────────────────────────────

role_sorted_skills = {
    title: [sk for sk, _ in sorted(
        role_skill_scores[title].items(), key=lambda x: -x[1] / max(role_record_weight[title], 1e-9)
    )]
    for title in CANONICAL_TITLES
}

# ── Feature matrix ────────────────────────────────────────────────────────────

def trend_label(recent_prev, overall_prev):
    """rising / stable / falling from recent-window prevalence vs all-time prevalence."""
    if overall_prev <= 0 or recent_prev <= 0:
        return 'stable'
    ratio = recent_prev / overall_prev
    if ratio >= TREND_RISING:
        return 'rising'
    if ratio <= TREND_FALLING:
        return 'falling'
    return 'stable'

def compute_feature_matrix(role_skill_scores, role_skill_counts, role_record_weight,
                           recent_skill_scores, recent_record_count,
                           skill_observation_dates):
    n_titles = len(CANONICAL_TITLES)
    skill_title_count = defaultdict(int)
    for skills in role_skill_scores.values():
        for skill in skills:
            skill_title_count[skill] += 1

    fm = {}
    for title in CANONICAL_TITLES:
        denom = role_record_weight[title]
        if denom <= 0:
            continue
        recent_denom = recent_record_count[title]
        fm[title] = {}
        for skill, total_score in role_skill_scores[title].items():
            frequency  = role_skill_counts[title][skill]
            prevalence = total_score / denom                       # recency-weighted mean
            # Raw (un-normalized) recent vs overall prevalence drives the trend label.
            recent_prev_raw  = (recent_skill_scores[title][skill] / recent_denom
                                if recent_denom > 0 else 0.0)
            idf        = np.log(n_titles / skill_title_count[skill]) if skill_title_count[skill] > 0 else 0
            specificity = idf / np.log(max(n_titles, 2))
            stability_meta = compute_stability_score(
                skill_observation_dates[title].get(skill, [])
            )
            fm[title][skill] = {
                'frequency':         frequency,
                'prevalence':        prevalence,
                'recent_prevalence': recent_prev_raw,
                'trend':             trend_label(recent_prev_raw, prevalence),
                'title_specificity': float(np.clip(specificity, 0.0, 1.0)),
                **stability_meta,
            }

    # Normalize prevalence (and recent_prevalence on the same scale) to [0, 1] per title.
    for title in fm:
        max_prev = max(f['prevalence'] for f in fm[title].values())
        if max_prev > 0:
            for skill in fm[title]:
                fm[title][skill]['prevalence'] /= max_prev
                fm[title][skill]['recent_prevalence'] /= max_prev
    return fm

feature_matrix = compute_feature_matrix(
    role_skill_scores, role_skill_counts, role_record_weight,
    recent_skill_scores, recent_record_count, skill_observation_dates,
)

stability_features = compute_stability_features(
    CANONICAL_TITLES, role_skill_month_counts, role_month_totals
)

# Merge stability fields into the existing feature_matrix — a strict superset,
# no existing consumer of feature_matrix's shape breaks.
for title, skills in feature_matrix.items():
    for skill, feats in skills.items():
        sf = stability_features.get(title, {}).get(skill, {
            'growth_trend': NEUTRAL_GROWTH_TREND,
            'stability_score': NEUTRAL_STABILITY_SCORE,
            'time_features_reliable': False,
            'history_months': 0,
        })
        feats['growth_trend']           = sf['growth_trend']
        feats['stability_score']        = sf['stability_score']
        feats['time_features_reliable'] = sf['time_features_reliable']
        feats['history_months']         = sf['history_months']

# ── Build KNN ─────────────────────────────────────────────────────────────────

variant_titles = []
variant_labels = []
for canonical, variants in CANONICAL_TITLE_VARIANTS.items():
    for v in variants:
        variant_titles.append(v)
        variant_labels.append(canonical)

skills_data = [role_sorted_skills.get(label, []) for label in variant_labels]

vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
X = vectorizer.fit_transform(variant_titles)

knn = NearestNeighbors(n_neighbors=3, metric='cosine')
knn.fit(X)

print(f"\nKNN trained on {len(variant_titles)} variants for {len(CANONICAL_TITLES)} titles")

# ── Save model ────────────────────────────────────────────────────────────────

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

model_artifacts = {
    'vectorizer':     vectorizer,
    'knn_model':      knn,
    'skills':         skills_data,
    'titles':         variant_labels,
    'variant_titles': variant_titles,
    'feature_matrix': feature_matrix,
    'trained_at':     timestamp,
}

os.makedirs(MODEL_OUT, exist_ok=True)
versioned = os.path.join(MODEL_OUT, f'model_{timestamp}.joblib')
latest    = os.path.join(MODEL_OUT, 'model.joblib')

baseline_counts = load_baseline_record_counts(
    fdb, model_out=MODEL_OUT, canonical_titles=CANONICAL_TITLES,
)
new_counts_dict = {t: int(record_counts[t]) for t in CANONICAL_TITLES}
promoted, promote_reason = evaluate_promotion(
    new_counts_dict, baseline_counts, CANONICAL_TITLES,
)
if baseline_counts:
    print(f"Baseline: last promoted run ({sum(baseline_counts.values())} total records)")
else:
    print('Baseline: none (first live promote when thresholds met)')

joblib.dump(model_artifacts, versioned)
print(f"Saved versioned snapshot: {versioned}")

if promoted:
    joblib.dump(model_artifacts, latest)
    print(f"Promoted to production: {latest}")
else:
    print(f"NOT promoted ({promote_reason}) — keeping existing {latest}")

# ── Save canonical_titles.json ────────────────────────────────────────────────

def confidence_level(n):
    if n >= 100: return 'high'
    if n >= 50:  return 'medium'
    return 'low'

canonical_data = {
    'canonical_titles':  CANONICAL_TITLES,
    'record_counts':     {t: int(record_counts[t]) for t in CANONICAL_TITLES},
    'confidence_levels': {t: confidence_level(int(record_counts[t])) for t in CANONICAL_TITLES},
    'generated_at':      timestamp,
}

json_path = os.path.join(MODEL_OUT, 'canonical_titles.json')
if promoted:
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(canonical_data, f, indent=2, ensure_ascii=False)
    print(f"Saved: {json_path}")
else:
    print(f"Skipped updating {json_path} (not promoted)")

# ── Persist the learned skill<->title mapping to MongoDB ────────────────────────
# So experiments across data sources (jobs / JOBS_EXAMPLE / lang-uk-job ...) are
# stored side by side and comparable. Two collections in the same DB:
#   model_runs          : one doc per training run (source + params + record counts)
#   role_skill_features : one row per (run, canonical title, skill) — queryable
# Disable with PERSIST_FEATURES=0.
if os.getenv('PERSIST_FEATURES', '1').lower() not in ('0', 'false', 'no'):
    fdb        = mongo.get_default_database()
    runs_coll  = fdb[os.getenv('RUNS_COLLECTION', 'model_runs')]
    feats_coll = fdb[os.getenv('FEATURES_COLLECTION', 'role_skill_features')]
    run_id = f"{source_label}@{timestamp}"

    runs_coll.replace_one({'_id': run_id}, {
        '_id':                 run_id,
        'source_collection':   MONGO_COLLECTION,
        'source_weights':      {n: w for n, w in source_weights},
        'promoted':            promoted,
        'promote_reason':      promote_reason,
        'trained_at':          timestamp,
        'half_life_days':      HALF_LIFE_DAYS,
        'trend_window_days':   TREND_WINDOW_DAYS,
        'record_counts':       new_counts_dict,
        'titles_with_data':    sum(1 for t in CANONICAL_TITLES if record_counts[t] > 0),
    }, upsert=True)

    feats_coll.delete_many({'run_id': run_id})
    rows = [
        {
            'run_id': run_id, 'source': source_label, 'title': title, 'skill': skill,
            'prevalence':        round(float(f['prevalence']), 4),
            'recent_prevalence': round(float(f.get('recent_prevalence', 0.0)), 4),
            'trend':             f.get('trend', 'stable'),
            'observation_count': int(f.get('observation_count', 0)),
            'observation_weeks': int(f.get('observation_weeks', 0)),
            'time_coverage_reliable': bool(f.get('time_coverage_reliable', False)),
            'frequency':         int(f['frequency']),
            'title_specificity': round(float(f['title_specificity']), 4),
            'growth_trend':           round(float(f.get('growth_trend', NEUTRAL_GROWTH_TREND)), 4),
            'stability_score':        round(float(f.get('stability_score', NEUTRAL_STABILITY_SCORE)), 4),
            'time_features_reliable': bool(f.get('time_features_reliable', False)),
            'history_months':         int(f.get('history_months', 0)),
        }
        for title, skills in feature_matrix.items()
        for skill, f in skills.items()
    ]
    if rows:
        feats_coll.insert_many(rows)
    feats_coll.create_index([('source', 1), ('title', 1), ('skill', 1)])
    feats_coll.create_index('run_id')
    print(f"Persisted {len(rows)} feature rows to '{feats_coll.name}' (run_id={run_id})")

# ── Sanity check ──────────────────────────────────────────────────────────────
print("\nTop 5 skills per sample title (stability_score, reliable):")
for title in ["Software Engineer", "Data Scientist", "Machine Learning Engineer",
              "DevOps Engineer", "Frontend Developer"]:
    if title in variant_labels:
        idx = variant_labels.index(title)
        top5 = skills_data[idx][:5]
        feats = feature_matrix.get(title, {})
        detail = [
            f"{s}(stab={feats.get(s, {}).get('stability_score', 'n/a')}, "
            f"reliable={feats.get(s, {}).get('time_features_reliable', False)})"
            for s in top5
        ]
        print(f"  {title}: {detail}")

sys.exit(0 if promoted else 2)
