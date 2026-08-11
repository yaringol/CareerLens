"""
Build a balanced, normalized training sample from the local raw lang-uk corpus.

The local Mongo (careerlens.lang-uk-job) holds the raw HuggingFace dump with
original field names (Position / Primary Keyword / Long Description / Published).
This script maps those docs through lang_uk_mapping (same logic the HF import
uses), balances per canonical title, and writes normalized docs ready for
extract_skills.py + train.py into a sample collection.

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  SAMPLE_COLLECTION=lang-uk-job-sample \\
  PER_ROLE_CAP=4000 \\
  python sample_local_corpus.py

Idempotent: re-running with the same seed/cap rebuilds the same sample; docs
already present are upserted (extracted flags on existing docs are preserved).
"""
from __future__ import annotations

import os
import random
from collections import defaultdict
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

from lang_uk_mapping import MIN_DESCRIPTION_LEN, map_primary_keyword, parse_published
from mongo_env import get_mongo_uri

RAW_COLLECTION = os.getenv("RAW_COLLECTION", "lang-uk-job")
SAMPLE_COLLECTION = os.getenv("SAMPLE_COLLECTION", "lang-uk-job-sample")
PER_ROLE_CAP = int(os.getenv("PER_ROLE_CAP", "4000"))
SEED = int(os.getenv("SAMPLE_SEED", "42"))


def raw_doc_to_job_doc(doc: dict) -> dict | None:
    """Normalize a raw HF-dump Mongo doc (adapter for row_to_job_doc's contract:
    the dump keeps the HF field names but uses _id instead of id)."""
    canonical = map_primary_keyword((doc.get("Primary Keyword") or "").strip())
    if canonical is None:
        return None
    description = (doc.get("Long Description") or "").strip()
    if len(description) < MIN_DESCRIPTION_LEN:
        return None
    return {
        "_id": str(doc["_id"]),
        "title": (doc.get("Position") or "").strip(),
        "og_title": canonical,
        "description": description,
        "datePosted": parse_published(doc.get("Published")),
        "primary_keyword": (doc.get("Primary Keyword") or "").strip(),
        "company": doc.get("Company Name"),
        "exp_years": doc.get("Exp Years"),
        "english_level": doc.get("English Level"),
        "source": "lang-uk",
        "extracted": False,
        "imported_at": datetime.now(timezone.utc),
    }


def main() -> int:
    client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    raw = db[RAW_COLLECTION]
    sample = db[SAMPLE_COLLECTION]

    print(f"Scanning {RAW_COLLECTION} for mapped, well-described postings ...")
    ids_by_role: dict[str, list] = defaultdict(list)
    scanned = 0
    cursor = raw.find(
        {}, {"Primary Keyword": 1, "Long Description": 1}, batch_size=2000
    )
    for doc in cursor:
        scanned += 1
        canonical = map_primary_keyword((doc.get("Primary Keyword") or "").strip())
        if canonical is None:
            continue
        if len((doc.get("Long Description") or "").strip()) < MIN_DESCRIPTION_LEN:
            continue
        ids_by_role[canonical].append(doc["_id"])
    print(f"Scanned {scanned:,} raw docs; {sum(len(v) for v in ids_by_role.values()):,} eligible")

    rng = random.Random(SEED)
    chosen: list = []
    print(f"\nBalanced sample (cap {PER_ROLE_CAP}/role, seed {SEED}):")
    for role in sorted(ids_by_role):
        ids = ids_by_role[role]
        take = ids if len(ids) <= PER_ROLE_CAP else rng.sample(ids, PER_ROLE_CAP)
        chosen.extend(take)
        print(f"  {role}: {len(take):,} of {len(ids):,}")
    print(f"  TOTAL: {len(chosen):,}")

    ops: list[UpdateOne] = []
    written = 0
    for batch_start in range(0, len(chosen), 1000):
        batch_ids = chosen[batch_start : batch_start + 1000]
        for doc in raw.find({"_id": {"$in": batch_ids}}):
            job = raw_doc_to_job_doc(doc)
            if job is None:
                continue
            # never reset the extraction checkpoint on an existing sample doc
            flags = {"extracted": job.pop("extracted")}
            ops.append(
                UpdateOne(
                    {"_id": job["_id"]},
                    {"$set": job, "$setOnInsert": flags},
                    upsert=True,
                )
            )
        if ops:
            sample.bulk_write(ops, ordered=False)
            written += len(ops)
            ops.clear()
            print(f"  upserted {written:,} ...")

    sample.create_index("og_title")
    sample.create_index("extracted")
    print(
        f"Done. sample_total={sample.estimated_document_count():,} "
        f"(collection: {SAMPLE_COLLECTION})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
