from typing import Dict, Any, Iterator, Tuple
import os
from datetime import datetime
from .config import settings
from .pipelines.save_json import save_json
from .extractors.base import BaseExtractor
 

def get_extractor() -> BaseExtractor:
    """
    Factory function to get the appropriate extractor based on settings.site
    """
    site = settings.site.lower()
    
    if site == "biocatch":
        from .sites.biocatch_site import BioCatchExtractor
        return BioCatchExtractor()
    elif site == "example":
        from .sites.example_site import ExampleSiteExtractor
        return ExampleSiteExtractor()
    else:
        raise ValueError(f"Unknown site: {settings.site}. Supported sites: 'biocatch', 'example'")


def get_output_path() -> str:
    """
    Generate output path based on site name and timestamp.
    Creates a JSON file named: {company}_{timestamp}.json
    Example: biocatch_2025-01-11_14-30-45.json
    """
    site = settings.site.lower()
    
    # Get base directory from output_path setting
    base_dir = os.path.dirname(settings.output_path)
    if not base_dir:
        base_dir = "../data/raw"
    
    # Create timestamp in format: YYYY-MM-DD_HH-MM-SS
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # Create filename: {site}_{timestamp}.json
    filename = f"{site}_{timestamp}.json"
    
    return os.path.join(base_dir, filename)


def run() -> Tuple[int, str]:
    extractor = get_extractor()

    try:
        urls = extractor.collect_job_urls(settings.start_url, settings.max_jobs)

        def stream_items() -> Iterator[Dict[str, Any]]:
            for u in urls:
                job = extractor.extract_job(u)
                # Only yield jobs that match our filters (R&D and Israel - TLV)
                if not job.get("_filtered_out", False):
                    # Remove internal filtering fields
                    job.pop("_filtered_out", None)
                    job.pop("_filter_reason", None)
                    yield job
                else:
                    print(f"Filtered out job: {job.get('job_title', 'Unknown')} - {job.get('_filter_reason', '')}")

        # Save to site-specific JSON file
        output_path = get_output_path()
        count = save_json(output_path, stream_items())
        return count, output_path
    finally:
        extractor.close()

if __name__ == "__main__":
    n, path = run()
    print(f"Saved {n} items to {path}")