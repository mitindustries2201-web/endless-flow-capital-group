# EFCG AI Video Clipper MVP

This is a local/containerized MVP for clip generation from authorized video uploads or supported authorized URLs.

## Architecture

- `backend/` FastAPI API layer and deterministic selection pipeline
- `worker/` Redis/RQ worker process
- `tests/` backend and pipeline tests
- Storage abstraction writes to `CLIPPER_STORAGE_ROOT` (default `/tmp/efcg-clipper-storage`) and not inside the repository

## API Endpoints

- `GET /api/v1/health`
- `POST /api/v1/jobs/upload`
- `POST /api/v1/jobs/url`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/jobs/{job_id}/clips`
- `GET /api/v1/jobs/{job_id}/clips/{clip_id}/download`
- `DELETE /api/v1/jobs/{job_id}`

## Local Run

1. Copy env file:
   ```bash
   cp clipper-app/.env.example clipper-app/.env
   ```
2. Start services:
   ```bash
   docker compose -f clipper-app/docker-compose.yml up --build
   ```

## Behavior and Limits

- Rights affirmation is required for every job.
- Clip count: 1–5
- Clip length: 15–60 seconds
- URL imports are allowlist-restricted (`youtube.com`, `youtu.be` by default).
- HTTP URLs are blocked by default and only allowed in automated local tests when explicitly enabled.
- Private/loopback/link-local destinations are blocked.
- Retention is configurable and capped at 24 hours for this MVP.

## Python Test and Check Commands

```bash
python -m pip install -r clipper-app/requirements.txt
PYTHONPATH=clipper-app pytest -q clipper-app/tests
python -m compileall clipper-app/backend clipper-app/worker clipper-app/tests
```

## Notes

- The MVP uses local/container storage and requires production hardening for public deployment.
- No backend credentials or secrets are committed.
