from __future__ import annotations

import json
import mimetypes
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}
ALLOWED_MIME_PREFIXES = {"video/"}
CAPTION_STYLES = {"clean-white", "high-contrast-yellow", "subtle-cyan"}


def is_allowed_filename(name: str) -> bool:
    ext = Path(name).suffix.lower()
    return ext in ALLOWED_EXTENSIONS


def detect_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"


def validate_mime(mime: str) -> bool:
    return any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES)


def run_subprocess(args: List[str], timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=False, capture_output=True, text=True, timeout=timeout)


def ffprobe_media(path: Path) -> Dict:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        str(path),
    ]
    result = run_subprocess(cmd, timeout=120)
    if result.returncode != 0:
        raise ValueError("ffprobe_failed")
    data = json.loads(result.stdout or "{}")
    streams = data.get("streams", [])
    if not any(s.get("codec_type") == "video" for s in streams):
        raise ValueError("no_video_stream")
    duration = float(data.get("format", {}).get("duration", 0.0) or 0.0)
    if duration <= 0:
        raise ValueError("invalid_duration")
    return {
        "duration": duration,
        "streams": streams,
        "format": data.get("format", {}),
    }


def extract_audio(video_path: Path, audio_path: Path) -> None:
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(audio_path)
    ]
    result = run_subprocess(cmd, timeout=600)
    if result.returncode != 0:
        raise RuntimeError("audio_extract_failed")


def normalize_video(video_path: Path, normalized_path: Path) -> None:
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(normalized_path)
    ]
    result = run_subprocess(cmd, timeout=1200)
    if result.returncode != 0:
        raise RuntimeError("normalize_failed")


def make_clip_with_captions(source_video: Path, srt_path: Path, start_seconds: float, duration_seconds: float, out_path: Path, caption_style: str) -> None:
    style_map = {
        "clean-white": "Fontsize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0",
        "high-contrast-yellow": "Fontsize=30,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0",
        "subtle-cyan": "Fontsize=28,PrimaryColour=&H00FFD777,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0",
    }
    style = style_map.get(caption_style, style_map["clean-white"])

    vf = (
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,"
        f"subtitles='{str(srt_path).replace(':', '\\:')}':force_style='{style},Alignment=2,MarginV=110'"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{max(0.0, start_seconds):.3f}",
        "-i",
        str(source_video),
        "-t",
        f"{max(1.0, duration_seconds):.3f}",
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "22",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(out_path),
    ]
    result = run_subprocess(cmd, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError("clip_render_failed")


def write_srt(segments: List[Dict], srt_path: Path, offset: float = 0.0) -> None:
    lines = []
    for idx, seg in enumerate(segments, start=1):
        start = max(0.0, float(seg["start"]) - offset)
        end = max(start + 0.2, float(seg["end"]) - offset)
        text = str(seg.get("text", "")).strip().replace("\n", " ")
        if not text:
            continue
        lines.extend([str(idx), f"{_fmt_srt_ts(start)} --> {_fmt_srt_ts(end)}", text, ""])
    srt_path.write_text("\n".join(lines), encoding="utf-8")


def _fmt_srt_ts(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3600 * 1000)
    m, rem = divmod(rem, 60 * 1000)
    s, ms = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
