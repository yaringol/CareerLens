"""
Import lang-uk job descriptions into MongoDB (raw, pre-SkillNer).

Usage:
  pip install datasets pymongo
  MONGO_URI=mongodb://localhost:27017/jobs python import_lang_uk_jobs.py

Optional env:
  MONGO_COLLECTION=lang-uk-job
  BATCH_SIZE=1000
  DATASET_NAME=lang-uk/recruitment-dataset-job-descriptions-english
"""
from __future__ import annotations

import os
import sys

from pymongo import MongoClient, UpdateOne

from lang_uk_mapping import row_to_job_doc

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/jobs")
COLLECTION = os.getenv("MONGO_COLLECTION", "lang-uk-job")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))
DATASET_NAME = os.getenv(
    "DATASET_NAME",
    "lang-uk/recruitment-dataset-job-descriptions-english",
)


def main() -> int:
    try:
        from datasets import load_dataset
    except ImportError:
        print("Missing dependency: pip install datasets", file=sys.stderr)
        return 1

    print(f"Loading HuggingFace dataset: {DATASET_NAME}")
    jobs = load_dataset(DATASET_NAME)["train"]

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    coll = client.get_default_database()[COLLECTION]
    print(f"Target: {MONGO_URI.split('@')[-1]} collection={COLLECTION}")

    ops: list[UpdateOne] = []
    upserted = 0
    skipped = 0

    for row in jobs:
        doc = row_to_job_doc(row)
        if doc is None:
            skipped += 1
            continue

        ops.append(UpdateOne({"_id": doc["_id"]}, {"$set": doc}, upsert=True))
        if len(ops) >= BATCH_SIZE:
            coll.bulk_write(ops, ordered=False)
            upserted += len(ops)
            ops.clear()
            print(f"  upserted {upserted:,} ...")

    if ops:
        coll.bulk_write(ops, ordered=False)
        upserted += len(ops)

    coll.create_index("og_title")
    coll.create_index("extracted")
    coll.create_index("datePosted")

    total = coll.estimated_document_count()
    print(
        f"Done. upserted={upserted:,}, skipped={skipped:,}, "
        f"total_in_collection={total:,}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
