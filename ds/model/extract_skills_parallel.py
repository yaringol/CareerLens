"""
Parallel wrapper around extract_skills.py for large local corpora.

SkillNer is CPU-bound and single-threaded (~2.3s/doc); this shards the pending
documents across N worker processes. Same checkpoint semantics as
extract_skills.py (`extracted: true` on the source doc) - safe to stop and
resume, never extracts the same document twice. Shards are disjoint by
construction (a snapshot of pending _ids is split round-robin), so workers
cannot race each other.

Usage (orchestrator - spawns workers and waits):
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  SOURCE_COLLECTION=lang-uk-job-sample \\
  TARGET_COLLECTION=lang-uk-job-skills \\
  WORKERS=8 \\
  python extract_skills_parallel.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import datetime, timezone

from pymongo import MongoClient, UpdateOne

from extract_skills import (
    MONGO_URI,
    SOURCE_COLLECTION,
    TARGET_COLLECTION,
    build_skill_extractor,
    extract_skills_from_text,
    pending_query,
    training_doc,
)

WORKERS = int(os.getenv("WORKERS", "8"))
FLUSH_EVERY = 50


def pending_ids(db) -> list:
    return [d["_id"] for d in db[SOURCE_COLLECTION].find(pending_query(), {"_id": 1})]


def run_worker(shard_index: int) -> int:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    source = db[SOURCE_COLLECTION]
    target = db[TARGET_COLLECTION]

    ids = pending_ids(db)[shard_index::WORKERS]
    total = len(ids)
    print(f"[w{shard_index}] {total:,} docs; loading SkillNer ...", flush=True)
    extractor = build_skill_extractor()
    print(f"[w{shard_index}] ready", flush=True)

    target_ops: list[UpdateOne] = []
    source_ops: list[UpdateOne] = []
    done = 0
    t0 = time.time()

    def flush():
        if target_ops:
            target.bulk_write(target_ops, ordered=False)
            source.bulk_write(source_ops, ordered=False)
            target_ops.clear()
            source_ops.clear()

    for chunk_start in range(0, total, 200):
        chunk = ids[chunk_start : chunk_start + 200]
        for item in source.find({"_id": {"$in": chunk}, "extracted": {"$ne": True}}):
            text = (item.get("description") or "").strip()
            if len(text) < 20:
                source_ops.append(UpdateOne(
                    {"_id": item["_id"]},
                    {"$set": {"extracted": True, "extract_skipped": True}},
                ))
                continue
            skills = extract_skills_from_text(extractor, text)
            target_ops.append(UpdateOne(
                {"_id": item["_id"]}, {"$set": training_doc(item, skills)}, upsert=True
            ))
            source_ops.append(UpdateOne(
                {"_id": item["_id"]},
                {"$set": {"extracted": True, "extracted_at": datetime.now(timezone.utc)}},
            ))
            done += 1
            if done % FLUSH_EVERY == 0:
                flush()
                rate = done / (time.time() - t0)
                eta_h = (total - done) / rate / 3600 if rate else 0
                print(f"[w{shard_index}] {done:,}/{total:,} ({rate:.2f}/s, eta {eta_h:.1f}h)", flush=True)
    flush()
    print(f"[w{shard_index}] DONE {done:,}/{total:,}", flush=True)
    return 0


def run_orchestrator() -> int:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    n_pending = len(pending_ids(db))
    print(f"Pending: {n_pending:,} docs in {SOURCE_COLLECTION}; spawning {WORKERS} workers", flush=True)
    if n_pending == 0:
        print("Nothing to do.")
        return 0

    procs = []
    for i in range(WORKERS):
        procs.append(subprocess.Popen(
            [sys.executable, __file__, "--worker", str(i)],
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        ))
        time.sleep(2)  # stagger spaCy model loads

    failed = 0
    for i, p in enumerate(procs):
        code = p.wait()
        if code != 0:
            failed += 1
            print(f"WORKER {i} EXITED WITH CODE {code}", flush=True)

    target = db[TARGET_COLLECTION]
    target.create_index("og_title")
    target.create_index("datePosted")
    target.create_index("skill_records.skill")
    db[SOURCE_COLLECTION].create_index("extracted")
    remaining = db[SOURCE_COLLECTION].count_documents(pending_query())
    print(
        f"ALL DONE. workers_failed={failed} remaining_pending={remaining:,} "
        f"target_total={target.estimated_document_count():,}", flush=True
    )
    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--worker":
        raise SystemExit(run_worker(int(sys.argv[2])))
    raise SystemExit(run_orchestrator())
