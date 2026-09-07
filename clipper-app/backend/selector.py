from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Dict, List

HOOK_TERMS = {"why", "how", "secret", "mistake", "truth", "stop", "never", "question", "what if", "biggest"}
EMPHASIS_TERMS = {"must", "critical", "important", "now", "today", "proven", "exactly", "clearly"}


@dataclass
class Candidate:
    start: float
    end: float
    score: float
    rationale: str


def _sentence_chunks(segments: List[Dict]) -> List[Dict]:
    chunks = []
    current = None
    for seg in segments:
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        if current is None:
            current = {"start": float(seg["start"]), "end": float(seg["end"]), "text": text}
        else:
            current["end"] = float(seg["end"])
            current["text"] += " " + text
        if re.search(r"[.!?]$", text):
            chunks.append(current)
            current = None
    if current:
        chunks.append(current)
    return chunks or segments


def _score_text(text: str) -> tuple[float, List[str]]:
    lc = text.lower()
    words = [w for w in re.split(r"\s+", lc) if w]
    score = 0.0
    reasons = []
    hook_hits = sum(1 for t in HOOK_TERMS if t in lc)
    if hook_hits:
        score += hook_hits * 1.8
        reasons.append("hook language")
    emphasis_hits = sum(1 for t in EMPHASIS_TERMS if t in lc)
    if emphasis_hits:
        score += emphasis_hits * 1.2
        reasons.append("emphasis terms")
    density = min(3.0, len(words) / 20.0)
    score += density
    if density >= 1.8:
        reasons.append("high transcript density")
    declarative = 1.2 if lc.count(" is ") + lc.count(" are ") >= 1 else 0.0
    score += declarative
    if declarative:
        reasons.append("strong declarative statement")
    question_boost = 1.4 if "?" in text else 0.0
    score += question_boost
    if question_boost:
        reasons.append("question hook")
    return score, reasons


def select_candidates(segments: List[Dict], clip_length_seconds: int, clip_count: int) -> List[Candidate]:
    chunks = _sentence_chunks(segments)
    candidates: List[Candidate] = []

    for idx, chunk in enumerate(chunks):
        start = max(0.0, float(chunk["start"]))
        end = float(chunk["end"])
        text = str(chunk.get("text", "")).strip()
        if not text:
            continue

        duration = end - start
        # expand around short chunks to target clip length while respecting boundaries
        target = float(clip_length_seconds)
        center = start + duration / 2.0
        clip_start = max(0.0, center - target / 2.0)
        clip_end = clip_start + target

        score, reasons = _score_text(text)
        if idx > 0 and chunks[idx - 1].get("text", "").strip().lower() == text.lower():
            score -= 1.0
            reasons.append("repetition penalty")

        rationale = ", ".join(dict.fromkeys(reasons)) or "complete spoken thought"
        candidates.append(Candidate(start=clip_start, end=clip_end, score=round(score, 3), rationale=rationale))

    candidates.sort(key=lambda c: c.score, reverse=True)
    deduped: List[Candidate] = []

    for cand in candidates:
        overlaps = False
        for existing in deduped:
            inter = max(0.0, min(cand.end, existing.end) - max(cand.start, existing.start))
            shorter = min(cand.end - cand.start, existing.end - existing.start)
            if shorter > 0 and inter / shorter >= 0.6:
                overlaps = True
                break
        if overlaps:
            continue
        deduped.append(cand)
        if len(deduped) >= clip_count:
            break

    return deduped
