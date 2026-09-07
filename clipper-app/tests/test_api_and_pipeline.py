from __future__ import annotations

import json
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import main as api
from backend.config import get_settings
from backend.pipeline import PipelineError, cleanup_expired_jobs, ingest_url_to_file, process_job
from backend.storage import LocalStorage
from backend.selector import select_candidates


@pytest.fixture(autouse=True)
def clean_storage(monkeypatch, tmp_path):
    root = tmp_path / "clipper-storage"
    monkeypatch.setenv("CLIPPER_STORAGE_ROOT", str(root))
    monkeypatch.setenv("ALLOW_HTTP_TEST_URLS", "true")
    monkeypatch.setenv("ALLOWED_URL_DOMAINS", "youtube.com,youtu.be,example.com")
    monkeypatch.setenv("RETENTION_HOURS", "24")
    # refresh module-level settings copy
    api.settings = get_settings()
    yield


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api, "_queue_job", lambda _job_id: None)
    return TestClient(api.app)


def _make_video(path: Path, duration: int = 3):
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"testsrc=size=640x360:rate=30:duration={duration}",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency=800:duration={duration}",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        pytest.skip("ffmpeg unavailable in this environment")


def test_a_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True


def test_b_valid_upload_job_creation(client, monkeypatch):
    monkeypatch.setattr(api, "ffprobe_media", lambda _p: {"duration": 10.0, "streams": [{"codec_type": "video"}]})
    payload = b"dummy"
    res = client.post(
        "/api/v1/jobs/upload",
        data={"clip_count": "2", "clip_length_seconds": "20", "caption_style": "clean-white", "rights_affirmed": "true"},
        files={"file": ("video.mp4", payload, "video/mp4")},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "queued"


def test_c_unsupported_file_rejection(client):
    res = client.post(
        "/api/v1/jobs/upload",
        data={"clip_count": "2", "clip_length_seconds": "20", "caption_style": "clean-white", "rights_affirmed": "true"},
        files={"file": ("video.txt", b"dummy", "text/plain")},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "unsupported_file"


def test_d_oversized_upload_rejection(client, monkeypatch):
    monkeypatch.setenv("MAX_UPLOAD_MB", "1")
    api.settings = get_settings()
    res = client.post(
        "/api/v1/jobs/upload",
        data={"clip_count": "1", "clip_length_seconds": "20", "caption_style": "clean-white", "rights_affirmed": "true"},
        files={"file": ("video.mp4", b"x" * (2 * 1024 * 1024), "video/mp4")},
    )
    assert res.status_code == 413


def test_e_duration_limit_rejection(client, monkeypatch):
    monkeypatch.setattr(api, "ffprobe_media", lambda _p: {"duration": 99999.0, "streams": [{"codec_type": "video"}]})
    res = client.post(
        "/api/v1/jobs/upload",
        data={"clip_count": "1", "clip_length_seconds": "20", "caption_style": "clean-white", "rights_affirmed": "true"},
        files={"file": ("video.mp4", b"dummy", "video/mp4")},
    )
    assert res.status_code == 413


def test_f_invalid_url_rejection(client):
    res = client.post(
        "/api/v1/jobs/url",
        data={
            "source_url": "ftp://evil.example.com/video.mp4",
            "clip_count": "1",
            "clip_length_seconds": "20",
            "caption_style": "clean-white",
            "rights_affirmed": "true",
        },
    )
    assert res.status_code == 400


def test_g_private_loopback_url_rejection():
    with pytest.raises(ValueError):
        ingest_url_to_file("http://localhost/video", Path("/tmp/out.mp4"))


def test_h_redirect_ssrf_rejection(monkeypatch, tmp_path):
    class Resp:
        status_code = 302
        headers = {"Location": "http://127.0.0.1/private"}

    class Sess:
        def head(self, *_args, **_kwargs):
            return Resp()

    import backend.pipeline as p

    monkeypatch.setattr(p.requests, "Session", lambda: Sess())
    with pytest.raises(Exception):
        ingest_url_to_file("https://example.com/v", tmp_path / "x.mp4")


def test_i_missing_rights_affirmation_rejection(client):
    res = client.post(
        "/api/v1/jobs/url",
        data={"source_url": "https://youtube.com/watch?v=x", "clip_count": "1", "clip_length_seconds": "20", "caption_style": "clean-white", "rights_affirmed": "false"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "rights_required"


def test_j_job_state_transitions(monkeypatch):
    storage = LocalStorage(get_settings().storage_root)
    job = {
        "job_id": "jobstate1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "status": "queued",
        "source_type": "upload",
        "source_value": "x",
        "rights_affirmed": True,
        "clip_count": 1,
        "clip_length_seconds": 15,
        "caption_style": "clean-white",
        "clips": [],
    }
    d = storage.init_job_dir(job["job_id"])
    v = d / "input" / "input.mp4"
    _make_video(v)
    job["media_path"] = str(v)
    storage.save_job(job["job_id"], job)

    import backend.pipeline as p

    monkeypatch.setattr(p, "transcribe_audio", lambda _a: [{"start": 0.0, "end": 2.0, "text": "How to improve results quickly."}])
    result = process_job(job["job_id"])
    assert result["status"] in {"completed", "failed"}


def test_k_deterministic_candidate_ranking():
    segs = [
        {"start": 0, "end": 4, "text": "How do you grow faster?"},
        {"start": 5, "end": 9, "text": "This is critical and important now."},
    ]
    c1 = select_candidates(segs, 15, 2)
    c2 = select_candidates(segs, 15, 2)
    assert [(x.start, x.end, x.score) for x in c1] == [(x.start, x.end, x.score) for x in c2]


def test_l_overlap_deduplication():
    segs = [
        {"start": 0, "end": 4, "text": "How to fix this now?"},
        {"start": 0.1, "end": 4.1, "text": "How to fix this now?"},
    ]
    c = select_candidates(segs, 15, 5)
    assert len(c) == 1


def test_m_clip_count_and_duration_limits(client):
    res = client.post(
        "/api/v1/jobs/url",
        data={"source_url": "https://youtube.com/watch?v=x", "clip_count": "9", "clip_length_seconds": "10", "caption_style": "clean-white", "rights_affirmed": "true"},
    )
    assert res.status_code == 400


def test_n_safe_subprocess_construction(monkeypatch, tmp_path):
    calls = {}

    def fake_run(args, **kwargs):
        calls["args"] = args
        calls["kwargs"] = kwargs

        class R:
            returncode = 0
            stdout = ""
            stderr = ""

        return R()

    import backend.media as m

    monkeypatch.setattr(m.subprocess, "run", fake_run)
    m.run_subprocess(["ffprobe", "-v", "error", "x.mp4"])
    assert isinstance(calls["args"], list)
    assert "shell" not in calls["kwargs"] or calls["kwargs"].get("shell") is False


def test_o_successful_synthetic_video_processing(monkeypatch):
    storage = LocalStorage(get_settings().storage_root)
    job = {
        "job_id": "jobok1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "status": "queued",
        "source_type": "upload",
        "source_value": "x",
        "rights_affirmed": True,
        "clip_count": 1,
        "clip_length_seconds": 15,
        "caption_style": "clean-white",
        "clips": [],
    }
    d = storage.init_job_dir(job["job_id"])
    v = d / "input" / "input.mp4"
    _make_video(v)
    job["media_path"] = str(v)
    storage.save_job(job["job_id"], job)

    import backend.pipeline as p

    monkeypatch.setattr(p, "transcribe_audio", lambda _a: [{"start": 0.0, "end": 2.0, "text": "How to improve results quickly."}])
    result = process_job(job["job_id"])
    assert result["status"] == "completed"
    assert len(result["clips"]) == 1


def test_p_failed_processing_returns_safe_error(monkeypatch):
    storage = LocalStorage(get_settings().storage_root)
    job = {
        "job_id": "jobfail1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "status": "queued",
        "source_type": "upload",
        "source_value": "x",
        "rights_affirmed": True,
        "clip_count": 1,
        "clip_length_seconds": 15,
        "caption_style": "clean-white",
        "clips": [],
        "media_path": "/missing/file.mp4",
    }
    storage.init_job_dir(job["job_id"])
    storage.save_job(job["job_id"], job)
    result = process_job(job["job_id"])
    assert result["status"] == "failed"
    assert result["error_message"]


def test_q_download_authorization_job_validation(client):
    res = client.get("/api/v1/jobs/unknown/clips/clip-01/download")
    assert res.status_code == 404


def test_r_deletion_removes_job_files(client, monkeypatch):
    monkeypatch.setattr(api, "ffprobe_media", lambda _p: {"duration": 10.0, "streams": [{"codec_type": "video"}]})
    created = client.post(
        "/api/v1/jobs/upload",
        data={"clip_count": "1", "clip_length_seconds": "20", "caption_style": "clean-white", "rights_affirmed": "true"},
        files={"file": ("video.mp4", b"dummy", "video/mp4")},
    ).json()
    job_id = created["job_id"]
    resp = client.delete(f"/api/v1/jobs/{job_id}")
    assert resp.status_code == 200
    st = LocalStorage(get_settings().storage_root)
    assert st.load_job(job_id) is None


def test_s_expired_job_cleanup():
    st = LocalStorage(get_settings().storage_root)
    job = {
        "job_id": "expired1",
        "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        "status": "completed",
        "source_type": "upload",
        "source_value": "x",
        "rights_affirmed": True,
        "clip_count": 1,
        "clip_length_seconds": 15,
        "caption_style": "clean-white",
        "clips": [],
    }
    st.init_job_dir(job["job_id"])
    st.save_job(job["job_id"], job)
    removed = cleanup_expired_jobs()
    assert removed >= 1
    assert st.load_job(job["job_id"]) is None


def test_t_no_secrets_or_local_media_committed():
    repo = Path(__file__).resolve().parents[2]
    blocked_ext = {".mp4", ".mov", ".mkv", ".wav"}
    for p in repo.rglob("*"):
        if not p.is_file():
            continue
        if ".git" in p.parts or "__pycache__" in p.parts:
            continue
        if p.suffix.lower() in blocked_ext:
            pytest.fail(f"Committed media fixture detected: {p}")
    env_example = repo / "clipper-app" / ".env.example"
    text = env_example.read_text(encoding="utf-8")
    assert "SECRET=" not in text
