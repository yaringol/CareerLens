"""
Build a balanced CV sample from the local raw lang-uk CV corpus (M18).

Mirrors sample_local_corpus.py, but for careerlens.lang-uk-cv: maps the Djinni
`Primary Keyword` tag through the existing lang_uk_mapping (clean labels - no
noisy title normalization needed), filters short bodies, balances per canonical
role, and writes docs shaped for extract_skills_parallel.py (`description` +
`extracted` checkpoint).

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  CV_SAMPLE_COLLECTION=lang-uk-cv-sample \\
  PER_ROLE_CAP=1000 \\
  python sample_local_cvs.py
"""
from __future__ import annotations

import os
import random
from collections import defaultdict
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

from lang_uk_mapping import MIN_DESCRIPTION_LEN, map_primary_keyword
from mongo_env import get_mongo_uri

RAW_COLLECTION = os.getenv("RAW_CV_COLLECTION", "lang-uk-cv")
SAMPLE_COLLECTION = os.getenv("CV_SAMPLE_COLLECTION", "lang-uk-cv-sample")
PER_ROLE_CAP = int(os.getenv("PER_ROLE_CAP", "1000"))
SEED = int(os.getenv("SAMPLE_SEED", "42"))


def raw_cv_to_doc(doc: dict) -> dict | None:
    canonical = map_primary_keyword((doc.get("Primary Keyword") or "").strip())
    if canonical is None:
        return None
    body = (doc.get("CV") or "").strip()
    if len(body) < MIN_DESCRIPTION_LEN:
        return None
    return {
        "_id": str(doc["_id"]),
        "title": (doc.get("Position") or "").strip(),
        "og_title": canonical,
        "description": body,
        "primary_keyword": (doc.get("Primary Keyword") or "").strip(),
        "exp_years": doc.get("Experience Years"),
        "english_level": doc.get("English Level"),
        "source": "lang-uk-cv",
        "extracted": False,
        "imported_at": datetime.now(timezone.utc),
    }


def main() -> int:
    client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    raw = db[RAW_COLLECTION]
    sample = db[SAMPLE_COLLECTION]

    print(f"Scanning {RAW_COLLECTION} for mapped, non-trivial CVs ...")
    ids_by_role: dict[str, list] = defaultdict(list)
    scanned = 0
    for doc in raw.find({}, {"Primary Keyword": 1, "CV": 1}, batch_size=2000):
        scanned += 1
        canonical = map_primary_keyword((doc.get("Primary Keyword") or "").strip())
        if canonical is None:
            continue
        if len((doc.get("CV") or "").strip()) < MIN_DESCRIPTION_LEN:
            continue
        ids_by_role[canonical].append(doc["_id"])
    print(f"Scanned {scanned:,}; {sum(len(v) for v in ids_by_role.values()):,} eligible")

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
            cv_doc = raw_cv_to_doc(doc)
            if cv_doc is None:
                continue
            flags = {"extracted": cv_doc.pop("extracted")}
            ops.append(UpdateOne(
                {"_id": cv_doc["_id"]},
                {"$set": cv_doc, "$setOnInsert": flags},
                upsert=True,
            ))
        if ops:
            sample.bulk_write(ops, ordered=False)
            written += len(ops)
            ops.clear()
    sample.create_index("og_title")
    sample.create_index("extracted")
    print(f"Done. sample_total={sample.estimated_document_count():,} ({SAMPLE_COLLECTION})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
