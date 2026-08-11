"""
Sample clearly non-engineering CVs from lang-uk as __other__ training data (M19/W3).

The Primary Keyword tags that lang_uk_mapping deliberately drops split into two
groups: clearly non-engineering (Marketing, HR, Sales, ...) and ambiguous
(Data Analyst, Business Analyst, Other, Lead - careers that overlap engineering).
Only the first group is used here: the rejection class must not teach the model
to reject analyst-to-DS career changers.

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  OTHER_SAMPLE_COLLECTION=lang-uk-cv-other-sample \\
  PER_KEYWORD_CAP=250 \\
  python sample_other_cvs.py
"""
from __future__ import annotations

import os
import random
from collections import defaultdict
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

from lang_uk_mapping import MIN_DESCRIPTION_LEN
from mongo_env import get_mongo_uri
from taxonomy import OTHER_LABEL

RAW_COLLECTION = os.getenv("RAW_CV_COLLECTION", "lang-uk-cv")
SAMPLE_COLLECTION = os.getenv("OTHER_SAMPLE_COLLECTION", "lang-uk-cv-other-sample")
PER_KEYWORD_CAP = int(os.getenv("PER_KEYWORD_CAP", "250"))
SEED = int(os.getenv("SAMPLE_SEED", "42"))

# Clearly non-engineering Djinni tags. Ambiguous ones (Data Analyst, Business
# Analyst, Other, Lead) are deliberately excluded - see module docstring.
NON_ENGINEERING_KEYWORDS = [
    "Marketing", "HR", "Sales", "Support", "Recruiter", "Lead Generation",
    "Copywriter", "Legal", "Finance", "Artist", "Technical Writer",
]


def main() -> int:
    client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    raw = db[RAW_COLLECTION]
    sample = db[SAMPLE_COLLECTION]

    ids_by_kw: dict[str, list] = defaultdict(list)
    for doc in raw.find(
        {"Primary Keyword": {"$in": NON_ENGINEERING_KEYWORDS}},
        {"Primary Keyword": 1, "CV": 1}, batch_size=2000,
    ):
        if len((doc.get("CV") or "").strip()) >= MIN_DESCRIPTION_LEN:
            ids_by_kw[doc["Primary Keyword"]].append(doc["_id"])

    rng = random.Random(SEED)
    chosen: list = []
    print(f"Non-engineering sample (cap {PER_KEYWORD_CAP}/keyword, seed {SEED}):")
    for kw in sorted(ids_by_kw):
        ids = ids_by_kw[kw]
        take = ids if len(ids) <= PER_KEYWORD_CAP else rng.sample(ids, PER_KEYWORD_CAP)
        chosen.extend(take)
        print(f"  {kw}: {len(take):,} of {len(ids):,}")
    print(f"  TOTAL: {len(chosen):,}")

    ops: list[UpdateOne] = []
    for batch_start in range(0, len(chosen), 1000):
        for doc in raw.find({"_id": {"$in": chosen[batch_start:batch_start + 1000]}}):
            ops.append(UpdateOne(
                {"_id": str(doc["_id"])},
                {"$set": {
                    "title": (doc.get("Position") or "").strip(),
                    "og_title": OTHER_LABEL,
                    "description": (doc.get("CV") or "").strip(),
                    "primary_keyword": (doc.get("Primary Keyword") or "").strip(),
                    "source": "lang-uk-cv-nontech",
                    "imported_at": datetime.now(timezone.utc),
                }, "$setOnInsert": {"extracted": False}},
                upsert=True,
            ))
        if ops:
            sample.bulk_write(ops, ordered=False)
            ops.clear()
    sample.create_index("extracted")
    print(f"Done. sample_total={sample.estimated_document_count():,} ({SAMPLE_COLLECTION})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
