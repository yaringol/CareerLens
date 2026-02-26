# CareerLens

CareerLens is a Data Science project designed to help job seekers improve their resumes by analyzing their CV against a specific job description.

The system evaluates how well a candidate’s resume matches a job’s required skills and provides actionable feedback, including a match score and suggestions for improvement.

---

## Project Goals

- Analyze CVs and job descriptions using NLP techniques
- Identify missing or under-emphasized skills
- Generate a skill-based match score
- Provide CV optimization suggestions to improve ATS and recruiter screening results

---

## High-Level Architecture

CareerLens is built using a client–server architecture:

- **Frontend**: React + TypeScript  
- **Backend**: Node.js + TypeScript (API Gateway)  
- **Data Science / NLP**: Python-based pipeline with LLM integration  
- **Database**: MongoDB (prototype stage)

---

## Core Features

- PDF resume parsing (English only)
- Job description input (text or scraped from job boards)
- Automatic extraction of core and dynamic skills
- Skill-level scoring (1–10)
- Global match score calculation
- Gap analysis and CV optimization suggestions

---

## Data Collection

Job descriptions are collected from public job boards using web scraping (Selenium).  
The dataset is used for skill extraction, model calibration, and evaluation.

### Supported Sites

- **BioCatch**: Cybersecurity careers with filtering for R&D department and Israel - TLV location
- Additional sites can be added by implementing the `BaseExtractor` interface

### Scraping Features

- **Smart Filtering**: Automatically applies department and location filters
- **Data Extraction**: Separates job descriptions from requirements
- **Timestamped Output**: Each scraping run creates a unique JSON file with timestamp
- **Data Validation**: Filters out jobs that don't match specified criteria
- **Structured Output**: Clean JSON format with all job details

---

## Installation & Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Node.js 18+ (for frontend/backend)
- MongoDB (for database, optional in prototype stage)

### Python Environment Setup

1. **Navigate to the scraping directory:**
```bash
cd scraping
```

2. **Create a virtual environment:**
```bash
python3 -m venv .venv
```

3. **Activate the virtual environment:**
   - On macOS/Linux:
   ```bash
   source .venv/bin/activate
   ```
   - On Windows:
   ```bash
   .venv\Scripts\activate
   ```

4. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**Note:** If you see a warning about pip being outdated, you can optionally upgrade it:
```bash
python3 -m pip install --upgrade pip
```
This warning is non-critical and can be safely ignored if the upgrade fails due to system restrictions.

### Configuration

Create a `.env` file in the `scraping` directory with the following variables:

```bash
# Run browser in headless mode (true/false)
HEADLESS=true

# Output path base directory (files will be named with timestamp)
OUTPUT_PATH=../data/raw/jobs_raw.jsonl

# Site to scrape: 'biocatch' or 'example'
SITE=biocatch

# Starting URL for the scraper
START_URL=https://www.biocatch.com/cybersecurity-careers

# Maximum number of jobs to scrape
MAX_JOBS=50
```

### Running the Scraper

From the `scraping` directory with the virtual environment activated:

```bash
python -m src.main
```

Or using Python 3 explicitly:
```bash
python3 -m src.main
```

**Example: Scraping BioCatch careers:**
1. Set `SITE=biocatch` and `START_URL=https://www.biocatch.com/cybersecurity-careers` in your `.env` file
2. Run the scraper - it will:
   - Apply filters for R&D department and Israel - TLV location
   - Collect matching job listings
   - Extract job details (title, location, department, description, requirements)
   - Save results to a timestamped JSON file
3. Results are saved in JSON format with fields: `job_title`, `company`, `location`, `department`, `description`, `requirements`, `url`
4. Output file format: `{company}_{YYYY-MM-DD_HH-MM-SS}.json` (e.g., `biocatch_2025-01-11_14-30-45.json`)

**Note:** Each scraping run creates a new timestamped file, preserving historical data and allowing comparison across different runs.

### Running the Application

To run the frontend application:

1. **Navigate to the frontend directory:**
```bash
cd frontend
```

2. **Install dependencies (if not already installed):**
```bash
npm install
```

3. **Start the development server:**
```bash
npm run dev
```

The application will be available at `http://localhost:8080` and should open automatically in your browser.

**Note:** If you encounter port permission errors, you can change the port in `frontend/vite.config.ts` by modifying the `server.port` value.

### Project Structure

```
CareerLens/
├── backend/          # Node.js API Gateway
├── frontend/         # React + TypeScript UI
├── ds/              # Data Science / NLP pipeline
├── scraping/        # Web scraping module
│   ├── src/
│   │   ├── main.py          # Main scraper runner
│   │   ├── config.py        # Configuration management
│   │   ├── driver.py        # Selenium WebDriver setup
│   │   ├── extractors/      # Base extractor interface
│   │   ├── pipelines/       # Data saving pipelines (JSON)
│   │   └── sites/           # Site-specific extractors
│   │       └── biocatch_site.py  # BioCatch extractor
│   └── requirements.txt
├── data/            # Raw and processed datasets
│   └── raw/        # Timestamped JSON files from scraping
└── docs/            # Project documentation
```

---

## Project Status

🚧 **Work in Progress**  
This repository is under active development as part of an academic Data Science capstone project.

---

## Team

- Amit Alon  
- May Eliyahu  
- Yarin Golzar  
- Reut Maduel  

Supervisor: Dr. Galit Haim

---

## License

This project is for academic and educational purposes only.