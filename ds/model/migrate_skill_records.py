"""
Backfill skill_records on existing normalized collections (jobs, lang-uk-job-skills).

Does NOT re-run SkillNer - builds skill_records from legacy skills + observed_at.

Usage:
  MONGO_URI=mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin \\
  COLLECTIONS=jobs,lang-uk-job-skills \\
  python migrate_skill_records.py
"""
from __future__ import annotations

import os
from typing import Any

from pymongo import MongoClient, UpdateOne
from skill_schema import build_skill_records


def mongo_safe(value: Any) -> Any:
    import numpy as np
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, dict):
        return {k: mongo_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [mongo_safe(v) for v in value]
    return value

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin')
COLLECTIONS = [c.strip() for c in os.getenv('COLLECTIONS', 'jobs,lang-uk-job-skills').split(',') if c.strip()]
BATCH_SIZE = int(os.getenv('BATCH_SIZE', '500'))
FORCE_REBUILD = os.getenv('FORCE_REBUILD', '0').lower() in ('1', 'true', 'yes')


def migrate_collection(db, name: str) -> int:
    coll = db[name]
    updated = 0
    ops: list[UpdateOne] = []
    query = (
        {'skills': {'$exists': True}}
        if FORCE_REBUILD
        else {
            '$or': [
                {'skill_records': {'$exists': False}},
                {'skill_records': {'$size': 0}},
            ],
            'skills': {'$exists': True},
        }
    )
    for doc in coll.find(query, batch_size=BATCH_SIZE):
        records = build_skill_records(doc, force_rebuild=FORCE_REBUILD)
        if not records:
            continue
        ops.append(UpdateOne(
            {'_id': doc['_id']},
            {'$set': {
                'skill_records': mongo_safe(records),
                'schema_version': 2,
            }},
        ))
        if len(ops) >= BATCH_SIZE:
            coll.bulk_write(ops, ordered=False)
            updated += len(ops)
            ops.clear()
            print(f"  {name}: {updated:,} updated...")
    if ops:
        coll.bulk_write(ops, ordered=False)
        updated += len(ops)
    coll.create_index('skill_records.skill')
    coll.create_index('skill_records.observed_at')
    return updated


def main() -> int:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    total = 0
    for name in COLLECTIONS:
        print(f"Migrating {name}...")
        n = migrate_collection(db, name)
        print(f"  Done {name}: {n:,} docs")
        total += n
    print(f"Total updated: {total:,}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
