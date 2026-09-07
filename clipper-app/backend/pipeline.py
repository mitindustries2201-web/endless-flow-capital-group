from __future__ import annotations

import json
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests

from .config import get_settings
from .media import (
    CAPTION_STYLES,
    extract_audio,
    ffprobe_media,
    make_clip_with_captions,
    normalize_video,
    run_subprocess,
    write_srt,
)
from .models import JobStatus
from .security import validate_url
from .storage import LocalStorage
from .transcription import save_transcript_json, transcribe_audio
from .selector import select_candidates


class PipelineError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_job_id() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex[:8]


def new_job_record(source_type: str, source_value: str, clip_count: int, clip_length_seconds: int, caption_style: str) -> Dict:
    settings = get_settings()
    created = utc_now()
    expires = created + timedelta(hours=settings.retention_hours)
    return {
        "job_id": new_job_id(),
        "created_at": created.isoformat(),
        "expires_at": expires.isoformat(),
        "status": JobStatus.queued.value,
        "source_type": source_type,
        "source_value": source_value,
        "rights_affirmed": True,
        "clip_count": clip_count,
        "clip_length_seconds": clip_length_seconds,
        "caption_style": caption_style,
        "clips": [],
        "error_code": None,
        "error_message": None,
    }


def validate_job_inputs(clip_count: int, clip_length_seconds: int, caption_style: str, rights_affirmed: bool) -> None:
    settings = get_settings()
    if not rights_affirmed:
        raise PipelineError("rights_required", "You must affirm content ownership or permission.")
    if clip_count < 1 or clip_count > settings.max_clip_count:
        raise PipelineError("invalid_clip_count", "Clip count must be within configured limits.")
    if clip_length_seconds < settings.min_clip_seconds or clip_length_seconds > settings.max_clip_seconds:
        raise PipelineError("invalid_clip_length", "Clip length must be within configured limits.")
    if caption_style not in CAPTION_STYLES:
        raise PipelineError("invalid_caption_style", "Unsupported caption style.")


def _status(storage: LocalStorage, job_id: str, status: JobStatus, **extra) -> Dict:
    job = storage.load_job(job_id)
    if not job:
        raise PipelineError("job_not_found", "Job not found.")
    job["status"] = status.value
    for k, v in extra.items():
        job[k] = v
    storage.save_job(job_id, job)
    return job


def _safe_clip_srt(segments: List[Dict], start: float, end: float) -> List[Dict]:
    window = []
    for seg in segments:
        s = float(seg["start"])
        e = float(seg["end"])
        if e <= start or s >= end:
            continue
        window.append({"start": max(s, start), "end": min(e, end), "text": seg.get("text", "")})
    return window


def ingest_url_to_file(url: str, output_path: Path) -> None:
    settings = get_settings()
    validate_url(url, settings.allowlist_domains, settings.allow_http_test_urls)

    session = requests.Session()
    current = url
    for _ in range(5):
        resp = session.head(current, allow_redirects=False, timeout=10)
        if 300 <= resp.status_code < 400 and "Location" in resp.headers:
            nxt = requests.compat.urljoin(current, resp.headers["Location"])
            validate_url(nxt, settings.allowlist_domains, settings.allow_http_test_urls)
            current = nxt
            continue
        break

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--restrict-filenames",
        "-f",
        "mp4/bestvideo*+bestaudio/best",
        "-o",
        str(output_path),
        current,
    ]
    proc = run_subprocess(cmd, timeout=1800)
    if proc.returncode != 0 or not output_path.exists():
        raise PipelineError("url_ingest_failed", "Unable to import from this URL.")


def process_job(job_id: str) -> Dict:
    settings = get_settings()
    storage = LocalStorage(settings.storage_root)

    job = storage.load_job(job_id)
    if not job:
        raise PipelineError("job_not_found", "Job not found.")
    if job.get("status") == JobStatus.deleted.value:
        return job

    try:
        _status(storage, job_id, JobStatus.ingesting)
        job_dir = storage.path_within_job(job_id, ".")
        input_path = Path(job["media_path"])
        normalized = job_dir / "work" / "normalized.mp4"
        normalize_video(input_path, normalized)

        probe = ffprobe_media(normalized)
        duration = float(probe["duration"])
        if duration > settings.max_duration_seconds:
            raise PipelineError("duration_limit", "Video duration exceeds configured maximum.")

        _status(storage, job_id, JobStatus.transcribing, media_duration_seconds=duration)
        audio_path = job_dir / "work" / "audio.wav"
        transcript_path = job_dir / "work" / "transcript.json"
        extract_audio(normalized, audio_path)
        transcript_segments = transcribe_audio(audio_path)
        save_transcript_json(transcript_segments, transcript_path)

        _status(storage, job_id, JobStatus.selecting, transcript_path=str(transcript_path))
        candidates = select_candidates(transcript_segments, int(job["clip_length_seconds"]), int(job["clip_count"]))
        if not candidates:
            raise PipelineError("no_candidates", "No suitable candidate segments were detected.")

        _status(storage, job_id, JobStatus.rendering)
        clips = []
        for i, cand in enumerate(candidates, start=1):
            clip_id = f"clip-{i:02d}"
            out_file = job_dir / "output" / f"{clip_id}.mp4"
            srt_file = job_dir / "work" / f"{clip_id}.srt"
            segs = _safe_clip_srt(transcript_segments, cand.start, cand.end)
            if not segs:
                segs = [{"start": cand.start, "end": min(cand.end, cand.start + 2.0), "text": "Generated clip"}]
            write_srt(segs, srt_file, offset=cand.start)
            make_clip_with_captions(normalized, srt_file, cand.start, cand.end - cand.start, out_file, job["caption_style"])
            clips.append(
                {
                    "clip_id": clip_id,
                    "start_seconds": round(cand.start, 3),
                    "end_seconds": round(cand.end, 3),
                    "ranking_score": cand.score,
                    "rationale": cand.rationale,
                    "download_path": str(out_file),
                }
            )

        _status(storage, job_id, JobStatus.completed, clips=clips)
        return storage.load_job(job_id) or {}
    except PipelineError as exc:
        _status(storage, job_id, JobStatus.failed, error_code=exc.code, error_message=exc.message)
        return storage.load_job(job_id) or {}
    except Exception:
        _status(storage, job_id, JobStatus.failed, error_code="processing_failed", error_message="Processing failed. Please retry with another input.")
        return storage.load_job(job_id) or {}


def cleanup_expired_jobs() -> int:
    settings = get_settings()
    storage = LocalStorage(settings.storage_root)
    now = utc_now()
    removed = 0
    for job_dir in storage.list_jobs():
        job_id = job_dir.name
        job = storage.load_job(job_id)
        if not job:
            continue
        try:
            expires_at = datetime.fromisoformat(job["expires_at"])
        except Exception:
            expires_at = now - timedelta(seconds=1)
        if expires_at <= now:
            storage.delete_job(job_id)
            removed += 1
    return removed
