"""
LinkedIn job scraper — raw ingest only (A1).

Writes append-only job postings to MongoDB (`raw_postings` by default) via upsert on a
stable `_id` from `generate_job_id`. Does NOT run SkillNer or write extracted skills.

Env:
  MONGO_URI=mongodb://localhost:27017/jobs
  RAW_COLLECTION=raw_postings
  JSONL_BACKUP=path/to/backup.jsonl   # optional append-only backup (not source of truth)
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import random
import re
import time
from datetime import datetime, timezone
from typing import Any, Iterator, Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
from pymongo.collection import Collection

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
}

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/jobs")
RAW_COLLECTION = os.getenv("RAW_COLLECTION", "raw_postings")
JSONL_BACKUP = os.getenv("JSONL_BACKUP", "").strip()


def parse_iso_datetime(value: Any) -> Optional[datetime]:
    """Parse schema.org datePosted / validThrough (ISO 8601 date or datetime)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return None
    return None


def generate_job_id(title: str, company: str, url: str) -> str:
    """Stable id for upsert — same posting re-scraped maps to the same Mongo _id."""
    raw = f"{title}_{company}_{url}".lower().strip()
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def build_raw_posting(job_details: dict, scraped_at: datetime) -> Optional[dict]:
    """Shape a raw posting document for Mongo. Returns None if required fields are missing."""
    title = (job_details.get("title") or "").strip()
    company = (job_details.get("company") or "").strip()
    url = (job_details.get("url") or "").strip()
    description = (job_details.get("description") or "").strip()

    if not title or not url or len(description) < 20:
        return None

    doc = {
        "_id": generate_job_id(title, company, url),
        "source": job_details.get("source") or "Linkedin",
        "title": title,
        "og_title": (job_details.get("og_title") or "").strip(),
        "description": description,
        "company": company,
        "location": (job_details.get("location") or "").strip(),
        "country": job_details.get("country"),
        "url": url,
        "employment_type": job_details.get("employment_type") or "",
        "industry": job_details.get("industry") or "",
        "scraped_at": scraped_at,
    }
    date_posted = parse_iso_datetime(job_details.get("datePosted"))
    if date_posted is not None:
        doc["datePosted"] = date_posted
    valid_through = parse_iso_datetime(job_details.get("validThrough"))
    if valid_through is not None:
        doc["validThrough"] = valid_through
    return doc


def upsert_raw_posting(collection: Collection, doc: dict) -> str:
    """
    Upsert without wiping history. `extracted` is set only on first insert;
    re-scrapes refresh text fields and scraped_at but keep extraction state.
    """
    job_id = doc["_id"]
    payload = {k: v for k, v in doc.items() if k != "_id"}
    result = collection.update_one(
        {"_id": job_id},
        {"$set": payload, "$setOnInsert": {"extracted": False}},
        upsert=True,
    )
    if result.upserted_id is not None:
        return "inserted"
    if result.modified_count:
        return "updated"
    return "unchanged"


def ensure_raw_indexes(collection: Collection) -> None:
    collection.create_index("scraped_at")
    collection.create_index("datePosted")
    collection.create_index("extracted")
    collection.create_index("og_title")


def get_linked_job_details(job_url: str, og_title: str) -> dict:
    while True:
        resp = requests.get(job_url, headers=HEADERS, timeout=30)
        if resp.ok:
            break
        time.sleep(random.randint(2, 7))

    soup = BeautifulSoup(resp.text, "html.parser")
    script_tag = soup.find("script", type="application/ld+json")

    result: dict = {}
    if not script_tag or not script_tag.string:
        return result

    data = json.loads(script_tag.string)
    unescaped_desc = html.unescape(data.get("description", ""))
    clean = re.sub(r"<[^>]+>", " ", unescaped_desc)
    result["description"] = " ".join(clean.split())
    result["title"] = data.get("title", "")
    result["og_title"] = og_title
    result["employment_type"] = data.get("employmentType", "")
    result["company"] = data.get("hiringOrganization", {}).get("name", "")
    result["industry"] = data.get("industry", "")
    address_obj = data.get("jobLocation", {}).get("address", {})
    result["location"] = address_obj.get("addressLocality", "")
    result["country"] = address_obj.get("addressCountry")
    result["source"] = "Linkedin"
    result["url"] = job_url
    if data.get("datePosted"):
        result["datePosted"] = data["datePosted"]
    if data.get("validThrough"):
        result["validThrough"] = data["validThrough"]
    return result


def search_linkedin_jobs(keyword: str) -> Iterator[dict]:
    """Search LinkedIn for job listings for one keyword."""
    query = quote_plus(keyword)
    url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location=Israel&f_TPR=r7776000"
    print(url)

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")

        for card in soup.find_all("div", class_=re.compile("base-card|job-search-card")):
            link_el = card.find("a", href=True)
            link = link_el["href"] if link_el else ""
            if not link:
                continue
            job_details = get_linked_job_details(job_url=link, og_title=keyword)
            if job_details.get("description"):
                yield job_details
    except Exception as exc:
        print(f"LinkedIn error for '{keyword}': {exc}")


TOP_KEYWORDS = [
    "SOC Analyst", "Security Analyst", "Cyber Security", "Threat Analyst",
    "Incident Response", "Security Operations", "SIEM", "Cloud Security",
    "Digital Forensics", "DFIR", "Threat Intelligence", "Detection Engineer",
    "Software Engineer", "Backend Developer", "Frontend Developer",
    "Fullstack Engineer", "Embedded Engineer", "C++ Developer",
    "Python Developer", "Go Developer", "Java Developer",
    "Rust Developer", "Kernel Developer", "Driver Developer",
    "Distributed Systems Engineer", "Firmware Engineer",
    "Security Researcher", "Malware Researcher", "Vulnerability Researcher",
    "Reverse Engineer", "Exploit Developer", "Security Architect",
    "Product Security Engineer", "AppSec Engineer", "Cryptographer",
    "Red Teamer", "Penetration Tester", "Security Consultant",
    "Security Researcher (IoT/Automotive)", "CISO Office Engineer",
    "Data Scientist", "Machine Learning Engineer", "AI Researcher",
    "Deep Learning Engineer", "Big Data Engineer", "Data Engineer",
    "NLP Engineer", "Computer Vision Engineer", "MLOps Engineer",
    "Algorithm Engineer", "Reinforcement Learning Researcher",
    "DevOps Engineer", "Site Reliability Engineer (SRE)", "Platform Engineer",
    "Infrastructure Engineer", "Cloud Architect",
    "Cloud Native Engineer", "Kubernetes Engineer", "DevSecOps Engineer",
    "Product Manager", "UX Designer", "UI Designer", "UX Researcher",
    "QA Automation Engineer", "SDET", "Product Owner",
    "Technical Product Manager (TPM)", "Product Strategy", "Design Systems Lead",
    "Fintech Engineer", "Chip Design Engineer", "VLSI Engineer",
    "Hardware Engineer", "FPGA Engineer", "Verification Engineer",
    "Solutions Architect", "Customer Success Engineer (Technical)",
    "Presales Engineer", "Security Researcher (Mobile/Android/iOS)",
]


def search_all_jobs(
    keywords: Optional[list[str]] = None,
    mongo_uri: str = MONGO_URI,
    collection_name: str = RAW_COLLECTION,
) -> dict:
    """
    Scrape all keywords and upsert raw postings to Mongo (append-only semantics via upsert).
    Optional JSONL backup in append mode when JSONL_BACKUP env is set.
    """
    keywords = keywords or TOP_KEYWORDS
    scraped_at = datetime.now(timezone.utc)

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
    db = client.get_default_database()
    collection = db[collection_name]
    ensure_raw_indexes(collection)

    print(f"Mongo target: {mongo_uri.split('@')[-1]} collection={collection_name}")

    stats = {"inserted": 0, "updated": 0, "unchanged": 0, "skipped": 0}
    backup_file = None
    if JSONL_BACKUP:
        backup_file = open(JSONL_BACKUP, "a", encoding="utf-8")

    try:
        for keyword in keywords:
            print(f"Searching: {keyword}...")
            for job_details in search_linkedin_jobs(keyword):
                doc = build_raw_posting(job_details, scraped_at)
                if doc is None:
                    stats["skipped"] += 1
                    continue

                outcome = upsert_raw_posting(collection, doc)
                stats[outcome] += 1

                if backup_file is not None:
                    row = {**doc, "scraped_at": scraped_at.isoformat()}
                    backup_file.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
    finally:
        if backup_file is not None:
            backup_file.close()

    total = collection.estimated_document_count()
    print(
        f"Done. inserted={stats['inserted']} updated={stats['updated']} "
        f"unchanged={stats['unchanged']} skipped={stats['skipped']} "
        f"collection_total={total}"
    )
    return {**stats, "collection_total": total}


if __name__ == "__main__":
    search_all_jobs()
