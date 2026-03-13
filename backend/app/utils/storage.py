"""Job-based file storage management under /tmp/archithon/{job_id}/."""

from __future__ import annotations

import shutil
import time
from pathlib import Path

BASE_DIR = Path("/tmp/archithon")

SUBDIRS = [
    "frames",
    "colmap",
    "floorplan",
    "furniture",
    "placement",
    "render",
    "cost",
]


def get_job_dir(job_id: str) -> Path:
    """Return the root directory for a job (does not create it)."""
    return BASE_DIR / job_id


def create_job(job_id: str) -> Path:
    """Create all subdirectories for a new job and return the root path."""
    job_dir = BASE_DIR / job_id
    for sub in SUBDIRS:
        (job_dir / sub).mkdir(parents=True, exist_ok=True)
    return job_dir


def cleanup_old_jobs(max_age_hours: float = 24) -> list[str]:
    """Remove job directories older than max_age_hours. Returns list of removed job IDs."""
    if not BASE_DIR.exists():
        return []
    cutoff = time.time() - max_age_hours * 3600
    removed: list[str] = []
    for child in BASE_DIR.iterdir():
        if child.is_dir():
            try:
                mtime = child.stat().st_mtime
                if mtime < cutoff:
                    shutil.rmtree(child, ignore_errors=True)
                    removed.append(child.name)
            except OSError:
                pass
    return removed


def furniture_item_dir(job_id: str, item_id: str) -> Path:
    """Return (and create) the directory for a specific furniture item within a job."""
    path = BASE_DIR / job_id / "furniture" / item_id
    path.mkdir(parents=True, exist_ok=True)
    return path
