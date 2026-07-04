"""Resolve MONGO_URI from environment or .env files (no hardcoded credentials)."""
from __future__ import annotations

import os
from pathlib import Path

_ENV_LOADED = False
_CACHED_URI: str | None = None


def _read_env_file(path: Path) -> None:
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_mongo_env() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True

    here = Path(__file__).resolve().parent
    repo_root = here.parent.parent
    for candidate in (
        here / ".env",
        repo_root / ".env",
        repo_root / "backend" / ".env",
        repo_root / "scraping" / ".env",
    ):
        if candidate.is_file():
            _read_env_file(candidate)


def get_mongo_uri() -> str:
    global _CACHED_URI
    if _CACHED_URI is not None:
        return _CACHED_URI

    load_mongo_env()
    uri = os.getenv("MONGO_URI", "").strip() or os.getenv("JOBS_MONGO_URI", "").strip()
    if not uri:
        raise SystemExit(
            "MONGO_URI (or JOBS_MONGO_URI) is required. "
            "Set it in ds/model/.env, backend/.env, or the repo root .env - "
            "see ds/model/.env.example."
        )

    _CACHED_URI = uri
    return uri
