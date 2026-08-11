"""
Import master_resumes.jsonl into Mongo, shaped for extract_skills_parallel.py (M18).

master_resumes.jsonl (4,817 structured CVs) is the training corpus of the shipped
text classifier; its titles map to canonical roles via taxonomy.master_label -
covering roles the lang-uk corpus lacks. Each record becomes a flat-text doc:
summary + responsibilities + project descriptions + declared skill names, with
every raw experience-title string scrubbed from the text (mirrors the
classifier's leakage scrub) - labels must come from the mapping, never from the
text itself.

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  MASTER_COLLECTION=master-resumes-sample \\
  python import_master_resumes.py
"""
from __future__ import annotations

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

from mongo_env import get_mongo_uri
from taxonomy import master_label

JSONL_PATH = os.getenv("MASTER_JSONL", "master_resumes.jsonl")
COLLECTION = os.getenv("MASTER_COLLECTION", "master-resumes-sample")
MIN_TEXT_LEN = 100


def record_text(rec: dict) -> tuple[str, list[str]]:
    """Flat text for SkillNer + the raw title strings to scrub out."""
    parts: list[str] = []
    titles: list[str] = []
    summary = ((rec.get("personal_info") or {}).get("summary") or "").strip()
    if summary and summary.lower() != "unknown":
        parts.append(summary)
    for job in rec.get("experience") or []:
        title = (job.get("title") or "").strip()
        if title and title.lower() != "unknown":
            titles.append(title)
        for resp in job.get("responsibilities") or []:
            if isinstance(resp, str) and resp.strip():
                parts.append(resp.strip())
    for proj in rec.get("projects") or []:
        desc = (proj.get("description") or "") if isinstance(proj, dict) else ""
        if desc.strip():
            parts.append(desc.strip())
    tech = ((rec.get("skills") or {}).get("technical") or {})
    for group in tech.values():
        if isinstance(group, list):
            for item in group:
                name = item.get("name") if isinstance(item, dict) else item
                if isinstance(name, str) and name.strip():
                    parts.append(name.strip())
    text = ". ".join(parts)
    for title in titles:
        text = re.sub(re.escape(title), " ", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip(), titles


def main() -> int:
    client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    coll = db[COLLECTION]

    ops: list[UpdateOne] = []
    kept = 0
    dropped_label = 0
    dropped_text = 0
    label_counts: Counter[str] = Counter()

    with open(JSONL_PATH, encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            exp = rec.get("experience") or []
            raw_title = (exp[0].get("title") if exp else None) or None
            canonical = master_label(raw_title)
            if canonical is None:
                dropped_label += 1
                continue
            text, _titles = record_text(rec)
            if len(text) < MIN_TEXT_LEN:
                dropped_text += 1
                continue
            label_counts[canonical] += 1
            kept += 1
            ops.append(UpdateOne(
                {"_id": f"master-{i:05d}"},
                {"$set": {
                    "title": raw_title,
                    "og_title": canonical,
                    "description": text,
                    "source": "master_resumes",
                    "imported_at": datetime.now(timezone.utc),
                }, "$setOnInsert": {"extracted": False}},
                upsert=True,
            ))
            if len(ops) >= 1000:
                coll.bulk_write(ops, ordered=False)
                ops.clear()
    if ops:
        coll.bulk_write(ops, ordered=False)

    coll.create_index("og_title")
    coll.create_index("extracted")
    print(f"kept={kept:,} dropped_label={dropped_label:,} dropped_short_text={dropped_text:,}")
    print(f"canonical classes: {len(label_counts)}")
    for label, n in label_counts.most_common():
        print(f"  {label}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
