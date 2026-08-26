# scraping - job ingest

## What runs today: `external/`

`external/linkedin.py` is the live scraper. It writes raw job postings into MongoDB
(`raw_postings`, upserted on a stable id) and does nothing else - skill extraction
happens later, in the DS pipeline. The nightly job runs it from its own image
(`external/Dockerfile`, invoked by `pipeline/run_daily.sh`).

```bash
cd scraping/external
pip install -r requirements.txt
python linkedin.py            # MONGO_URI from scraping/.env
```

`alljobs.py` and `alljobs_cleanr.py` collect and clean the AllJobs source that seeded
the earlier corpus; `test_raw_postings.py` checks what landed in the collection.

## `archive/`

The January 2026 Selenium framework - a per-site extractor architecture built for
company career pages (`archive/src/`, with its own README, requirements and tests).
It was superseded by the direct LinkedIn ingest above and is kept as the first
generation of the data collection, which the project book describes in section 3.1.
Nothing in the running system imports it.
