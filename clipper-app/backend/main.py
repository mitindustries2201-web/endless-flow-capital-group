from __future__ import annotations

import os
import secrets
import shutil
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import get_settings
from .media import CAPTION_STYLES, ffprobe_media, is_allowed_filename
from .pipeline import PipelineError, cleanup_expired_jobs, ingest_url_to_file, new_job_record, process_job, validate_job_inputs
from .queueing import get_queue
from .security import FixedWindowLimiter
from .storage import LocalStorage

settings = get_settings()
app = FastAPI(title="EFCG Clipper API", version="1.0.0")
limiter = FixedWindowLimiter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-Human-Verification"],
)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if settings.app_env == "production":
        if settings.human_verification_required and not settings.human_verification_secret:
            return JSONResponse(status_code=503, content={"error": {"code": "human_verification_not_configured", "message": "Service protection is not configured."}})
        if settings.human_verification_required:
            token = request.headers.get("X-Human-Verification", "")
            if not token or token != settings.human_verification_secret:
                return JSONResponse(status_code=403, content={"error": {"code": "human_verification_failed", "message": "Verification required."}})

    ip = request.client.host if request.client else "unknown"
    if request.url.path.startswith("/api/v1/jobs"):
        if not limiter.allow(f"job-create:{ip}", settings.rate_limit_ip_per_hour, 3600):
            return JSONResponse(status_code=429, content={"error": {"code": "rate_limited", "message": "Too many requests."}})

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


def _queue_job(job_id: str) -> None:
    q = get_queue(settings.redis_url)
    q.enqueue("backend.pipeline.process_job", job_id)


def _job_json_safe(job: Dict[str, Any]) -> Dict[str, Any]:
    clips = []
    for c in job.get("clips", []):
        clips.append(
            {
                "clip_id": c["clip_id"],
                "start_seconds": c["start_seconds"],
                "end_seconds": c["end_seconds"],
                "ranking_score": c["ranking_score"],
                "rationale": c["rationale"],
            }
        )
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "created_at": job["created_at"],
        "expires_at": job["expires_at"],
        "clip_count": job.get("clip_count"),
        "clip_length_seconds": job.get("clip_length_seconds"),
        "caption_style": job.get("caption_style"),
        "error": {"code": job.get("error_code"), "message": job.get("error_message")} if job.get("error_code") else None,
        "clips": clips,
    }


@app.get("/api/v1/health")
def health() -> Dict[str, Any]:
    removed = cleanup_expired_jobs()
    return {"ok": True, "status": "healthy", "cleanup_removed": removed}


@app.post("/api/v1/jobs/upload")
async def create_upload_job(
    request: Request,
    file: UploadFile = File(...),
    clip_count: int = Form(...),
    clip_length_seconds: int = Form(...),
    caption_style: str = Form(...),
    rights_affirmed: bool = Form(...),
) -> Dict[str, Any]:
    try:
        validate_job_inputs(clip_count, clip_length_seconds, caption_style, rights_affirmed)
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message})

    if not is_allowed_filename(file.filename or ""):
        raise HTTPException(status_code=400, detail={"code": "unsupported_file", "message": "Unsupported media file type."})

    storage = LocalStorage(settings.storage_root)
    job = new_job_record("upload", file.filename or "upload", clip_count, clip_length_seconds, caption_style)
    job_dir = storage.init_job_dir(job["job_id"])

    ext = Path(file.filename or "video.mp4").suffix.lower() or ".mp4"
    server_name = f"input_{secrets.token_hex(8)}{ext}"
    target = job_dir / "input" / server_name

    size = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    with target.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail={"code": "upload_too_large", "message": "Uploaded file exceeds size limit."})
            out.write(chunk)

    try:
        probe = ffprobe_media(target)
        duration = float(probe["duration"])
    except Exception:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail={"code": "invalid_media", "message": "Uploaded file is not a supported video."})

    if duration > settings.max_duration_seconds:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail={"code": "duration_limit", "message": "Uploaded media exceeds duration limit."})

    job["media_path"] = str(target)
    job["media_duration_seconds"] = duration
    storage.save_job(job["job_id"], job)
    _queue_job(job["job_id"])
    return _job_json_safe(job)


@app.post("/api/v1/jobs/url")
def create_url_job(
    source_url: str = Form(...),
    clip_count: int = Form(...),
    clip_length_seconds: int = Form(...),
    caption_style: str = Form(...),
    rights_affirmed: bool = Form(...),
) -> Dict[str, Any]:
    try:
        validate_job_inputs(clip_count, clip_length_seconds, caption_style, rights_affirmed)
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": exc.message})

    storage = LocalStorage(settings.storage_root)
    job = new_job_record("url", source_url, clip_count, clip_length_seconds, caption_style)
    job_dir = storage.init_job_dir(job["job_id"])
    target = job_dir / "input" / f"import_{secrets.token_hex(8)}.mp4"

    try:
        ingest_url_to_file(source_url, target)
        probe = ffprobe_media(target)
        duration = float(probe["duration"])
        if duration > settings.max_duration_seconds:
            target.unlink(missing_ok=True)
            raise HTTPException(status_code=413, detail={"code": "duration_limit", "message": "Imported media exceeds duration limit."})
    except HTTPException:
        raise
    except Exception as exc:
        target.unlink(missing_ok=True)
        code = getattr(exc, "code", "invalid_url")
        msg = getattr(exc, "message", "URL import failed or is not allowed.")
        raise HTTPException(status_code=400, detail={"code": code, "message": msg})

    job["media_path"] = str(target)
    job["media_duration_seconds"] = duration
    storage.save_job(job["job_id"], job)
    _queue_job(job["job_id"])
    return _job_json_safe(job)


@app.get("/api/v1/jobs/{job_id}")
def get_job(job_id: str) -> Dict[str, Any]:
    storage = LocalStorage(settings.storage_root)
    job = storage.load_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Job not found."})
    return _job_json_safe(job)


@app.get("/api/v1/jobs/{job_id}/clips")
def get_job_clips(job_id: str) -> Dict[str, Any]:
    storage = LocalStorage(settings.storage_root)
    job = storage.load_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Job not found."})
    clips = _job_json_safe(job)["clips"]
    for c in clips:
        c["download_url"] = f"/api/v1/jobs/{job_id}/clips/{c['clip_id']}/download"
    return {"job_id": job_id, "status": job["status"], "clips": clips}


@app.get("/api/v1/jobs/{job_id}/clips/{clip_id}/download")
def download_clip(job_id: str, clip_id: str):
    storage = LocalStorage(settings.storage_root)
    job = storage.load_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Job not found."})
    clip = next((c for c in job.get("clips", []) if c.get("clip_id") == clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail={"code": "clip_not_found", "message": "Clip not found."})
    out_path = Path(clip.get("download_path", ""))
    if not out_path.exists():
        raise HTTPException(status_code=404, detail={"code": "clip_missing", "message": "Clip file is unavailable."})
    return FileResponse(str(out_path), media_type="video/mp4", filename=f"{clip_id}.mp4")


@app.delete("/api/v1/jobs/{job_id}")
def delete_job(job_id: str) -> Dict[str, Any]:
    storage = LocalStorage(settings.storage_root)
    job = storage.load_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"code": "job_not_found", "message": "Job not found."})
    storage.delete_job(job_id)
    return {"job_id": job_id, "status": "deleted"}


@app.exception_handler(HTTPException)
async def http_exc_handler(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "request_error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(Exception)
async def generic_exc_handler(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "message": "Unexpected server error."}})
