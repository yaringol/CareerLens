"""
M20 / data-pipeline metrics: the raw-market -> served-model funnel.

Recomputes every stage of the corpus funnel from the local Mongo instance and
the trained artifact, so the numbers in the book are reproducible rather than
quoted from a milestone report.

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens python scripts/eval/17_data_funnel.py

Writes: docs/final-sprint/outputs/metrics-raw/17-data-funnel.json
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
from pymongo import MongoClient

from lang_uk_mapping import MIN_DESCRIPTION_LEN, map_primary_keyword

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/careerlens')
RAW = os.getenv('RAW_COLLECTION', 'lang-uk-job')
EXTRACTED = os.getenv('EXTRACTED_COLLECTION', 'lang-uk-job-skills')
AUGMENTED = os.getenv('AUG_COLLECTION', 'augmented-2026')
MODEL = os.path.join(REPO, 'ds', 'model', 'model.joblib')
TRAIN_MIN_MATCHES = 5  # train.py drops a posting with fewer raw SkillNer matches

db = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000).get_default_database()
out: dict = {'mongo': MONGO_URI.split('@')[-1]}

# Stage 1 - raw dataset rows -> postings the taxonomy can label
raw = db[RAW]
s1 = {'rows': raw.count_documents({}), 'dropped_out_of_taxonomy': 0,
      'dropped_description_too_short': 0, 'mappable': 0, 'per_role': {}}
per_role: collections.Counter = collections.Counter()
for d in raw.find({}, {'Primary Keyword': 1, 'Long Description': 1}):
    canonical = map_primary_keyword((d.get('Primary Keyword') or '').strip())
    if canonical is None:
        s1['dropped_out_of_taxonomy'] += 1
        continue
    if len((d.get('Long Description') or '').strip()) < MIN_DESCRIPTION_LEN:
        s1['dropped_description_too_short'] += 1
        continue
    s1['mappable'] += 1
    per_role[canonical] += 1
s1['per_role'] = dict(per_role.most_common())
out['s1_raw_to_mappable'] = s1

# Stage 2/3 - balanced sample -> SkillNer extraction yield and skill density
ext = db[EXTRACTED]
raw_counts: list[int] = []
rec_counts: list[int] = []
uniq: set = set()
role_docs: collections.Counter = collections.Counter()
for d in ext.find({}, {'skills': 1, 'skill_records': 1, 'og_title': 1}):
    s = d.get('skills') or {}
    raw_counts.append(len(s.get('full_matches', [])) + len(s.get('ngram_matches', [])))
    records = d.get('skill_records') or []
    rec_counts.append(len(records))
    role_docs[d.get('og_title')] += 1
    for r in records:
        uniq.add(r.get('skill'))

n = len(rec_counts)
raw_counts.sort()
rec_counts.sort()


def pct(a: list[int], p: float) -> int:
    return a[min(len(a) - 1, int(len(a) * p))]


out['s2_sampled_extracted'] = {
    'docs': n,
    'per_role': dict(role_docs.most_common()),
    'docs_with_zero_raw_matches': sum(1 for c in raw_counts if c == 0),
    'docs_with_zero_normalized_skills': sum(1 for c in rec_counts if c == 0),
    'docs_below_train_min_matches': sum(1 for c in raw_counts if c < TRAIN_MIN_MATCHES),
    'extraction_coverage_pct': round(sum(1 for c in rec_counts if c > 0) / n * 100, 2),
    'raw_matches_per_doc': {'median': statistics.median(raw_counts),
                            'mean': round(statistics.mean(raw_counts), 2),
                            'p25': pct(raw_counts, .25), 'p75': pct(raw_counts, .75),
                            'max': raw_counts[-1]},
    'normalized_skills_per_doc': {'median': statistics.median(rec_counts),
                                  'mean': round(statistics.mean(rec_counts), 2),
                                  'p25': pct(rec_counts, .25), 'p75': pct(rec_counts, .75),
                                  'max': rec_counts[-1]},
    'total_doc_skill_observations': sum(rec_counts),
    'distinct_skills': len(uniq),
}

# Stage 4 - marked synthetic continuation
aug = db[AUGMENTED]
aug_lens: list[int] = []
aug_roles: collections.Counter = collections.Counter()
aug_uniq: set = set()
for d in aug.find({}, {'skill_records': 1, 'og_title': 1}):
    records = d.get('skill_records') or []
    aug_lens.append(len(records))
    aug_roles[d.get('og_title')] += 1
    for r in records:
        aug_uniq.add(r.get('skill'))
out['s3_augmented'] = {
    'docs': len(aug_lens),
    'per_role': dict(aug_roles.most_common()),
    'median_skills_per_doc': statistics.median(aug_lens) if aug_lens else 0,
    'total_observations': sum(aug_lens),
    'distinct_skills': len(aug_uniq),
    'skills_absent_from_real_corpus': len(aug_uniq - uniq),
    'synthetic_share_pct': round(len(aug_lens) / (n + len(aug_lens)) * 100, 2),
    'synthetic_share_by_role_pct': {
        t: round(aug_roles[t] / (role_docs[t] + aug_roles[t]) * 100, 1)
        for t in sorted(aug_roles)
    },
}

# Stage 5 - what training actually kept, and what it produced
artifact = joblib.load(MODEL)
fm = artifact['feature_matrix']
counts = json.load(open(os.path.join(REPO, 'ds', 'model', 'canonical_titles.json'),
                        encoding='utf-8'))
record_counts = counts['record_counts']
canonical = counts['canonical_titles']
kept = sum(int(v) for v in record_counts.values())
model_uniq: set = set()
pairs = 0
observations = 0
for t, skills in fm.items():
    pairs += len(skills)
    model_uniq |= set(skills)
    observations += sum(int(f.get('frequency', 0)) for f in skills.values())
out['s4_training'] = {
    'trained_at': artifact['trained_at'],
    'candidate_records': n + len(aug_lens),
    'records_kept': kept,
    'roles_with_data': sum(1 for t in canonical if int(record_counts[t]) > 0),
    'roles_total': len(canonical),
    'roles_clearing_50_record_floor': sum(1 for t in canonical if int(record_counts[t]) >= 50),
    'role_skill_feature_rows': pairs,
    'role_skill_observations': observations,
    'distinct_skills': len(model_uniq),
    'mean_skills_per_kept_record': round(observations / kept, 2),
}

# Stage 6 - promotion
runs = list(db[os.getenv('RUNS_COLLECTION', 'model_runs')].find({}, {'record_counts': 0}))
out['s5_promotion'] = {
    'runs_recorded': len(runs),
    'runs_promoted': sum(1 for r in runs if r.get('promoted')),
    'reasons': [r.get('promote_reason') for r in runs],
    'note': 'model_runs holds only manually launched training runs; the ofelia '
            'nightly cron never ran in this environment (readiness audit 3.5), '
            'so no nightly promote/block rate exists.',
}

dest = os.path.join(REPO, 'docs', 'final-sprint', 'outputs', 'metrics-raw', '17-data-funnel.json')
with open(dest, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=2, ensure_ascii=False)
print(json.dumps(out, indent=2, ensure_ascii=False)[:1500])
print(f'\nwrote {dest}')
