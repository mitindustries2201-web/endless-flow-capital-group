from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Dict, Optional


class LocalStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.jobs_dir = self.root / "jobs"
        self.jobs_dir.mkdir(parents=True, exist_ok=True)

    def _safe_job_dir(self, job_id: str) -> Path:
        if not job_id or any(x in job_id for x in ("/", "..", "\\")):
            raise ValueError("invalid_job_id")
        job_dir = (self.jobs_dir / job_id).resolve()
        if self.jobs_dir not in job_dir.parents and job_dir != self.jobs_dir:
            raise ValueError("invalid_job_path")
        return job_dir

    def init_job_dir(self, job_id: str) -> Path:
        job_dir = self._safe_job_dir(job_id)
        (job_dir / "input").mkdir(parents=True, exist_ok=True)
        (job_dir / "work").mkdir(parents=True, exist_ok=True)
        (job_dir / "output").mkdir(parents=True, exist_ok=True)
        return job_dir

    def job_meta_path(self, job_id: str) -> Path:
        return self._safe_job_dir(job_id) / "job.json"

    def save_job(self, job_id: str, data: Dict) -> None:
        path = self.job_meta_path(job_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def load_job(self, job_id: str) -> Optional[Dict]:
        path = self.job_meta_path(job_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def list_jobs(self) -> list[Path]:
        if not self.jobs_dir.exists():
            return []
        return [p for p in self.jobs_dir.iterdir() if p.is_dir()]

    def delete_job(self, job_id: str) -> bool:
        job_dir = self._safe_job_dir(job_id)
        if not job_dir.exists():
            return False
        shutil.rmtree(job_dir, ignore_errors=True)
        return True

    def path_within_job(self, job_id: str, rel: str) -> Path:
        job_dir = self._safe_job_dir(job_id)
        target = (job_dir / rel).resolve()
        if job_dir not in target.parents and target != job_dir:
            raise ValueError("invalid_relative_path")
        return target
