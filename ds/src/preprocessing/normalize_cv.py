import re


def normalize_cv_text(text: str) -> str:
    """
    Normalize CV text before sending it to skill extraction / LLM.
    """

    if not isinstance(text, str):
        raise TypeError("Input must be a string")

    # lower case
    text = text.lower()

    # remove line breaks and tabs
    text = re.sub(r"[\n\r\t]", " ", text)

    # remove special characters
    text = re.sub(r"[^a-z0-9\s]", " ", text)

    # collapse multiple spaces
    text = re.sub(r"\s+", " ", text)

    return text.strip()