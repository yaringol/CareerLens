# CareerLens - Web Scraping Module

This module handles web scraping of job listings from various career sites using Selenium automation.

## Supported Sites

- **BioCatch**: `https://www.biocatch.com/cybersecurity-careers`
- **Example**: Template for adding new sites

## Setup

1. **Create virtual environment:**
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Create `.env` file:**
```bash
HEADLESS=true
OUTPUT_PATH=../data/raw/jobs_raw.jsonl
SITE=biocatch
START_URL=https://www.biocatch.com/cybersecurity-careers
MAX_JOBS=50
```

## Usage

Run the scraper:
```bash
python -m src.main
```

The scraper will:
1. Navigate to the specified URL
2. Collect job listing URLs
3. Extract job details (title, company, location, description, requirements)
4. Save results to a JSON file named after the site (e.g., `biocatch.json`)

## Output Format

Jobs are saved as a JSON array in a file named after the site (e.g., `biocatch.json`, `example.json`).

Each job is a JSON object with the following fields:
- `source`: Site identifier (e.g., "biocatch")
- `url`: Job listing URL
- `job_title`: Job title
- `company`: Company name
- `location`: Job location
- `description`: Job description
- `requirements`: Job requirements/qualifications
- `full_text`: Full text content (if available)

**Output location:** `../data/raw/{site}.json`

For example, scraping BioCatch will create `../data/raw/biocatch.json`.

## Adding New Sites

To add support for a new job site:

1. Create a new file in `src/sites/` (e.g., `new_site.py`)
2. Inherit from `BaseExtractor` and implement:
   - `collect_job_urls()`: Collect URLs of job listings
   - `extract_job()`: Extract job details from a URL
   - `close()`: Clean up resources (close browser)
3. Register the extractor in `src/main.py`'s `get_extractor()` function

## Architecture

- `src/extractors/base.py`: Abstract base class for all extractors
- `src/driver.py`: Selenium WebDriver setup
- `src/config.py`: Configuration management (via .env)
- `src/pipelines/save_json.py`: JSON data saving pipeline (saves one file per site)
- `src/pipelines/save_jsonl.py`: JSONL data saving pipeline (legacy, for streaming)
- `src/sites/`: Site-specific extractors
