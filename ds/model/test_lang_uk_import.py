"""Unit tests for lang-uk import mapping (no Mongo / HuggingFace required)."""
from datetime import datetime, timezone

from lang_uk_mapping import map_primary_keyword, parse_published, row_to_job_doc


def test_map_primary_keyword_known_roles():
    assert map_primary_keyword("DevOps") == "DevOps Engineer"
    assert map_primary_keyword("Java") == "Java Developer"
    assert map_primary_keyword("javascript") == "Frontend Developer"


def test_map_primary_keyword_skips_out_of_scope():
    assert map_primary_keyword("Marketing") is None
    assert map_primary_keyword("Unknown Tag") is None
    assert map_primary_keyword("") is None


def test_parse_published_accepts_iso_and_date_only():
    iso = parse_published("2021-03-15T10:00:00Z")
    assert iso is not None
    assert iso.year == 2021

    day = parse_published("2021-03-15")
    assert day == datetime(2021, 3, 15, tzinfo=timezone.utc)


def test_row_to_job_doc_maps_fields():
    doc = row_to_job_doc(
        {
            "id": 42,
            "Position": "Senior Python Developer",
            "Primary Keyword": "Python",
            "Long Description": "x" * 120,
            "Published": "2021-03-15",
            "Company Name": "Acme",
        }
    )
    assert doc is not None
    assert doc["_id"] == "42"
    assert doc["title"] == "Senior Python Developer"
    assert doc["og_title"] == "Software Engineer"
    assert doc["primary_keyword"] == "Python"
    assert doc["extracted"] is False


def test_row_to_job_doc_skips_short_description():
    assert row_to_job_doc(
        {
            "id": 1,
            "Position": "Dev",
            "Primary Keyword": "Python",
            "Long Description": "too short",
        }
    ) is None


if __name__ == "__main__":
    failures = 0
    for name, fn in list(globals().items()):
        if not name.startswith("test_"):
            continue
        try:
            fn()
            print(f"PASS {name}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL {name}: {exc}")
    raise SystemExit(1 if failures else 0)
