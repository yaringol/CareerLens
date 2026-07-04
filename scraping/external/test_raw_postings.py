"""Unit tests for LinkedIn raw posting Mongo shape (no network / Mongo required)."""
from datetime import datetime, timezone

from linkedin import build_raw_posting, generate_job_id, upsert_raw_posting


class FakeUpdateResult:
    def __init__(self, upserted_id=None, modified_count=0):
        self.upserted_id = upserted_id
        self.modified_count = modified_count


class FakeCollection:
    def __init__(self):
        self.docs = {}
        self.last_update = None

    def update_one(self, filt, update, upsert=False):
        self.last_update = (filt, update, upsert)
        job_id = filt["_id"]
        if job_id not in self.docs:
            self.docs[job_id] = {"_id": job_id, **update.get("$setOnInsert", {})}
            self.docs[job_id].update(update["$set"])
            return FakeUpdateResult(upserted_id=job_id)
        self.docs[job_id].update(update["$set"])
        return FakeUpdateResult(modified_count=1)


def test_generate_job_id_stable():
    a = generate_job_id("Backend Dev", "Acme", "https://example.com/j/1")
    b = generate_job_id("Backend Dev", "Acme", "https://example.com/j/1")
    assert a == b
    assert len(a) == 12


def test_build_raw_posting_includes_date_posted_when_present():
    now = datetime(2026, 7, 3, tzinfo=timezone.utc)
    doc = build_raw_posting(
        {
            "title": "Backend Developer",
            "company": "Wiz",
            "url": "https://linkedin.com/jobs/view/123",
            "og_title": "Backend Developer",
            "description": "x" * 30,
            "datePosted": "2026-06-15",
        },
        now,
    )
    assert doc is not None
    assert doc["datePosted"].year == 2026
    assert doc["datePosted"].month == 6
    assert doc["datePosted"].day == 15


def test_build_raw_posting_no_skills_field():
    now = datetime(2026, 7, 3, tzinfo=timezone.utc)
    doc = build_raw_posting(
        {
            "title": "Backend Developer",
            "company": "Wiz",
            "url": "https://linkedin.com/jobs/view/123",
            "og_title": "Backend Developer",
            "description": "x" * 30,
            "location": "Tel Aviv",
        },
        now,
    )
    assert doc is not None
    assert "skills" not in doc
    assert "extracted" not in doc
    assert doc["scraped_at"] == now
    assert doc["og_title"] == "Backend Developer"


def test_build_raw_posting_skips_short_description():
    now = datetime.now(timezone.utc)
    assert build_raw_posting({"title": "x", "url": "u", "description": "short"}, now) is None


def test_upsert_preserves_extracted_on_rescrape():
    coll = FakeCollection()
    coll.docs["abc"] = {"_id": "abc", "extracted": True, "title": "Old"}

    doc = {
        "_id": "abc",
        "title": "New title",
        "description": "y" * 30,
        "scraped_at": datetime.now(timezone.utc),
    }
    upsert_raw_posting(coll, doc)

    assert coll.docs["abc"]["extracted"] is True
    assert coll.docs["abc"]["title"] == "New title"
    assert coll.last_update[1]["$setOnInsert"] == {"extracted": False}


if __name__ == "__main__":
    tests = [v for k, v in globals().items() if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
    raise SystemExit(1 if failed else 0)
