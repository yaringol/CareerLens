"""
Generate synthetic job postings into a fresh Mongo collection (default: JOBS_EXAMPLE),
with the *exact same document shape* the scraper writes to `jobs.jobs`.

Goal: a realistic hi-tech trend signal —
  * "stable" skills (C#, Java, SQL, .NET, C++ ...) keep a flat frequency over time,
  * "trending" skills (machine learning, LLMs, PyTorch, GenAI ...) start near-zero in
    early 2024 and rise sharply toward mid-2026,
while keeping each posting's skills coherent with its role so the model still learns a
genuine role -> skill mapping for the personalization page.

Dates:
  * datePosted : 2024-01-01 .. 2026-06-30  (the trend axis)
  * scraped_at : 2026-05-01 .. 2026-06-30  (a single scrape campaign, always >= datePosted)

Usage:
  MONGO_URI=... EXAMPLE_COLLECTION=JOBS_EXAMPLE N_JOBS=10000 python generate_example_jobs.py
"""
import hashlib
import json
import os
import random
from datetime import datetime, timezone, timedelta

from pymongo import MongoClient

MONGO_URI         = os.getenv("MONGO_URI",
    "mongodb://root:secretpassword@82.70.215.125:27017/jobs?authSource=admin")
TARGET_COLLECTION = os.getenv("EXAMPLE_COLLECTION", "JOBS_EXAMPLE")
N_JOBS            = int(os.getenv("N_JOBS", "10000"))
random.seed(int(os.getenv("SEED", "42")))

DATE_POSTED_START = datetime(2024, 1, 1,  tzinfo=timezone.utc)
DATE_POSTED_END   = datetime(2026, 6, 30, tzinfo=timezone.utc)
SCRAPE_START      = datetime(2026, 5, 1,  tzinfo=timezone.utc)
SCRAPE_END        = datetime(2026, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
SPAN_SEC          = (DATE_POSTED_END - DATE_POSTED_START).total_seconds()

# ── Skill groups ───────────────────────────────────────────────────────────────
# STABLE: flat frequency across the whole window (the "boring but durable" stack).
STABLE   = ["java", "c#", ".net", "c++", "sql", "javascript", "html", "css",
            "git", "linux", "bash", "spring", "rest api", "agile"]
# TRENDING: near-zero in 2024, sharp rise toward 2026 (the AI wave).
TRENDING = ["machine learning", "deep learning", "pytorch", "tensorflow",
            "llm", "generative ai", "nlp", "transformers", "computer vision",
            "mlops", "rag", "langchain", "vector databases", "prompt engineering"]
CLOUD    = ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd"]
FRONTEND = ["react", "typescript", "redux", "next.js", "tailwind", "graphql"]
DATA     = ["python", "pandas", "spark", "airflow", "etl", "kafka", "snowflake"]
SECURITY = ["siem", "threat intelligence", "malware analysis", "incident response",
            "penetration testing", "reverse engineering", "edr", "wireshark"]

# ── Role profiles ──────────────────────────────────────────────────────────────
# core: strong role signal (emitted as high-confidence full_matches, score 1.0)
# stable/extra: flat-probability skills relevant to the role
# trending_weight: how strongly the AI wave reaches this role (0..1)
ROLE_PROFILES = {
    "Software Engineer":            {"core": ["python", "java", "c#", "c++", "git", "microservices", "rest api", "oop"], "stable": STABLE, "extra": CLOUD, "tw": 0.35},
    "Backend Developer":            {"core": ["java", "c#", "python", "sql", "spring", ".net", "microservices", "rest api"], "stable": STABLE, "extra": CLOUD, "tw": 0.30},
    "Frontend Developer":           {"core": ["javascript", "typescript", "react", "html", "css", "redux"], "stable": ["javascript", "html", "css", "git"], "extra": FRONTEND, "tw": 0.15},
    "Fullstack Engineer":           {"core": ["javascript", "typescript", "react", "node.js", "sql", "rest api"], "stable": STABLE, "extra": FRONTEND + CLOUD, "tw": 0.30},
    "Java Developer":               {"core": ["java", "spring", "sql", "hibernate", "maven", "rest api"], "stable": ["java", "sql", "git", "spring", "oop", "agile"], "extra": CLOUD, "tw": 0.20},
    "C++ Developer":                {"core": ["c++", "c", "cmake", "linux", "multithreading", "stl"], "stable": ["c++", "linux", "git", "oop"], "extra": [], "tw": 0.15},
    "Go Developer":                 {"core": ["go", "golang", "grpc", "microservices", "docker", "kubernetes"], "stable": ["git", "linux", "rest api"], "extra": CLOUD, "tw": 0.25},
    "Data Scientist":               {"core": ["python", "pandas", "sql", "statistics", "scikit-learn", "data analysis"], "stable": ["python", "sql", "git"], "extra": DATA, "tw": 0.95},
    "Machine Learning Engineer":    {"core": ["python", "machine learning", "pytorch", "tensorflow", "scikit-learn"], "stable": ["python", "sql", "git"], "extra": DATA + CLOUD, "tw": 1.00},
    "Deep Learning Engineer":       {"core": ["python", "deep learning", "pytorch", "tensorflow", "cuda"], "stable": ["python", "git"], "extra": DATA, "tw": 1.00},
    "AI Researcher":               {"core": ["python", "deep learning", "research", "pytorch", "mathematics"], "stable": ["python", "git"], "extra": DATA, "tw": 1.00},
    "NLP Engineer":                 {"core": ["python", "nlp", "transformers", "pytorch", "spacy"], "stable": ["python", "git"], "extra": DATA, "tw": 1.00},
    "Computer Vision Engineer":     {"core": ["python", "computer vision", "opencv", "pytorch", "deep learning"], "stable": ["python", "c++", "git"], "extra": DATA, "tw": 1.00},
    "MLOps Engineer":               {"core": ["python", "mlops", "kubernetes", "docker", "ci/cd"], "stable": ["python", "git", "bash", "linux"], "extra": CLOUD, "tw": 0.90},
    "Data Engineer":                {"core": ["python", "sql", "spark", "airflow", "etl", "kafka"], "stable": ["python", "sql", "git", "linux"], "extra": CLOUD + DATA, "tw": 0.55},
    "DevOps Engineer":              {"core": ["docker", "kubernetes", "terraform", "aws", "ci/cd", "bash"], "stable": ["linux", "git", "bash"], "extra": CLOUD, "tw": 0.30},
    "Platform Engineer":            {"core": ["kubernetes", "terraform", "go", "aws", "ci/cd"], "stable": ["linux", "git", "bash"], "extra": CLOUD, "tw": 0.35},
    "Cloud Architect":              {"core": ["aws", "azure", "gcp", "terraform", "kubernetes", "microservices"], "stable": ["linux", "git"], "extra": CLOUD, "tw": 0.40},
    "Kubernetes Engineer":          {"core": ["kubernetes", "docker", "helm", "terraform", "ci/cd"], "stable": ["linux", "git", "bash"], "extra": CLOUD, "tw": 0.30},
    "QA Automation Engineer":       {"core": ["selenium", "python", "test automation", "cypress", "ci/cd"], "stable": ["java", "javascript", "sql", "git"], "extra": [], "tw": 0.20},
    "Security Analyst":             {"core": ["siem", "incident response", "threat intelligence", "soc", "edr"], "stable": ["linux", "python", "bash"], "extra": SECURITY, "tw": 0.35},
    "SOC Analyst":                  {"core": ["siem", "soc", "incident response", "edr", "splunk"], "stable": ["linux", "bash", "python"], "extra": SECURITY, "tw": 0.30},
    "Cyber Security":              {"core": ["network security", "penetration testing", "siem", "cryptography", "firewalls"], "stable": ["linux", "python", "bash"], "extra": SECURITY, "tw": 0.35},
    "Reverse Engineer":            {"core": ["reverse engineering", "assembly", "ida pro", "c++", "malware analysis"], "stable": ["c++", "linux", "python"], "extra": SECURITY, "tw": 0.30},
    "Embedded Engineer":            {"core": ["c", "c++", "embedded systems", "rtos", "microcontrollers"], "stable": ["c++", "linux", "git"], "extra": [], "tw": 0.20},
    "Product Manager":              {"core": ["product management", "roadmap", "stakeholder management", "agile", "analytics"], "stable": ["sql", "agile"], "extra": [], "tw": 0.45},
}
ROLES = list(ROLE_PROFILES.keys())

COMPANIES = ["Wiz", "Monday", "Check Point", "CyberArk", "Fireblocks", "Snyk", "JFrog",
             "Lightricks", "Gong", "Riskified", "Melio", "Deel", "Sentinel Labs",
             "Nvidia Israel", "Intel Israel", "AI21 Labs", "Run:ai", "Deci", "Pinecone",
             "Datadog", "Elastic", "Redis", "Granulate", "Island", "Armis"]
INDUSTRIES = ["Software Development", "Computer and Network Security",
              "Financial Services,Technology, Information and Media",
              "Information Technology", "Artificial Intelligence", "Cloud Infrastructure"]
CITIES = ["Tel Aviv", "Herzliya", "Ramat Gan", "Petah Tikva", "Haifa",
          "Rishon LeZion", "Netanya", "Jerusalem", "Beer Sheva", "Caesarea"]


def trend_prob(t: float) -> float:
    """Rises from ~0.02 (t=0, Jan 2024) to ~0.92 (t=1, mid 2026); sharp late curve."""
    return 0.02 + 0.90 * (t ** 2.5)


def skill_id(name: str) -> str:
    return "KS" + hashlib.md5(name.encode()).hexdigest()[:16].upper()


def match_entry(name: str, score):
    return {
        "skill_id": skill_id(name),
        "doc_node_value": name,
        "score": score,
        "doc_node_id": [random.randint(1, 400)],
    }


def build_skills(prof, t):
    """Return (full_matches, ngram_matches) with role-coherent, time-shaped skills."""
    full, ngram = {}, {}

    k = random.randint(3, min(6, len(prof["core"])))
    for s in random.sample(prof["core"], k):
        full[s] = match_entry(s, 1)
    for s in prof["stable"]:
        if random.random() < 0.30:            # flat over time
            full[s] = match_entry(s, 1)
    for s in prof["extra"]:
        if random.random() < 0.22:
            full[s] = match_entry(s, 1)

    tw = prof["tw"]
    if tw > 0:
        p = trend_prob(t)
        for s in TRENDING:
            if s in full:
                continue
            if random.random() < tw * p:      # grows toward the end of the window
                ngram[s] = match_entry(s, round(random.uniform(0.80, 0.98), 3))

    # A little generic ngram noise so the shape matches real scraper output.
    for s in random.sample(STABLE + CLOUD, k=random.randint(0, 3)):
        if s not in full and s not in ngram:
            ngram[s] = match_entry(s, round(random.uniform(0.75, 0.9), 3))

    # Guarantee the trainer's `total < 5` guard passes.
    while len(full) + len(ngram) < 6:
        s = random.choice(prof["core"])
        full[s] = match_entry(s, 1)

    return list(full.values()), list(ngram.values())


def make_job(i: int):
    role = random.choice(ROLES)
    prof = ROLE_PROFILES[role]

    u = random.random() ** 0.75                # mild recency bias
    posted = DATE_POSTED_START + timedelta(seconds=u * SPAN_SEC)
    t = (posted - DATE_POSTED_START).total_seconds() / SPAN_SEC

    scr_lo = max(posted, SCRAPE_START)
    scraped = scr_lo + timedelta(
        seconds=random.random() * max(0.0, (SCRAPE_END - scr_lo).total_seconds())
    )

    full, ngram = build_skills(prof, t)
    skill_names = sorted({m["doc_node_value"] for m in full + ngram})

    company = random.choice(COMPANIES)
    city = random.choice(CITIES)
    _id = hashlib.md5(f"{role}|{company}|{i}".encode()).hexdigest()[:12]

    return {
        "_id": _id,
        "description": (f"{role} at {company}. We are hiring a {role} to join our team in "
                        f"{city}. Required skills: {', '.join(skill_names)}. "
                        f"You will design, build and ship production systems."),
        "title": role,
        "og_title": role,                      # maps 1:1 to a canonical title in train.py
        "employment_type": "FULL_TIME",
        "company": company,
        "industry": random.choice(INDUSTRIES),
        "skills": {"full_matches": full, "ngram_matches": ngram},
        "location": city,
        "country": "IL",
        "datePosted": posted.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "source": "Synthetic",
        "url": f"https://example.com/jobs/{_id}",
        "scraped_at": scraped,                 # BSON datetime, like the real scraper
    }


def main():
    db = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000).get_default_database()
    # Build into a staging collection, then atomically rename over the target so the
    # target never appears half-populated (and is never left dropped-but-empty on a crash).
    build_name = f"{TARGET_COLLECTION}_BUILD"
    build = db[build_name]
    build.drop()
    print(f"Target: {MONGO_URI.split('@')[-1]}  collection={TARGET_COLLECTION}")

    inserted = 0
    while inserted < N_JOBS:
        chunk = min(1000, N_JOBS - inserted)
        build.insert_many([make_job(inserted + j) for j in range(chunk)])
        inserted += chunk
        print(f"  built {inserted}/{N_JOBS}")

    build.create_index("og_title")
    build.create_index("datePosted")
    build.rename(TARGET_COLLECTION, dropTarget=True)
    print(f"Done. {db[TARGET_COLLECTION].estimated_document_count()} docs in {TARGET_COLLECTION}.")


if __name__ == "__main__":
    main()
