"""Map lang-uk Djinni Primary Keyword tags to CareerLens canonical titles."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# Primary Keyword (Djinni) -> canonical title in train.py, or None to skip.
PRIMARY_KEYWORD_TO_CANONICAL: dict[str, str | None] = {
    "JavaScript": "Frontend Developer",
    "React": "Frontend Developer",
    "Angular": "Frontend Developer",
    "Vue": "Frontend Developer",
    "Frontend": "Frontend Developer",
    "Java": "Java Developer",
    "DevOps": "DevOps Engineer",
    "Python": "Software Engineer",
    "Data Science": "Data Scientist",
    "QA Automation": "QA Automation Engineer",
    "QA": "QA Automation Engineer",
    ".NET": "Backend Developer",
    "Node.js": "Backend Developer",
    "PHP": "Backend Developer",
    "Ruby": "Backend Developer",
    "Scala": "Backend Developer",
    "Go": "Software Engineer",
    "Golang": "Software Engineer",
    "C++": "C++ Developer",
    "C#": "Backend Developer",
    "Rust": "Software Engineer",
    "iOS": "Software Engineer",
    "Android": "Software Engineer",
    "Flutter": "Software Engineer",
    "Mobile": "Software Engineer",
    "Machine Learning": "Machine Learning Engineer",
    "Data Engineer": "Data Engineer",
    "Product Manager": "Product Manager",
    "Project Manager": "Product Manager",
    "Designer": "UX Designer",
    "UI/UX": "UX Designer",
    "Design": "UX Designer",
    "Security": "Cyber Security",
    "SysAdmin": "DevOps Engineer",
    "Fullstack": "Fullstack Engineer",
    "Backend": "Backend Developer",
    "Embedded": "Embedded Engineer",
    "Blockchain": "Backend Developer",
    "Unity": "Software Engineer",
    "Game Dev": "Software Engineer",
    "NoSQL": "Data Engineer",
    "SQL": "Data Engineer",
    "Support": None,
    "Marketing": None,
    "Sales": None,
    "HR": None,
    "Recruiter": None,
    "Artist": None,
    "Business Analyst": None,
    "Legal": None,
    "Finance": None,
    "Copywriter": None,
    "Technical Writer": None,
}

MIN_DESCRIPTION_LEN = 100


def map_primary_keyword(keyword: str | None) -> str | None:
    """Return a canonical title for a Djinni tag, or None if out of scope."""
    if not keyword:
        return None
    normalized = keyword.strip()
    if not normalized:
        return None
    if normalized in PRIMARY_KEYWORD_TO_CANONICAL:
        return PRIMARY_KEYWORD_TO_CANONICAL[normalized]
    lowered = normalized.lower()
    for tag, canonical in PRIMARY_KEYWORD_TO_CANONICAL.items():
        if tag.lower() == lowered:
            return canonical
    return None


def parse_published(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    text = str(raw).strip()
    if not text:
        return None
    parsed: datetime | None = None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None:
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                parsed = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def row_to_job_doc(row: dict[str, Any]) -> dict[str, Any] | None:
    """Convert a HuggingFace lang-uk job row into a Mongo job document (pre-SkillNer)."""
    keyword = (row.get("Primary Keyword") or "").strip()
    canonical = map_primary_keyword(keyword)
    if canonical is None:
        return None

    description = (row.get("Long Description") or "").strip()
    if len(description) < MIN_DESCRIPTION_LEN:
        return None

    row_id = row.get("id")
    if row_id is None:
        return None

    return {
        "_id": str(row_id),
        "title": (row.get("Position") or "").strip(),
        "og_title": canonical,
        "description": description,
        "datePosted": parse_published(row.get("Published")),
        "primary_keyword": keyword,
        "company": row.get("Company Name"),
        "exp_years": row.get("Exp Years"),
        "english_level": row.get("English Level"),
        "source": "lang-uk",
        "extracted": False,
        "imported_at": datetime.now(timezone.utc),
    }
