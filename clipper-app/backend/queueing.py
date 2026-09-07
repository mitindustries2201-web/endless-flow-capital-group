from __future__ import annotations

from redis import Redis
from rq import Queue


def get_queue(redis_url: str) -> Queue:
    conn = Redis.from_url(redis_url)
    return Queue("clipper-jobs", connection=conn)
