from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseModel):
    headless: bool = os.getenv("HEADLESS", "true").lower() == "true"
    output_path: str = os.getenv("OUTPUT_PATH", "../data/raw/jobs_raw.jsonl")
    site: str = os.getenv("SITE", "example")
    start_url: str = os.getenv("START_URL", "https://example.com")
    max_jobs: int = int(os.getenv("MAX_JOBS", "50"))

settings = Settings()