import os

from redis import Redis
from rq import Queue

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SCAN_QUEUE_NAME = os.getenv("SCAN_QUEUE_NAME", "optimark-scans")
SCAN_JOB_TIMEOUT_SECONDS = int(os.getenv("SCAN_JOB_TIMEOUT_SECONDS", "600"))

# Dotted path so the API process can enqueue without importing the task module
# (and therefore without importing OpenCV).
PROCESS_SCAN_TASK = "backend.worker.tasks.process_scan_job"

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(REDIS_URL)
    return _redis


def get_scan_queue() -> Queue:
    return Queue(
        SCAN_QUEUE_NAME,
        connection=get_redis(),
        default_timeout=SCAN_JOB_TIMEOUT_SECONDS,
    )


def enqueue_scan_job(scan_job_id: int) -> str:
    """Enqueue an OMR processing job and return the RQ job id."""
    job = get_scan_queue().enqueue(PROCESS_SCAN_TASK, scan_job_id)
    return job.id
