"""
Migrate jobs + lang-uk-job-skills into unified role_skill_observations collection.

One Mongo document per (source, job, skill) with datePosted + observed_at.

Run AFTER extract completes on both sources:
  MONGO_URI=mongodb://localhost:27017/jobs python migrate_unified_skill_observations.py

Env:
  SOURCE_MAP=jobs:linkedin,lang-uk-job-skills:lang_uk
  UNIFIED_COLLECTION=role_skill_observations
  BATCH_SIZE=1000
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable, Optional

from pymongo import MongoClient, ReplaceOne

from skill_schema import UNIFIED_SKILLS_COLLECTION, job_doc_to_observations

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/jobs")
UNIFIED_COLLECTION = os.getenv("UNIFIED_COLLECTION", UNIFIED_SKILLS_COLLECTION)
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
SOURCE_MAP_RAW = os.getenv(
    "SOURCE_MAP",
    "jobs:linkedin,lang-uk-job-skills:lang_uk",
)


def parse_source_map(raw: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        coll, label = part.rsplit(":", 1)
        pairs.append((coll.strip(), label.strip()))
    return pairs


def load_canonical_titles() -> set[str]:
    path = Path(__file__).with_name("canonical_titles.json")
    with path.open(encoding="utf-8") as handle:
        return set(json.load(handle).get("canonical_titles", []))


def resolve_canonical_simple(
    doc: dict[str, Any],
    canonical_titles: set[str],
) -> Optional[str]:
    og = (doc.get("og_title") or doc.get("og_tite") or "").strip()
    if og in canonical_titles:
        return og
    title = (doc.get("title") or "").strip()
    if title in canonical_titles:
        return title
    return None


def migrate_collection(
    db,
    collection_name: str,
    source_label: str,
    canonical_titles: set[str],
) -> tuple[int, int]:
    source = db[collection_name]
    target = db[UNIFIED_COLLECTION]
    ops: list[ReplaceOne] = []
    written = 0
    skipped = 0

    for doc in source.find({}):
        canonical = resolve_canonical_simple(doc, canonical_titles)
        if canonical is None:
            skipped += 1
            continue
        observations = job_doc_to_observations(
            doc,
            source=source_label,
            canonical_title=canonical,
            force_rebuild=True,
        )
        if not observations:
            skipped += 1
            continue
        for obs in observations:
            ops.append(ReplaceOne({"_id": obs["_id"]}, obs, upsert=True))
        if len(ops) >= BATCH_SIZE:
            target.bulk_write(ops, ordered=False)
            written += len(ops)
            ops.clear()
            print(f"  {collection_name}->{source_label}: {written:,} observations...")

    if ops:
        target.bulk_write(ops, ordered=False)
        written += len(ops)

    return written, skipped


def ensure_indexes(db) -> None:
    coll = db[UNIFIED_COLLECTION]
    coll.create_index([("canonical_title", 1), ("skill", 1)])
    coll.create_index([("source", 1), ("datePosted", -1)])
    coll.create_index([("source", 1), ("extracted_at", -1)])
    coll.create_index([("source", 1), ("observed_at", -1)])
    coll.create_index([("job_id", 1), ("source", 1)])


def main() -> int:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    canonical_titles = load_canonical_titles()
    source_map = parse_source_map(SOURCE_MAP_RAW)

    print(f"Target: {UNIFIED_COLLECTION}")
    total_written = 0
    total_skipped = 0

    for coll_name, source_label in source_map:
        print(f"Migrating {coll_name} as source={source_label}...")
        written, skipped = migrate_collection(
            db, coll_name, source_label, canonical_titles,
        )
        print(f"  Done: {written:,} observations, skipped_jobs={skipped:,}")
        total_written += written
        total_skipped += skipped

    ensure_indexes(db)
    total = db[UNIFIED_COLLECTION].estimated_document_count()
    print(f"Unified total: {total:,} observations ({total_written:,} written this run)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
