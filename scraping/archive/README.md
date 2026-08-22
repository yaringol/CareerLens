# scraping/archive - the January 2026 scraping framework

The first generation of data collection: a Selenium framework with one extractor class
per company career site (`src/sites/biocatch_site.py`, `example_site.py`), a factory in
`src/main.py`, a WebDriver wrapper, config and JSON/JSONL save pipelines.

It was replaced by the direct LinkedIn ingest in `../external/linkedin.py`, which the
nightly pipeline runs. Per-site scraping did not scale: every new company meant a new
extractor, and the volume needed to train the skills model came from job boards, not
from individual career pages.

Kept because the project book tells this story (section 3.1) and the interview chronicle
cites the files. Nothing in the running system imports any of it - `main.py` is the only
thing that loads the site extractors, and it lives here too.

`README-src-framework.md` is the framework's own original documentation, and
`requirements.txt` its Selenium dependencies - neither applies to the live scraper.
