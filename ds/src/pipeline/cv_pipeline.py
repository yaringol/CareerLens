import re
from pathlib import Path
from typing import Optional

from ..pdf.pdf_parser import extract_text_from_pdf
from ..preprocessing.normalize_cv import normalize_cv_text

_ROLE_KEYWORDS = {
    'engineer', 'developer', 'analyst', 'manager', 'scientist',
    'designer', 'devops', 'architect', 'lead', 'director',
    'specialist', 'consultant', 'researcher', 'qa', 'tester',
    'product', 'frontend', 'backend', 'fullstack', 'data',
    'machine learning', 'ml', 'cloud', 'security',
}

_TITLE_PATTERNS = [
    # "Software Engineer | Google | 2022-2024"
    r'^([A-Za-z][A-Za-z\s/\-\.&]{3,50}?)\s*[|·,]\s*(?:[A-Z][a-z]|\d{4})',
    # "Current Role: Senior Data Scientist"
    r'(?:current role|position|title|role)\s*[:\-]\s*([A-Za-z][A-Za-z\s/\-\.]{3,50})',
    # "Software Engineer at Google"
    r'^([A-Za-z][A-Za-z\s/\-\.]{3,50}?)\s+at\s+[A-Z]',
]


def _looks_like_title(text: str) -> bool:
    words = text.lower().split()
    return any(kw in ' '.join(words) for kw in _ROLE_KEYWORDS)


def extract_title_from_cv(cv_text: str) -> Optional[str]:
    """
    Extracts the most recent job title from CV plain text.
    Returns None if no confident match found.

    Step 1: regex patterns for classic CV formats.
    Step 2: fallback - short lines containing a role keyword.
    """
    for line in cv_text.splitlines():
        line = line.strip()
        if not line or len(line) > 80:
            continue
        for pattern in _TITLE_PATTERNS:
            m = re.search(pattern, line, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().title()
                if _looks_like_title(candidate):
                    return candidate

    for line in cv_text.splitlines():
        line = line.strip()
        if 2 <= len(line.split()) <= 5 and _looks_like_title(line):
            return line.title()

    return None


def process_cv(pdf_path: str) -> str:
    """
    Full pipeline for processing a CV PDF.

    Steps:
    1. Extract text from PDF
    2. Normalize the text
    """

    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"CV not found: {pdf_path}")

    raw_text = extract_text_from_pdf(str(pdf_path))
    clean_text = normalize_cv_text(raw_text)

    return clean_text