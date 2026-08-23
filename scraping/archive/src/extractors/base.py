from abc import ABC, abstractmethod
from typing import Dict, Any, Iterable

class BaseExtractor(ABC):
    @abstractmethod
    def collect_job_urls(self, start_url: str, max_jobs: int) -> Iterable[str]:
        ...

    @abstractmethod
    def extract_job(self, job_url: str) -> Dict[str, Any]:
        ...