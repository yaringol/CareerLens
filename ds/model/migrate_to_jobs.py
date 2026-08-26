"""
Migrate a skills-extracted collection into the unified training collection `jobs`.

The unified collection holds every posting the title->skills model trains on, one
document per posting, with the `source` field as the audit/weighting axis:

    source='lang-uk'    historical Djinni corpus (migrated once, by this script)
    source='Linkedin'   nightly scrape (appended by extract_skills.py)

Idempotent by construction: each document keeps a deterministic prefixed `_id`
("languk:<original id>"), written with upsert. Re-running updates in place and
never duplicates, so the migration is safe to repeat and safe to interrupt.

Usage (dry run first - it is the default):
    MONGO_URI=mongodb://.../jobs python migrate_to_jobs.py
    MONGO_URI=mongodb://.../jobs DRY_RUN=0 python migrate_to_jobs.py

Env:
  MONGO_URI                 target database (production: .../jobs)
  SOURCE_URI                source database, if different (e.g. .../careerlens)
  MIGRATE_MAP               collection:idprefix pairs, comma-separated
                            default: lang-uk-job-skills:languk
  TARGET_COLLECTION         default: jobs
  BATCH_SIZE                default: 1000
  DRY_RUN                   1 (default) = count and report, write nothing
  NORMALIZE_TARGET_DATES    1 = also rewrite string datePosted values already in
                            the target collection as BSON dates (the LinkedIn
                            scrape writes ISO strings). Default 0.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

from mongo_env import get_mongo_uri
from taxonomy import CANONICAL_TITLES, VARIANT_TO_CANONICAL

TARGET_COLLECTION = os.getenv("TARGET_COLLECTION", "jobs")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
DRY_RUN = os.getenv("DRY_RUN", "1").lower() not in ("0", "false", "no")
NORMALIZE_TARGET_DATES = os.getenv("NORMALIZE_TARGET_DATES", "0").lower() in ("1", "true", "yes")
MIGRATE_MAP_RAW = os.getenv("MIGRATE_MAP", "lang-uk-job-skills:languk")

# train.py drops a posting below this many raw SkillNer matches. Counted here so
# the migration report predicts what will actually train, but NOT enforced: the
# unified collection is storage, the filtering belongs to train.py.
MIN_RAW_MATCHES = 5


def parse_migrate_map(raw: str) -> list[tuple[str, str]]:
    pairs = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        coll, _, prefix = part.rpartition(":")
        if not coll or not prefix:
            raise SystemExit(f"bad MIGRATE_MAP entry {part!r} - expected collection:idprefix")
        pairs.append((coll.strip(), prefix.strip()))
    return pairs


def as_dt(value):
    """BSON date, ISO-8601 string ('...Z' accepted), or None -> tz-aware datetime."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def resolve_canonical(doc) -> str | None:
    """Same rule train.py applies - a document it cannot resolve never trains."""
    og = doc.get("og_title") or doc.get("og_tite")
    if og in CANONICAL_TITLES:
        return og
    title = (doc.get("title") or "").lower().strip()
    if title and title in VARIANT_TO_CANONICAL:
        return VARIANT_TO_CANONICAL[title]
    return None


def raw_match_count(doc) -> int:
    skills = doc.get("skills") or {}
    return len(skills.get("full_matches", [])) + len(skills.get("ngram_matches", []))


def migrate_collection(source_coll, target_coll, id_prefix, now):
    stats = {
        "read": 0, "written": 0, "skipped_no_canonical_title": 0,
        "skipped_bad_date": 0, "skipped_no_skills": 0, "below_train_threshold": 0,
    }
    ops: list[UpdateOne] = []

    for doc in source_coll.find({}):
        stats["read"] += 1

        if resolve_canonical(doc) is None:
            stats["skipped_no_canonical_title"] += 1
            continue
        if not (doc.get("skills") or {}).get("full_matches") and not (
            doc.get("skills") or {}
        ).get("ngram_matches"):
            stats["skipped_no_skills"] += 1
            continue
        posted = as_dt(doc.get("datePosted"))
        if posted is None:
            stats["skipped_bad_date"] += 1
            continue
        if raw_match_count(doc) < MIN_RAW_MATCHES:
            stats["below_train_threshold"] += 1   # migrated anyway - reported only

        new = {k: v for k, v in doc.items() if k != "_id"}
        new["datePosted"] = posted                       # always a BSON date here
        new["schema_version"] = 2
        new["ingested_at"] = now
        new["migrated_from"] = source_coll.name
        new.setdefault("source", "unknown")

        ops.append(UpdateOne({"_id": f"{id_prefix}:{doc['_id']}"}, {"$set": new}, upsert=True))
        stats["written"] += 1

        if len(ops) >= BATCH_SIZE:
            if not DRY_RUN:
                target_coll.bulk_write(ops, ordered=False)
            ops = []
            print(f"    ... {stats['written']:,} prepared", flush=True)

    if ops and not DRY_RUN:
        target_coll.bulk_write(ops, ordered=False)
    return stats


def normalize_target_dates(target_coll, now) -> int:
    """Rewrite string datePosted values already in the target as BSON dates."""
    ops = []
    fixed = 0
    for doc in target_coll.find({"datePosted": {"$type": "string"}}, {"datePosted": 1}):
        parsed = as_dt(doc.get("datePosted"))
        if parsed is None:
            continue
        ops.append(UpdateOne({"_id": doc["_id"]},
                             {"$set": {"datePosted": parsed, "date_normalized_at": now}}))
        fixed += 1
        if len(ops) >= BATCH_SIZE:
            if not DRY_RUN:
                target_coll.bulk_write(ops, ordered=False)
            ops = []
    if ops and not DRY_RUN:
        target_coll.bulk_write(ops, ordered=False)
    return fixed


def ensure_indexes(target_coll) -> None:
    for spec in ("og_title", "source", "datePosted", "ingested_at"):
        target_coll.create_index(spec)
    target_coll.create_index([("source", 1), ("datePosted", 1)])


def main() -> int:
    target_uri = get_mongo_uri()
    source_uri = os.getenv("SOURCE_URI", "").strip() or target_uri
    now = datetime.now(timezone.utc)

    target_db = MongoClient(target_uri, serverSelectionTimeoutMS=8000).get_default_database()
    source_db = (target_db if source_uri == target_uri
                 else MongoClient(source_uri, serverSelectionTimeoutMS=8000).get_default_database())
    target = target_db[TARGET_COLLECTION]

    print(f"source : {source_uri.split('@')[-1]}")
    print(f"target : {target_uri.split('@')[-1]}/{TARGET_COLLECTION}")
    print(f"mode   : {'DRY RUN (nothing is written)' if DRY_RUN else 'WRITING'}")
    print(f"target holds {target.estimated_document_count():,} documents before migration")
    print()

    present = set(source_db.list_collection_names())
    for coll_name, prefix in parse_migrate_map(MIGRATE_MAP_RAW):
        if coll_name not in present:
            print(f"!! {coll_name} not found in the source database - skipping")
            continue
        print(f"  {coll_name} -> {TARGET_COLLECTION} (_id prefix '{prefix}:')")
        stats = migrate_collection(source_db[coll_name], target, prefix, now)
        for key, value in stats.items():
            print(f"      {key:32s} {value:,}")
        print()

    if NORMALIZE_TARGET_DATES:
        fixed = normalize_target_dates(target, now)
        print(f"  normalized string datePosted values in target: {fixed:,}")

    if not DRY_RUN:
        ensure_indexes(target)
        print("  indexes ensured: og_title, source, datePosted, ingested_at, (source, datePosted)")

    print()
    print(f"target holds {target.estimated_document_count():,} documents after migration")
    by_source = list(target.aggregate([
        {"$group": {"_id": {"$toLower": {"$ifNull": ["$source", "unknown"]}},
                    "n": {"$sum": 1},
                    "earliest": {"$min": "$datePosted"},
                    "latest": {"$max": "$datePosted"}}},
        {"$sort": {"n": -1}},
    ]))
    for row in by_source:
        print(f"    source={row['_id']:<18} {row['n']:>8,}   {row['earliest']} .. {row['latest']}")

    if DRY_RUN:
        print()
        print("DRY RUN - nothing was written. Re-run with DRY_RUN=0 to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
