from pathlib import Path

from ..pdf.pdf_parser import extract_text_from_pdf
from ..preprocessing.normalize_cv import normalize_cv_text


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