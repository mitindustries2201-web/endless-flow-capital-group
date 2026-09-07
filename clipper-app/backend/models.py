from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class JobStatus(str, Enum):
    queued = "queued"
    ingesting = "ingesting"
    transcribing = "transcribing"
    selecting = "selecting"
    rendering = "rendering"
    completed = "completed"
    failed = "failed"
    deleted = "deleted"


@dataclass
class ClipResult:
    clip_id: str
    start_seconds: float
    end_seconds: float
    ranking_score: float
    rationale: str
    output_path: str
    caption_style: str


@dataclass
class JobRecord:
    job_id: str
    created_at: str
    expires_at: str
    status: JobStatus
    source_type: str
    source_value: str
    rights_affirmed: bool
    clip_count: int
    clip_length_seconds: int
    caption_style: str
    media_path: Optional[str] = None
    media_duration_seconds: Optional[float] = None
    transcript_path: Optional[str] = None
    clips: List[Dict[str, Any]] = field(default_factory=list)
    error_code: Optional[str] = None
    error_message: Optional[str] = None



def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
