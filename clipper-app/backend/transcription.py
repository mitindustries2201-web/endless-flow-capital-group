from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List


def transcribe_audio(audio_path: Path) -> List[Dict]:
    try:
        import whisper  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("transcriber_unavailable") from exc

    model = whisper.load_model("tiny")
    result = model.transcribe(str(audio_path), task="transcribe", fp16=False)
    segments = []
    for seg in result.get("segments", []):
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start + 0.5))
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        segments.append({"start": start, "end": end, "text": text})
    if not segments:
        raise RuntimeError("empty_transcript")
    return segments


def save_transcript_json(segments: List[Dict], path: Path) -> None:
    path.write_text(json.dumps({"segments": segments}, indent=2), encoding="utf-8")
