from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_env: str
    api_base_url: str
    cors_origins: List[str]
    redis_url: str
    storage_root: str
    max_upload_mb: int
    max_duration_seconds: int
    min_clip_seconds: int
    max_clip_seconds: int
    max_clip_count: int
    allow_http_test_urls: bool
    allowlist_domains: List[str]
    rate_limit_ip_per_hour: int
    rate_limit_job_status_per_minute: int
    retention_hours: int
    human_verification_required: bool
    human_verification_secret: str



def get_settings() -> Settings:
    domains = [d.strip().lower() for d in os.getenv("ALLOWED_URL_DOMAINS", "youtube.com,youtu.be").split(",") if d.strip()]
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8080,http://localhost:3000").split(",") if o.strip()]
    return Settings(
        app_env=os.getenv("APP_ENV", "development").strip().lower(),
        api_base_url=os.getenv("API_BASE_URL", "http://localhost:8000"),
        cors_origins=origins,
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379/0"),
        storage_root=os.getenv("CLIPPER_STORAGE_ROOT", "/tmp/efcg-clipper-storage"),
        max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "300")),
        max_duration_seconds=int(os.getenv("MAX_DURATION_SECONDS", "5400")),
        min_clip_seconds=int(os.getenv("MIN_CLIP_SECONDS", "15")),
        max_clip_seconds=int(os.getenv("MAX_CLIP_SECONDS", "60")),
        max_clip_count=int(os.getenv("MAX_CLIP_COUNT", "5")),
        allow_http_test_urls=_env_bool("ALLOW_HTTP_TEST_URLS", False),
        allowlist_domains=domains,
        rate_limit_ip_per_hour=int(os.getenv("RATE_LIMIT_IP_PER_HOUR", "40")),
        rate_limit_job_status_per_minute=int(os.getenv("RATE_LIMIT_JOB_STATUS_PER_MINUTE", "120")),
        retention_hours=min(int(os.getenv("RETENTION_HOURS", "24")), 24),
        human_verification_required=_env_bool("HUMAN_VERIFICATION_REQUIRED", False),
        human_verification_secret=os.getenv("HUMAN_VERIFICATION_SECRET", ""),
    )
