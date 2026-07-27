"""
Generate marked synthetic skill-records that extend the corpus 2023H2 -> 2026H1.

The real lang-uk corpus ends mid-2023. This generator creates per-role synthetic
postings whose base skills are sampled from the role's REAL extracted skill
distribution (so synthetic records look like the market they extend), with the
curated 2024-2026 emerging skills (market_2026_skills.py) injected on a linear
prevalence ramp, and fading skills down-weighted.

Honesty contract (project iron rule - never fake data silently):
  every generated doc carries source='augmented-2026', augmented=True and
  augmentation_method - and the generation is documented in the M06 report.

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  REAL_COLLECTION=lang-uk-job-skills \\
  AUG_COLLECTION=augmented-2026 \\
  DOCS_PER_ROLE_PERIOD=150 \\
  python augment_2026.py [--dry-run]

Deterministic (AUG_SEED, default 42); re-running drops and regenerates the
augmented collection - it never touches real collections.
"""
from __future__ import annotations

import os
import random
import sys
from collections import Counter
from datetime import datetime, timezone

from pymongo import MongoClient

from market_2026_skills import EMERGING_SKILLS, FADING_SKILLS, PERIODS, ramp_probability
from mongo_env import get_mongo_uri
from skill_schema import build_skill_records

REAL_COLLECTION = os.getenv("REAL_COLLECTION", "lang-uk-job-skills")
AUG_COLLECTION = os.getenv("AUG_COLLECTION", "augmented-2026")
DOCS_PER_ROLE_PERIOD = int(os.getenv("DOCS_PER_ROLE_PERIOD", "150"))
SEED = int(os.getenv("AUG_SEED", "42"))
BASE_POOL_SIZE = 50
BASE_SKILLS_PER_DOC = (8, 14)
FADING_WEIGHT = 0.25

PERIOD_BOUNDS = {
    "2023H2": (datetime(2023, 7, 1, tzinfo=timezone.utc), datetime(2023, 12, 31, tzinfo=timezone.utc)),
    "2024H1": (datetime(2024, 1, 1, tzinfo=timezone.utc), datetime(2024, 6, 30, tzinfo=timezone.utc)),
    "2024H2": (datetime(2024, 7, 1, tzinfo=timezone.utc), datetime(2024, 12, 31, tzinfo=timezone.utc)),
    "2025H1": (datetime(2025, 1, 1, tzinfo=timezone.utc), datetime(2025, 6, 30, tzinfo=timezone.utc)),
    "2025H2": (datetime(2025, 7, 1, tzinfo=timezone.utc), datetime(2025, 12, 31, tzinfo=timezone.utc)),
    "2026H1": (datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 6, 30, tzinfo=timezone.utc)),
}


def real_base_pool(coll, role: str) -> list[tuple[str, float]]:
    """Top skills for a role from the real extracted docs, weighted by document
    frequency, fading skills down-weighted."""
    counts: Counter[str] = Counter()
    docs = 0
    for doc in coll.find({"og_title": role}, {"skills": 1}):
        docs += 1
        seen = set()
        for m in (doc.get("skills") or {}).get("full_matches", []):
            sk = (m.get("doc_node_value") or "").lower().strip()
            if len(sk) >= 3:
                seen.add(sk)
        for m in (doc.get("skills") or {}).get("ngram_matches", []):
            sk = (m.get("doc_node_value") or "").lower().strip()
            if len(sk) >= 3 and float(m.get("score", 0)) >= 0.9:
                seen.add(sk)
        counts.update(seen)
    if docs == 0:
        return []
    fading = set(FADING_SKILLS.get(role, []))
    pool = []
    for sk, n in counts.most_common(BASE_POOL_SIZE * 2):
        w = n / docs
        if sk in fading:
            w *= FADING_WEIGHT
        pool.append((sk, w))
    pool.sort(key=lambda kv: -kv[1])
    return pool[:BASE_POOL_SIZE]


def make_doc(rng: random.Random, role: str, period: str, idx: int,
             pool: list[tuple[str, float]]) -> dict:
    lo, hi = PERIOD_BOUNDS[period]
    posted = lo + (hi - lo) * rng.random()
    n_base = rng.randint(*BASE_SKILLS_PER_DOC)
    skills_set: set[str] = set()
    names = [sk for sk, _ in pool]
    weights = [w for _, w in pool]
    while len(skills_set) < min(n_base, len(names)):
        skills_set.add(rng.choices(names, weights=weights, k=1)[0])
    for skill, ramp_def in EMERGING_SKILLS.get(role, {}).items():
        if rng.random() < ramp_probability(ramp_def, period):
            skills_set.add(skill)
    doc = {
        "_id": f"aug-{role.lower().replace(' ', '-')}-{period}-{idx:04d}",
        "og_title": role,
        "title": f"{role} (synthetic market-trend record)",
        "datePosted": posted,
        "skills": {
            "full_matches": [{"doc_node_value": sk} for sk in sorted(skills_set)],
            "ngram_matches": [],
        },
        "source": "augmented-2026",
        "augmented": True,
        "augmentation_method": "curated-list-ramp-v1",
        "generated_at": datetime.now(timezone.utc),
    }
    # Precompute skill_records exactly like extract_skills.py does for real docs,
    # so both sources take the identical (stored-records) path through train.py.
    doc["skill_records"] = build_skill_records(doc)
    doc["schema_version"] = 2
    return doc


def main() -> int:
    dry = "--dry-run" in sys.argv
    rng = random.Random(SEED)
    client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    real = db[REAL_COLLECTION]
    aug = db[AUG_COLLECTION]

    roles = sorted(EMERGING_SKILLS)
    print(f"Base pools from {REAL_COLLECTION} ({real.estimated_document_count():,} real docs)")
    docs: list[dict] = []
    for role in roles:
        pool = real_base_pool(real, role)
        if not pool:
            print(f"  {role}: NO REAL DOCS YET - skipped")
            continue
        emerging_count = 0
        for period in PERIODS:
            for i in range(DOCS_PER_ROLE_PERIOD):
                d = make_doc(rng, role, period, i, pool)
                docs.append(d)
        sample_2026 = [d for d in docs if d["og_title"] == role and d["datePosted"].year == 2026]
        with_llm_era = sum(
            1 for d in sample_2026
            if any(m["doc_node_value"] in EMERGING_SKILLS[role] for m in d["skills"]["full_matches"])
        )
        print(f"  {role}: pool={len(pool)} top5={[sk for sk, _ in pool[:5]]}")
        print(f"    2026H1 docs with emerging skills: {with_llm_era}/{len(sample_2026)}")

    print(f"\nGenerated {len(docs):,} synthetic docs "
          f"({DOCS_PER_ROLE_PERIOD}/role/period x {len(PERIODS)} periods)")
    if dry:
        print("Dry-run: nothing written.")
        return 0

    aug.drop()
    if docs:
        aug.insert_many(docs)
    aug.create_index("og_title")
    aug.create_index("datePosted")
    print(f"Wrote {aug.estimated_document_count():,} docs to {AUG_COLLECTION} (marked augmented).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
