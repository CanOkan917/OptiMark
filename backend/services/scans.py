"""Scan upload + job orchestration (storage, validation, enqueue, serialize)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import Exam, ScanJob
from ..schemas import ScanJobOut, ScanJobResultOut
from .ids import to_exam_public_id, to_scan_job_public_id, to_student_public_id

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_SCAN_UPLOAD_BYTES", str(20 * 1024 * 1024)))
# Process synchronously instead of enqueuing — handy for local dev / tests.
SCAN_INLINE = os.getenv("SCAN_INLINE", "0") in {"1", "true", "True"}


def get_scan_storage_dir() -> Path:
    configured = os.getenv("SCAN_STORAGE_DIR", "").strip()
    if configured:
        candidate = Path(configured)
        if not candidate.is_absolute():
            candidate = PROJECT_ROOT / candidate
    else:
        candidate = PROJECT_ROOT / "data" / "scans"
    candidate.mkdir(parents=True, exist_ok=True)
    return candidate.resolve()


def validate_upload(content_type: str | None, size: int) -> str:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Upload a JPEG, PNG, WEBP or PDF sheet.",
        )
    if size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if size > MAX_UPLOAD_BYTES:
        limit_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum upload size is {limit_mb} MB.",
        )
    return ALLOWED_CONTENT_TYPES[content_type]


def create_scan_job(
    db: Session,
    exam: Exam,
    *,
    original_filename: str,
    content_type: str | None,
    data: bytes,
    sheet_template_id: int | None,
    created_by_user_id: int | None,
) -> ScanJob:
    extension = validate_upload(content_type, len(data))

    job = ScanJob(
        exam_id=exam.id,
        sheet_template_id=sheet_template_id,
        original_filename=(original_filename or "sheet")[:255],
        image_storage_path="",
        status="queued",
        progress=0,
        created_by_user_id=created_by_user_id,
    )
    db.add(job)
    db.flush()  # assign job.id

    job_dir = get_scan_storage_dir() / str(job.id)
    job_dir.mkdir(parents=True, exist_ok=True)
    image_path = job_dir / f"original{extension}"
    image_path.write_bytes(data)

    job.image_storage_path = str(image_path)
    job.output_dir = str(job_dir / "out")
    db.commit()
    db.refresh(job)
    return job


def dispatch_scan_job(job: ScanJob, db: Session) -> None:
    """Enqueue the job on the worker, or run it inline when SCAN_INLINE is set."""
    if SCAN_INLINE:
        from ..worker.tasks import process_scan_job

        process_scan_job(job.id)
        db.refresh(job)
        return

    try:
        from ..worker.queue import enqueue_scan_job

        queue_job_id = enqueue_scan_job(job.id)
    except Exception as exc:  # noqa: BLE001 - broker unreachable, etc.
        job.status = "failed"
        job.error_message = f"Could not enqueue processing job: {exc}"[:2000]
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Processing queue is unavailable. Please try again shortly.",
        ) from exc

    job.queue_job_id = queue_job_id
    db.commit()


def serialize_scan_job(job: ScanJob) -> ScanJobOut:
    return ScanJobOut(
        id=to_scan_job_public_id(job.id),
        exam_id=to_exam_public_id(job.exam_id),
        original_filename=job.original_filename,
        status=job.status,
        progress=job.progress,
        detected_student_no=job.detected_student_no,
        matched_student_id=(
            to_student_public_id(job.matched_student_id)
            if job.matched_student_id
            else None
        ),
        detected_markers=job.detected_markers,
        score=job.score,
        max_score=job.max_score,
        correct_count=job.correct_count,
        wrong_count=job.wrong_count,
        blank_count=job.blank_count,
        ambiguous_count=job.ambiguous_count,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


def serialize_scan_job_result(job: ScanJob) -> ScanJobResultOut:
    result: dict = {}
    if job.result_json:
        try:
            result = json.loads(job.result_json)
        except json.JSONDecodeError:
            result = {}
    return ScanJobResultOut(
        job=serialize_scan_job(job),
        processing_mode=job.processing_mode,
        has_overlay=bool(job.overlay_storage_path),
        result=result,
    )
