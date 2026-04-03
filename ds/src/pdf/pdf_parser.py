from pathlib import Path
import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract plain text from a PDF CV file.
    """

    path = Path(pdf_path)

    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    if path.suffix.lower() != ".pdf":
        raise ValueError(f"Unsupported file type: {path.suffix}. Expected a PDF file.")

    try:
        text_parts = []

        with fitz.open(path) as doc:
            if doc.page_count == 0:
                raise ValueError("PDF is empty.")

            for page in doc:
                page_text = page.get_text("text")
                if page_text:
                    text_parts.append(page_text)

        full_text = "\n".join(text_parts).strip()

        if not full_text:
            raise ValueError("No extractable text found in PDF.")

        return full_text

    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {e}") from e