"""
Batch SkillNer extraction for Mongo job collections.

Reads raw postings (description text), writes extracted skills to a target
collection, and marks the source document as extracted so runs are resumable.

Usage:
  MONGO_URI=mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin \\
  SOURCE_COLLECTION=lang-uk-job \\
  TARGET_COLLECTION=lang-uk-job-skills \\
  python extract_skills.py

Optional env:
  DESCRIPTION_FIELD=description
  BATCH_SIZE=100
  LIMIT=500            # cap for testing; omit for full run
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from typing import Any

import numpy as np
import spacy
from pymongo import MongoClient, UpdateOne
from skillNer.general_params import SKILL_DB
from skillNer.skill_extractor_class import SkillExtractor
from spacy.matcher import PhraseMatcher
from skill_schema import build_skill_records

MONGO_URI = os.getenv("MONGO_URI", "mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin")
SOURCE_COLLECTION = os.getenv("SOURCE_COLLECTION", "lang-uk-job")
TARGET_COLLECTION = os.getenv("TARGET_COLLECTION", "lang-uk-job-skills")
DESCRIPTION_FIELD = os.getenv("DESCRIPTION_FIELD", "description")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))
LIMIT = int(os.getenv("LIMIT", "0")) or None


def build_skill_extractor() -> SkillExtractor:
    nlp = spacy.load("en_core_web_lg")
    return SkillExtractor(nlp, SKILL_DB, PhraseMatcher)


def extract_skills_from_text(skill_extractor: SkillExtractor, text: str) -> dict[str, list]:
    try:
        annotations = skill_extractor.annotate(text)
        results = annotations.get("results", {})
        return {
            "full_matches": results.get("full_matches", []),
            "ngram_matches": results.get("ngram_scored", []),
        }
    except Exception as exc:
        print(f"  SkillNer failed ({exc.__class__.__name__}): skipping skills for this doc")
        return {"full_matches": [], "ngram_matches": []}


def pending_query() -> dict[str, Any]:
    return {
        DESCRIPTION_FIELD: {"$exists": True, "$type": "string", "$ne": ""},
        "$or": [{"extracted": {"$ne": True}}, {"extracted": {"$exists": False}}],
    }


def mongo_safe(value: Any) -> Any:
    """Convert SkillNer numpy scalars to native Python types for BSON."""
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


def training_doc(source: dict[str, Any], skills: dict[str, list]) -> dict[str, Any]:
    doc = {k: v for k, v in source.items() if k != "_id"}
    doc["skills"] = mongo_safe(skills)
    doc["skill_records"] = mongo_safe(
        build_skill_records({**doc, "skills": skills})
    )
    doc["schema_version"] = 2
    doc["extracted"] = True
    doc["extracted_at"] = datetime.now(timezone.utc)
    doc["source_collection"] = SOURCE_COLLECTION
    return doc


def main() -> int:
    print("Loading spaCy + SkillNer (this can take a minute)...")
    skill_extractor = build_skill_extractor()

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    source = db[SOURCE_COLLECTION]
    target = db[TARGET_COLLECTION]

    print(
        f"Source: {MONGO_URI.split('@')[-1]}/{SOURCE_COLLECTION} "
        f"-> Target: {TARGET_COLLECTION}"
    )

    cursor = source.find(pending_query(), batch_size=BATCH_SIZE)
    if LIMIT is not None:
        cursor = cursor.limit(LIMIT)

    processed = 0
    skipped_empty = 0
    target_ops: list[UpdateOne] = []
    source_ops: list[UpdateOne] = []

    for item in cursor:
        text = (item.get(DESCRIPTION_FIELD) or "").strip()
        if len(text) < 20:
            skipped_empty += 1
            source_ops.append(
                UpdateOne({"_id": item["_id"]}, {"$set": {"extracted": True, "extract_skipped": True}})
            )
            continue

        skills = extract_skills_from_text(skill_extractor, text)
        doc_id = item["_id"]
        target_ops.append(
            UpdateOne({"_id": doc_id}, {"$set": training_doc(item, skills)}, upsert=True)
        )
        source_ops.append(
            UpdateOne({"_id": doc_id}, {"$set": {"extracted": True, "extracted_at": datetime.now(timezone.utc)}})
        )
        processed += 1

        if len(target_ops) >= BATCH_SIZE:
            target.bulk_write(target_ops, ordered=False)
            source.bulk_write(source_ops, ordered=False)
            target_ops.clear()
            source_ops.clear()
            print(f"  extracted {processed:,} ...")

    if target_ops:
        target.bulk_write(target_ops, ordered=False)
        source.bulk_write(source_ops, ordered=False)

    target.create_index("og_title")
    target.create_index("datePosted")
    target.create_index("skill_records.skill")
    target.create_index("skill_records.observed_at")
    source.create_index("extracted")

    print(
        f"Done. extracted={processed:,}, skipped_empty={skipped_empty:,}, "
        f"target_total={target.estimated_document_count():,}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
