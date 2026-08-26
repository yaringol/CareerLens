"""
Convert the synthetic augmented-2026 collection to the real scraped-posting schema.

Every field the LinkedIn scraper writes is produced here with the SAME generator or
the SAME measured distribution as a real posting, so a converted document is
structurally indistinguishable from a scraped one:

  _id            - scraping/external/linkedin.py::generate_job_id (imported, not copied)
  skill_id       - resolved against the REAL corpus (lang-uk-job-skills already carries
                   SkillNer ids); curated 2024-2026 emerging skills have no SkillNer id
                   and keep None, exactly as a real extraction leaves them
  doc_node_id    - token spans laid out over one simulated document whose length is
                   drawn from the real corpus (mean max index 221)
  ngram_matches  - sampled from the real per-role ngram pool, preserving the measured
                   type mix (lowSurf 49% / fullUni 28% / oneToken 22%) and count (~23/doc)
  skill_records  - rebuilt by skill_schema.build_skill_records, the real builder
  key order      - full_matches use the two key orders the real corpus contains, at the
                   measured 83/17 ratio; matches are sorted by position with a short
                   out-of-order tail (61% of real docs), as SkillNer emits them

The ONLY field not reproduced is `description`: these records were sampled as skill
sets, never generated from posting text, so there is no source text to emit.

Deterministic: each document's randomness is seeded from its source _id, so re-running
produces identical output. Writes to a NEW collection; never touches the source.

Usage:
  MONGO_URI=mongodb://localhost:27017/careerlens \\
  python convert_augmented_to_job_schema.py [--dry-run]
"""
from __future__ import annotations

import base64
import os
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote

from pymongo import MongoClient, ReplaceOne

from mongo_env import get_mongo_uri
from skill_schema import build_skill_records

_SCRAPING_DIR = Path(__file__).resolve().parents[2] / "scraping" / "external"
if str(_SCRAPING_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPING_DIR))
from linkedin import generate_job_id

SRC_COLLECTION = os.getenv("SRC_COLLECTION", "augmented-2026")
DST_COLLECTION = os.getenv("DST_COLLECTION", "augmented-2026-jobschema")
REAL_COLLECTION = os.getenv("REAL_COLLECTION", "lang-uk-job-skills")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "500"))
NGRAM_POOL_PER_ROLE = int(os.getenv("NGRAM_POOL_PER_ROLE", "4000"))
SEED = int(os.getenv("CONVERT_SEED", "42"))

# Measured on lang-uk-job-skills (4000-doc sample) - see the module docstring.
NGRAM_PER_DOC_MEAN = 23.5
NGRAM_PER_DOC_SD = 8.0
# Document length is lognormal, tuned so the mean highest doc_node_id lands on the
# corpus's 223 with the same long tail (real max observed: 1140).
DOC_LEN_LOG_MU = 5.19
DOC_LEN_LOG_SIGMA = 0.65
DOC_LEN_CAP = 1200           # longest document observed in the real corpus
# ngram type mix: lowSurf 19519 / fullUni 11027 / oneToken 8726
NGRAM_TYPE_MIX = {"lowSurf": 0.497, "fullUni": 0.281, "oneToken": 0.222}
# Real docs match the same ngram surface form at several positions: 23.62 matches
# per doc over 20.05 distinct values. Without this the distinct count runs high,
# and every extra distinct value becomes an extra skill_record.
NGRAM_DUP_RATE = 0.151
REPEAT_RATE = 0.114          # full_matches 8.25/doc vs 7.31 unique values
ALT_KEY_ORDER_RATE = 0.17    # 553 / (2688 + 553) full_matches
UNSORTED_TAIL_RATE = 0.61    # 243 / 400 docs carry an out-of-order tail

# On LinkedIn `industry` comes from the company page, so it is a property of the
# company - the same employer always posts under the same industry. Pairing the two
# independently would give one company several industries across the collection.
COMPANY_INDUSTRY = {
    "Wiz": "Computer and Network Security",
    "monday.com": "Software Development",
    "Check Point Software Technologies": "Computer and Network Security",
    "CyberArk": "Computer and Network Security",
    "Fireblocks": "Financial Services",
    "Snyk": "Computer and Network Security",
    "JFrog": "Software Development",
    "Lightricks": "Software Development",
    "Gong": "Software Development",
    "Riskified": "Financial Services",
    "Melio": "Financial Services",
    "Deel": "Software Development",
    "SentinelOne": "Computer and Network Security",
    "NVIDIA": "Semiconductor Manufacturing",
    "Intel": "Semiconductor Manufacturing",
    "AI21 Labs": "Software Development",
    "Island": "Computer and Network Security",
    "Armis": "Computer and Network Security",
    "Redis": "Software Development",
    "Elastic": "Software Development",
    "Datadog": "Software Development",
    "Payoneer": "Financial Services",
    "Similarweb": "Technology, Information and Internet",
    "Taboola": "Advertising Services",
    "Outbrain": "Advertising Services",
    "Verbit": "Software Development",
    "Rapyd": "Financial Services",
    "eToro": "Financial Services",
    "Cellebrite": "Computer and Network Security",
    "NICE": "Software Development",
    "Amdocs": "IT Services and IT Consulting",
    "Elbit Systems": "Defense and Space Manufacturing",
    "Mobileye": "Semiconductor Manufacturing",
    "Playtika": "Technology, Information and Internet",
    "Fiverr": "Technology, Information and Internet",
    "Wix": "Software Development",
    "Via": "Software Development",
    "Cato Networks": "Computer and Network Security",
    "Claroty": "Computer and Network Security",
    "Axonius": "Computer and Network Security",
    "Coralogix": "Software Development",
    "Aqua Security": "Computer and Network Security",
    "BigID": "Computer and Network Security",
    "Orca Security": "Computer and Network Security",
    "VAST Data": "Computer Hardware Manufacturing",
    "WEKA": "Computer Hardware Manufacturing",
    "Next Insurance": "Financial Services",
    "Tipalti": "Financial Services",
    "Papaya Global": "Software Development",
    "HiBob": "Software Development",
    "Kaltura": "Software Development",
    "Cybereason": "Computer and Network Security",
    "Perion Network": "Advertising Services",
    "Matrix IT": "IT Services and IT Consulting",
    "One1": "IT Services and IT Consulting",
    "John Bryce": "IT Services and IT Consulting",
    "Malam Team": "IT Services and IT Consulting",
    "Ness Technologies": "IT Services and IT Consulting",
    "Aman Group": "IT Services and IT Consulting",
    "YouCC Technologies Ltd.": "IT Services and IT Consulting",
    "Experis Israel": "Staffing and Recruiting",
    "Ethosia": "Staffing and Recruiting",
    "Nisha Group": "Staffing and Recruiting",
    "SQLink": "Staffing and Recruiting",
    "Bezeq": "Telecommunications",
    "Partner Communications": "Telecommunications",
}
COMPANIES = list(COMPANY_INDUSTRY)
CITIES = [
    "Tel Aviv", "Tel Aviv-Yafo", "Herzliya", "Ramat Gan", "Petah Tikva", "Haifa",
    "Raanana", "Rishon LeZion", "Netanya", "Jerusalem", "Beer Sheva", "Caesarea",
    "Yokneam Illit", "Rehovot", "Hod Hasharon", "Airport City", "Kfar Saba", "Modiin",
]
EMPLOYMENT_TYPES = (
    ["FULL_TIME"] * 92 + ["PART_TIME"] * 4 + ["CONTRACTOR"] * 3 + ["TEMPORARY"]
)
# LinkedIn titles are noisy: seniority prefixes, location suffixes, stray trailing
# whitespace. The plain role dominates, as it does in the real corpus.
TITLE_PATTERNS = [
    "{role}", "{role}", "{role}", "{role}", "{role} ",
    "Senior {role}", "Senior {role}", "Junior {role}", "Lead {role}",
    "{role} - {city}", "{role} ({city})", "{role} - Hybrid", "{role} (Hybrid)",
    "Experienced {role}", "{role} Team Lead", "{role} - Student Position",
]


def slugify(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def linkedin_token(rng: random.Random) -> str:
    """URL-encoded base64 of 16 bytes - the shape of LinkedIn's refId / trackingId."""
    raw = bytes(rng.randrange(256) for _ in range(16))
    return quote(base64.b64encode(raw).decode(), safe="")


def build_job_url(rng: random.Random, title: str, company: str) -> str:
    posting_id = rng.randrange(4_100_000_000, 4_499_999_999)
    slug = f"{slugify(title)}-at-{slugify(company)}-{posting_id}"
    return (
        f"https://il.linkedin.com/jobs/view/{slug}"
        f"?position={rng.randint(1, 25)}&pageNum={rng.randint(0, 3)}"
        f"&refId={linkedin_token(rng)}&trackingId={linkedin_token(rng)}"
    )


def build_skill_id_map(real_coll) -> dict[str, str]:
    """doc_node_value (lowercased) -> the skill_id SkillNer assigned it in the real
    corpus. When a surface form carries several ids, the most frequent one wins."""
    votes: dict[str, Counter] = defaultdict(Counter)
    cursor = real_coll.find({}, {"skills.full_matches": 1, "skills.ngram_matches": 1})
    for doc in cursor:
        skills = doc.get("skills") or {}
        for bucket in ("full_matches", "ngram_matches"):
            for match in skills.get(bucket) or []:
                value = (match.get("doc_node_value") or "").lower().strip()
                skill_id = match.get("skill_id")
                if value and skill_id:
                    votes[value][skill_id] += 1
    return {value: counter.most_common(1)[0][0] for value, counter in votes.items()}


def build_ngram_pools(real_coll, roles: list[str]) -> dict[str, dict[str, list[dict]]]:
    """Per-role, per-type pool of REAL ngram matches, so the generated noise carries
    the corpus's own vocabulary and score distribution. Keeping the pools split by
    type lets each document draw its own type mix at the measured ratio - a single
    deduplicated pool flattens the frequencies and skews the mix."""
    pools: dict[str, dict[str, list[dict]]] = {}
    for role in roles:
        seen: dict[tuple, dict] = {}
        cursor = real_coll.find(
            {"og_title": role}, {"skills.ngram_matches": 1}
        ).limit(NGRAM_POOL_PER_ROLE)
        for doc in cursor:
            for match in (doc.get("skills") or {}).get("ngram_matches") or []:
                value = (match.get("doc_node_value") or "").strip()
                if not value:
                    continue
                key = (value.lower(), match.get("type"))
                if key not in seen:
                    seen[key] = {
                        "skill_id": match.get("skill_id"),
                        "doc_node_value": value,
                        "type": match.get("type"),
                        "score": match.get("score"),
                        "len": match.get("len", len(value.split())),
                    }
        by_type: dict[str, list[dict]] = defaultdict(list)
        for match in seen.values():
            by_type[match["type"]].append(match)
        pools[role] = dict(by_type)
    return pools


def sample_ngrams(rng: random.Random, by_type: dict[str, list[dict]],
                  n_total: int, exclude: set[str]) -> list[dict]:
    """Draw n_total ngram matches, splitting the draw across types at the corpus's
    measured ratio rather than uniformly over a flattened pool."""
    n_distinct = int(round(n_total * (1.0 - NGRAM_DUP_RATE)))
    out: list[dict] = []
    for type_name, share in NGRAM_TYPE_MIX.items():
        candidates = [
            m for m in by_type.get(type_name) or []
            if m["doc_node_value"].lower() not in exclude
        ]
        if not candidates:
            continue
        want = int(round(n_distinct * share))
        out.extend(rng.sample(candidates, min(want, len(candidates))))
    # Re-match a share of them elsewhere in the document, as a real extraction does:
    # the same surface form appearing twice in the text yields two matches, one
    # skill_record. Without this the distinct count - and the record count - run high.
    if out:
        for _ in range(max(0, n_total - len(out))):
            out.append(rng.choice(out))
    rng.shuffle(out)
    return out


def allocate_spans(rng: random.Random, token_counts: list[int], doc_len: int) -> list[list[int]]:
    """Scatter every match as a consecutive token span across a doc_len-token
    document. Positions are drawn uniformly over the whole document (not walked
    forward with small gaps), so the highest doc_node_id tracks the document length
    the way a real extraction does instead of clustering near the top."""
    spans: list[list[int]] = []
    for count in token_counts:
        start = rng.randrange(0, max(1, doc_len - count))
        spans.append(list(range(start, start + count)))
    return spans


def convert(doc: dict, skill_id_map: dict[str, str], ngram_pools: dict[str, list[dict]],
            stats: Counter, unresolved: Counter) -> dict:
    rng = random.Random(f"{SEED}:{doc['_id']}")
    role = doc.get("og_title") or ""

    # ---- posting metadata --------------------------------------------------
    company = rng.choice(COMPANIES)
    city = rng.choice(CITIES)
    title = rng.choice(TITLE_PATTERNS).format(role=role, city=city)
    title = title.replace("&", "&amp;")
    url = build_job_url(rng, title, company)
    date_posted = doc.get("datePosted")
    scraped_at = (
        date_posted + timedelta(seconds=rng.randint(3600, 5 * 24 * 3600))
        if date_posted else None
    )

    # ---- full_matches: the planted skills, repeated at the real rate -------
    planted = [
        (m.get("doc_node_value") or "").strip()
        for m in (doc.get("skills") or {}).get("full_matches") or []
        if (m.get("doc_node_value") or "").strip()
    ]
    values = list(planted)
    for value in planted:
        if rng.random() < REPEAT_RATE:
            values.append(value)
    rng.shuffle(values)

    # ---- ngram_matches: sampled from the real per-role pool ----------------
    planted_lower = {v.lower() for v in planted}
    n_ngram = max(0, int(rng.gauss(NGRAM_PER_DOC_MEAN, NGRAM_PER_DOC_SD)))
    ngram_sample = sample_ngrams(
        rng, ngram_pools.get(role) or {}, n_ngram, planted_lower
    )

    # ---- token layout over one simulated document --------------------------
    token_counts = [len(v.split()) for v in values]
    token_counts += [len(m["doc_node_value"].split()) for m in ngram_sample]
    doc_len = min(DOC_LEN_CAP, int(rng.lognormvariate(DOC_LEN_LOG_MU, DOC_LEN_LOG_SIGMA)))
    doc_len = max(doc_len, sum(token_counts) + 8)
    spans = allocate_spans(rng, token_counts, doc_len)
    full_spans, ngram_spans = spans[:len(values)], spans[len(values):]

    full_matches = []
    for value, span in zip(values, full_spans):
        skill_id = skill_id_map.get(value.lower())
        stats["skill_id_resolved" if skill_id else "skill_id_null"] += 1
        if not skill_id:
            unresolved[value.lower()] += 1
        if rng.random() < ALT_KEY_ORDER_RATE:
            full_matches.append({"skill_id": skill_id, "score": 1,
                                 "doc_node_value": value, "doc_node_id": span})
        else:
            full_matches.append({"skill_id": skill_id, "doc_node_value": value,
                                 "score": 1, "doc_node_id": span})

    ngram_matches = [
        {"skill_id": m["skill_id"], "doc_node_id": span,
         "doc_node_value": m["doc_node_value"], "type": m["type"],
         "score": m["score"], "len": m["len"]}
        for m, span in zip(ngram_sample, ngram_spans)
    ]

    # SkillNer emits matches in document order with a short out-of-order tail.
    full_matches.sort(key=lambda m: m["doc_node_id"][0])
    ngram_matches.sort(key=lambda m: m["doc_node_id"][0])
    if len(full_matches) > 3 and rng.random() < UNSORTED_TAIL_RATE:
        moved = [full_matches.pop(rng.randrange(len(full_matches)))
                 for _ in range(rng.randint(1, 3))]
        full_matches.extend(moved)

    skills = {"full_matches": full_matches, "ngram_matches": ngram_matches}

    # ---- skill_records: rebuilt by the real builder -------------------------
    records = build_skill_records(
        {"skills": skills, "datePosted": date_posted,
         "scraped_at": scraped_at, "extracted_at": None},
        force_rebuild=True,
    )
    stats["records_in"] += len(doc.get("skill_records") or [])
    stats["records_out"] += len(records)

    # ---- assemble in the scraper's field order ------------------------------
    return {
        "_id": generate_job_id(title, company, url),
        "title": title,
        "og_title": role,
        "employment_type": rng.choice(EMPLOYMENT_TYPES),
        "company": company,
        "industry": COMPANY_INDUSTRY[company],
        "skills": skills,
        "location": city,
        "country": "IL",
        "datePosted": date_posted,
        "source": "Linkedin",
        "url": url,
        "scraped_at": scraped_at,
        "schema_version": 2,
        "skill_records": records,
    }


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    db = MongoClient(get_mongo_uri()).get_default_database()
    src, dst, real = db[SRC_COLLECTION], db[DST_COLLECTION], db[REAL_COLLECTION]

    print(f"source     : {SRC_COLLECTION} ({src.count_documents({})} docs)")
    print(f"destination: {DST_COLLECTION}{' [DRY RUN]' if dry_run else ''}")

    print(f"building skill_id map from {REAL_COLLECTION} ...")
    skill_id_map = build_skill_id_map(real)
    print(f"  {len(skill_id_map)} surface forms with a SkillNer id")

    roles = src.distinct("og_title")
    print(f"building ngram pools for {len(roles)} roles ...")
    ngram_pools = build_ngram_pools(real, roles)
    for role in roles:
        print(f"  {role:<26} {len(ngram_pools[role])} distinct real ngram matches")

    stats: Counter = Counter()
    unresolved: Counter = Counter()
    seen_ids: set[str] = set()
    # ReplaceOne, not UpdateOne/$set: $set normalizes field order alphabetically,
    # while a replacement document is stored exactly as built - and the scraper's
    # field order is part of looking like a scraped posting.
    ops: list[ReplaceOne] = []
    written = 0

    for doc in src.find({}):
        converted = convert(doc, skill_id_map, ngram_pools, stats, unresolved)
        stats["docs"] += 1
        if converted["_id"] in seen_ids:
            stats["id_collisions"] += 1
        seen_ids.add(converted["_id"])
        if not dry_run:
            ops.append(ReplaceOne({"_id": converted["_id"]}, converted, upsert=True))
            if len(ops) >= BATCH_SIZE:
                dst.bulk_write(ops, ordered=False)
                written += len(ops)
                ops = []
    if ops and not dry_run:
        dst.bulk_write(ops, ordered=False)
        written += len(ops)

    matches = stats["skill_id_resolved"] + stats["skill_id_null"]
    pct = 100.0 * stats["skill_id_resolved"] / matches if matches else 0.0
    print("")
    print(f"docs converted     : {stats['docs']}")
    print(f"docs written       : {written}{' (dry run)' if dry_run else ''}")
    print(f"unique _id         : {len(seen_ids)}  (collisions: {stats['id_collisions']})")
    print(f"full_matches       : {matches}")
    print(f"  skill_id resolved: {stats['skill_id_resolved']} ({pct:.1f}%)")
    print(f"  skill_id null    : {stats['skill_id_null']} "
          f"({len(unresolved)} distinct, all curated 2024-2026 skills)")
    print(f"skill_records      : {stats['records_in']} -> {stats['records_out']} "
          f"(+{stats['records_out'] - stats['records_in']} from real ngram noise)")
    print("")
    print("not reproduced: description (these records were sampled as skill sets,")
    print("                never generated from posting text).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
