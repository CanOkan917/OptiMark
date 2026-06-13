"""OMR processing task executed inside the RQ worker process.

This module imports OpenCV (via ``omr.pipeline``) lazily, so the API process —
which only ever enqueues by dotted-path string — never pulls the heavy vision
stack into memory.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from ..database import SessionLocal
from ..models import (
    Exam,
    ExamQuestion,
    ExamSheetTemplate,
    ExamSubmission,
    ScanJob,
    Student,
)
from ..services.grading import AnswerKeyEntry, extract_marked_answers, grade


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _load_answer_key(db, exam_id: int) -> list[AnswerKeyEntry]:
    questions = db.scalars(
        select(ExamQuestion)
        .where(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.question_order)
    ).all()
    answer_key: list[AnswerKeyEntry] = []
    for idx, question in enumerate(questions, start=1):
        answer_key.append(
            AnswerKeyEntry(
                question_no=question.question_order or idx,
                correct_option=question.correct_option,
                points=question.points,
            )
        )
    return answer_key


def _resolve_template(db, job: ScanJob) -> ExamSheetTemplate | None:
    if job.sheet_template_id is not None:
        template = db.get(ExamSheetTemplate, job.sheet_template_id)
        if template is not None:
            return template
    return db.scalar(
        select(ExamSheetTemplate)
        .where(ExamSheetTemplate.exam_id == job.exam_id)
        .order_by(ExamSheetTemplate.created_at.desc())
    )


def _match_student(db, exam: Exam, detected_no: str | None) -> Student | None:
    if not detected_no:
        return None
    cleaned = detected_no.replace("_", "").replace("?", "").strip()
    if not cleaned:
        return None
    return db.scalar(
        select(Student).where(
            Student.academic_year == exam.academic_year,
            Student.student_no == cleaned,
        )
    )


def _mark_failed(scan_job_id: int, message: str) -> None:
    with SessionLocal() as db:
        job = db.get(ScanJob, scan_job_id)
        if job is not None:
            job.status = "failed"
            job.error_message = message[:2000]
            job.completed_at = _utcnow()
            db.commit()


def process_scan_job(scan_job_id: int) -> dict:
    """Run the full OMR pipeline + grading for a single uploaded sheet."""
    from omr.pipeline import OMRPipeline  # lazy: pulls OpenCV only in the worker

    with SessionLocal() as db:
        job = db.get(ScanJob, scan_job_id)
        if job is None:
            return {"error": "scan job not found", "scan_job_id": scan_job_id}

        job.status = "processing"
        job.progress = 10
        job.started_at = _utcnow()
        job.error_message = None
        db.commit()

        exam = db.get(Exam, job.exam_id)
        if exam is None:
            _mark_failed(scan_job_id, "Exam no longer exists")
            return {"error": "exam not found"}

        template = _resolve_template(db, job)
        if template is None:
            _mark_failed(scan_job_id, "No bubble sheet template found for this exam")
            return {"error": "template not found"}

        image_path = Path(job.image_storage_path)
        output_dir = Path(job.output_dir) if job.output_dir else image_path.parent / "out"
        output_dir.mkdir(parents=True, exist_ok=True)
        template_path = output_dir / "template.json"
        template_path.write_text(template.template_json, encoding="utf-8")

        job.sheet_template_id = template.id
        job.output_dir = str(output_dir)
        job.progress = 30
        db.commit()

    # Heavy CV work runs outside the DB transaction. Use locals captured above —
    # ``job`` is detached/expired once the session block closes.
    try:
        result = OMRPipeline().run(
            image_path=image_path,
            output_dir=output_dir,
            template_json=str(template_path),
        )
    except Exception as exc:  # noqa: BLE001 - surface any pipeline failure to the user
        _mark_failed(scan_job_id, f"OMR pipeline failed: {exc}")
        raise

    answers_payload: dict = {}
    if result.answers_path and Path(result.answers_path).exists():
        answers_payload = json.loads(Path(result.answers_path).read_text(encoding="utf-8"))

    marked_answers = extract_marked_answers(answers_payload)
    student_id_block = answers_payload.get("student_id") or {}
    detected_no = student_id_block.get("id_string") if isinstance(student_id_block, dict) else None

    with SessionLocal() as db:
        job = db.get(ScanJob, scan_job_id)
        exam = db.get(Exam, job.exam_id)

        answer_key = _load_answer_key(db, job.exam_id)
        grading = grade(
            answer_key,
            marked_answers,
            scoring_formula=exam.scoring_formula,
            option_count=exam.option_count,
        )
        matched = _match_student(db, exam, detected_no)

        overlay_path = output_dir / "answer_debug_overlay.png"

        submission = ExamSubmission(
            exam_id=job.exam_id,
            student_id=matched.id if matched else None,
            status="graded",
            score=int(round(grading.score)),
            graded_at=_utcnow(),
        )
        db.add(submission)
        db.flush()

        job.status = "completed"
        job.progress = 100
        job.completed_at = _utcnow()
        job.detected_student_no = detected_no
        job.detected_markers = result.detected_markers
        job.processing_mode = result.processing_mode
        job.overlay_storage_path = str(overlay_path) if overlay_path.exists() else None
        job.matched_student_id = matched.id if matched else None
        job.submission_id = submission.id
        job.score = int(round(grading.score))
        job.max_score = int(round(grading.max_score))
        job.correct_count = grading.correct_count
        job.wrong_count = grading.wrong_count
        job.blank_count = grading.blank_count
        job.ambiguous_count = grading.ambiguous_count
        job.result_json = json.dumps(
            {
                "grading": grading.as_dict(),
                "omr": {
                    "detected_markers": result.detected_markers,
                    "processing_mode": result.processing_mode,
                    "student_id": student_id_block,
                },
            },
            ensure_ascii=False,
        )
        db.commit()

        return {"status": "completed", "scan_job_id": scan_job_id, "score": job.score}
