"""Step 5: compute real-CV training coverage per canonical title, from source.

The repo carries three conflicting counts of "canonical titles with no real CV
training data": 33 (00-readiness-audit.md:117), 32 (TITLE_DETECTION_METHODOLOGY.md
:243), 35 (19-title-unification-report.md:40). None can be traced to a live
computation - the classifier's build_dataset script is not in the repo.

What IS in the repo: the taxonomy (59 canonical titles) and both source-mapping
functions the training data was built with - taxonomy.lang_uk_label() for the
Djinni CV corpus and taxonomy.master_label() for master_resumes.jsonl. This
script replays those two mappings over the actual corpora and reports, per
title, how many real CV bodies exist.

Read-only. Usage (from ds/model, or with PYTHONPATH pointing there):
    python scripts/eval/07_coverage_table.py
"""
import json
import os
import sys

DS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'ds', 'model')
sys.path.insert(0, os.path.abspath(DS_DIR))

from taxonomy import CANONICAL_TITLES, OTHER_LABEL, lang_uk_label, master_label  # noqa: E402

# The classifier's own floor for "this class has real data" (methodology §4.2).
MIN_CV_PER_CLASS = 50
OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..',
    'docs', 'final-sprint', 'outputs', 'metrics-raw', '07-coverage-table.json'
)

counts = {t: {'master_resumes': 0, 'lang_uk_cv': 0} for t in CANONICAL_TITLES}
counts[OTHER_LABEL] = {'master_resumes': 0, 'lang_uk_cv': 0}
dropped = {'master_resumes': 0, 'lang_uk_cv': 0}

# ── source 1: master_resumes.jsonl (structured, synthetic-but-full CVs) ────────
master_path = os.path.join(DS_DIR, 'master_resumes.jsonl')
with open(master_path, encoding='utf-8') as fh:
    for line in fh:
        line = line.strip()
        if not line:
            continue
        doc = json.loads(line)
        exp = doc.get('experience') or []
        raw = exp[0].get('title') if exp else None
        label = master_label(raw)
        if label is None:
            dropped['master_resumes'] += 1
        else:
            counts.setdefault(label, {'master_resumes': 0, 'lang_uk_cv': 0})
            counts[label]['master_resumes'] += 1

# ── source 2: lang-uk CV corpus (real Djinni CVs, in Mongo) ───────────────────
lang_uk_available = True
try:
    from pymongo import MongoClient
    uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
    coll = MongoClient(uri, serverSelectionTimeoutMS=5000).careerlens['lang-uk-cv']
    for doc in coll.find({}, {'Primary Keyword': 1, 'primary_keyword': 1}):
        pk = doc.get('Primary Keyword') or doc.get('primary_keyword')
        label = lang_uk_label(pk)
        if label is None:
            dropped['lang_uk_cv'] += 1
        else:
            counts.setdefault(label, {'master_resumes': 0, 'lang_uk_cv': 0})
            counts[label]['lang_uk_cv'] += 1
except Exception as exc:  # Mongo absent -> report master-only, do not fake it
    lang_uk_available = False
    print(f"[warn] lang-uk CV corpus unavailable ({exc.__class__.__name__}: {exc})")

rows = []
for title in CANONICAL_TITLES:
    c = counts[title]
    total = c['master_resumes'] + c['lang_uk_cv']
    rows.append({
        'title': title,
        'master_resumes': c['master_resumes'],
        'lang_uk_cv': c['lang_uk_cv'],
        'total_real_cvs': total,
        'has_any_real_cv': total > 0,
        'clears_min_50': total >= MIN_CV_PER_CLASS,
    })

zero = [r for r in rows if not r['has_any_real_cv']]
below = [r for r in rows if r['has_any_real_cv'] and not r['clears_min_50']]
clears = [r for r in rows if r['clears_min_50']]

summary = {
    'canonical_titles': len(CANONICAL_TITLES),
    'min_cv_per_class': MIN_CV_PER_CLASS,
    'lang_uk_corpus_available': lang_uk_available,
    'titles_with_zero_real_cvs': len(zero),
    'titles_below_min_but_nonzero': len(below),
    'titles_clearing_min': len(clears),
    'dropped_rows': dropped,
    'other_label_rows': counts[OTHER_LABEL],
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump({'summary': summary, 'rows': rows}, fh, indent=2)

print("\n=== real-CV training coverage over the 59 canonical titles ===")
print(f"lang-uk corpus available : {lang_uk_available}")
print(f"titles with ZERO real CVs: {len(zero)}/{len(CANONICAL_TITLES)} "
      f"({len(zero) / len(CANONICAL_TITLES) * 100:.0f}%)")
print(f"titles 1..49 real CVs    : {len(below)}")
print(f"titles clearing {MIN_CV_PER_CLASS}       : {len(clears)}")
print(f"dropped (unmappable)     : {dropped}")
print(f"{OTHER_LABEL} rows          : {counts[OTHER_LABEL]}")

print("\ntitles WITH real CV data:")
for r in sorted(clears + below, key=lambda x: -x['total_real_cvs']):
    print(f"  {r['title'][:34]:34} master {r['master_resumes']:5}  lang-uk {r['lang_uk_cv']:6}  total {r['total_real_cvs']:6}")

print(f"\ntitles with NO real CV body ({len(zero)}):")
for r in zero:
    print(f"  {r['title']}")

print(f"\nwritten: {OUT}")
