from typing import Any
import json

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import (
    Exam,
    ExamQuestion,
    ExamSubmission,
    ScanJob,
    Student,
    StudentGroupMembership,
    User,
)
from ..schemas import (
    ExamAnalyticsBucket,
    ExamAnalyticsOut,
    ExamAnalyticsQuestionStat,
    ExamBuilderOut,
    ExamBuilderQuestionPayload,
    ExamOut,
    ExamOverviewMetricsOut,
    ExamQuestionOut,
)
from .ids import parse_public_id, to_course_public_id, to_exam_public_id


def ensure_exam_builder_is_editable(exam: Exam) -> None:
    if exam.publish_status == "published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Published exams are read-only in builder. Open exam overview instead.",
        )


def parse_int_claim(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def parse_group_public_ids(group_ids: list[str]) -> list[int]:
    parsed: list[int] = []
    for value in group_ids:
        raw = value.strip()
        if not raw:
            continue
        try:
            parsed.append(parse_public_id(raw, "sg", "assigned_student_groups"))
        except HTTPException:
            continue
    return list(dict.fromkeys(parsed))


def build_exam_overview_metrics(db: Session, exam: Exam) -> ExamOverviewMetricsOut:
    assigned_group_ids = parse_group_public_ids(
        [str(item).strip() for item in _parse_json_list(exam.assigned_student_groups_json, []) if str(item).strip()]
    )

    assigned_student_count = 0
    if assigned_group_ids:
        assigned_student_count = (
            db.scalar(
                select(func.count(func.distinct(StudentGroupMembership.student_id)))
                .select_from(StudentGroupMembership)
                .join(Student, Student.id == StudentGroupMembership.student_id)
                .where(
                    StudentGroupMembership.group_id.in_(assigned_group_ids),
                    Student.academic_year == exam.academic_year,
                )
            )
            or 0
        )

    submitted_answer_count = (
        db.scalar(
            select(func.count(ExamSubmission.id)).where(ExamSubmission.exam_id == exam.id)
        )
        or 0
    )
    graded_submission_count = (
        db.scalar(
            select(func.count(ExamSubmission.id)).where(
                ExamSubmission.exam_id == exam.id,
                ExamSubmission.graded_at.is_not(None),
            )
        )
        or 0
    )
    average_score = db.scalar(
        select(func.avg(ExamSubmission.score)).where(
            ExamSubmission.exam_id == exam.id,
            ExamSubmission.score.is_not(None),
        )
    )

    pending_grading_count = max(int(submitted_answer_count) - int(graded_submission_count), 0)
    absent_count = max(int(assigned_student_count) - int(submitted_answer_count), 0)
    participation_rate = (
        (float(submitted_answer_count) / float(assigned_student_count)) * 100.0
        if assigned_student_count > 0
        else 0.0
    )

    return ExamOverviewMetricsOut(
        assigned_student_count=int(assigned_student_count),
        submitted_answer_count=int(submitted_answer_count),
        graded_submission_count=int(graded_submission_count),
        pending_grading_count=int(pending_grading_count),
        absent_count=int(absent_count),
        average_score=float(average_score) if average_score is not None else None,
        participation_rate=round(participation_rate, 2),
    )


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return float((ordered[mid - 1] + ordered[mid]) / 2)


def build_exam_analytics(db: Session, exam: Exam) -> ExamAnalyticsOut:
    jobs = db.scalars(select(ScanJob).where(ScanJob.exam_id == exam.id)).all()

    total = len(jobs)
    completed = [j for j in jobs if j.status == "completed"]
    failed = sum(1 for j in jobs if j.status == "failed")
    pending = total - len(completed) - failed
    matched = sum(1 for j in completed if j.matched_student_id is not None)

    scores = [int(j.score) for j in completed if j.score is not None]
    max_scores = [int(j.max_score) for j in completed if j.max_score]
    max_score = max(max_scores) if max_scores else None

    average = round(sum(scores) / len(scores), 2) if scores else None
    median = _median([float(s) for s in scores])
    highest = max(scores) if scores else None
    lowest = min(scores) if scores else None

    pass_rate: float | None = None
    if scores and max_score:
        passed = sum(1 for s in scores if s >= max_score / 2)
        pass_rate = round(passed / len(scores) * 100.0, 2)

    # Score distribution as 5 buckets over percentage of the max score.
    bucket_defs = [("0–20%", 0, 20), ("20–40%", 20, 40), ("40–60%", 40, 60), ("60–80%", 60, 80), ("80–100%", 80, 101)]
    bucket_counts = [0] * len(bucket_defs)
    if max_score:
        for s in scores:
            pct = s / max_score * 100.0
            for i, (_, lo, hi) in enumerate(bucket_defs):
                if lo <= pct < hi:
                    bucket_counts[i] += 1
                    break
    distribution = [
        ExamAnalyticsBucket(label=label, count=count)
        for (label, _, _), count in zip(bucket_defs, bucket_counts)
    ]

    # Per-question aggregation from each completed scan's grading breakdown.
    agg: dict[int, dict[str, Any]] = {}
    for job in completed:
        if not job.result_json:
            continue
        try:
            payload = json.loads(job.result_json)
        except json.JSONDecodeError:
            continue
        for q in payload.get("grading", {}).get("questions", []):
            qno = q.get("question_no")
            if qno is None:
                continue
            entry = agg.setdefault(
                qno,
                {"correct": 0, "wrong": 0, "blank": 0, "ambiguous": 0, "correct_option": q.get("correct_option")},
            )
            state = q.get("state")
            if state in entry:
                entry[state] += 1

    question_stats: list[ExamAnalyticsQuestionStat] = []
    for qno in sorted(agg.keys()):
        e = agg[qno]
        answered = e["correct"] + e["wrong"] + e["blank"] + e["ambiguous"]
        correct_rate = round(e["correct"] / answered * 100.0, 1) if answered else 0.0
        question_stats.append(
            ExamAnalyticsQuestionStat(
                question_no=qno,
                correct_option=e["correct_option"],
                correct=e["correct"],
                wrong=e["wrong"],
                blank=e["blank"],
                ambiguous=e["ambiguous"],
                answered=answered,
                correct_rate=correct_rate,
            )
        )

    return ExamAnalyticsOut(
        total_scans=total,
        completed_scans=len(completed),
        failed_scans=failed,
        pending_scans=pending,
        matched_students=matched,
        unmatched_scans=len(completed) - matched,
        max_score=max_score,
        average_score=average,
        median_score=median,
        highest_score=highest,
        lowest_score=lowest,
        pass_rate=pass_rate,
        score_distribution=distribution,
        question_stats=question_stats,
    )


def fetch_exam_questions(db: Session, exam_id: int) -> list[ExamQuestion]:
    return db.scalars(
        select(ExamQuestion)
        .where(ExamQuestion.exam_id == exam_id)
        .order_by(ExamQuestion.question_order.asc())
    ).all()


def serialize_exam(exam: Exam, questions: list[ExamQuestion]) -> ExamOut:
    complete_questions = [question for question in questions if question.correct_option]
    assigned_groups = _parse_json_list(exam.assigned_student_groups_json, [])
    bubble_config_raw = exam.bubble_sheet_config_json or "{}"
    try:
        bubble_config_parsed = json.loads(bubble_config_raw)
    except json.JSONDecodeError:
        bubble_config_parsed = {}
    bubble_config = bubble_config_parsed if isinstance(bubble_config_parsed, dict) else {}
    return ExamOut(
        id=to_exam_public_id(exam.id),
        course_id=to_course_public_id(exam.course_id),
        title=exam.title,
        exam_date=exam.exam_date,
        duration_minutes=exam.duration_minutes,
        option_count=exam.option_count,
        scoring_formula=exam.scoring_formula,
        publish_status=exam.publish_status,  # type: ignore[arg-type]
        published_at=exam.published_at,
        assigned_student_groups=[str(item).strip() for item in assigned_groups if str(item).strip()],
        bubble_sheet_config={str(key): value for key, value in bubble_config.items()},
        questions=[
            ExamQuestionOut(
                id=question.question_key,
                text=question.text,
                correct_option=question.correct_option,  # type: ignore[arg-type]
            )
            for question in complete_questions
        ],
        bubble_sheet_generated=exam.bubble_sheet_generated,
        created_at=exam.created_at,
    )


def allowed_options(option_count: int) -> set[str]:
    return {"A", "B", "C", "D"} if option_count == 4 else {"A", "B", "C", "D", "E"}


def validate_questions_payload(questions: list[Any], option_count: int) -> None:
    valid_options = allowed_options(option_count)
    question_keys: set[str] = set()

    for item in questions:
        question_key = item.id.strip()
        if not question_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question id is required")
        if question_key in question_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question ids must be unique within an exam",
            )
        question_keys.add(question_key)

        if not item.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question text is required",
            )

        if item.correct_option not in valid_options:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"correct_option must be one of {sorted(valid_options)}",
            )


def _default_option_rows(question_key: str, option_count: int) -> list[dict[str, str]]:
    labels = ["A", "B", "C", "D"] if option_count == 4 else ["A", "B", "C", "D", "E"]
    return [{"id": f"{question_key}-{label}", "label": label, "text": ""} for label in labels]


def _parse_json_list(value: str | None, fallback: list[Any]) -> list[Any]:
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return fallback
    return parsed if isinstance(parsed, list) else fallback


def _derive_correct_option(option_rows: list[dict[str, Any]], correct_option_id: str | None) -> str | None:
    if not correct_option_id:
        return None
    for option in option_rows:
        if str(option.get("id", "")).strip() == correct_option_id:
            label = str(option.get("label", "")).strip()
            return label or None
    return None


def _normalize_builder_questions_from_rows(
    question_rows: list[ExamQuestion], option_count: int
) -> list[dict[str, Any]]:
    valid_labels = allowed_options(option_count)
    normalized: list[dict[str, Any]] = []
    for row in question_rows:
        raw_options = _parse_json_list(row.options_json, [])
        options: list[dict[str, str]] = []
        for item in raw_options:
            if not isinstance(item, dict):
                continue
            option_id = str(item.get("id", "")).strip()
            option_label = str(item.get("label", "")).strip()
            if not option_id or option_label not in valid_labels:
                continue
            options.append(
                {
                    "id": option_id,
                    "label": option_label,
                    "text": str(item.get("text", "")).strip(),
                }
            )
        if not options:
            options = _default_option_rows(row.question_key, option_count)

        correct_option_id = row.correct_option_id
        if not correct_option_id and row.correct_option:
            matched = next((item for item in options if item["label"] == row.correct_option), None)
            correct_option_id = matched["id"] if matched else None

        normalized.append(
            {
                "id": row.question_key,
                "text": row.text,
                "options": options,
                "correct_option_id": correct_option_id,
                "points": row.points,
                "difficulty": row.difficulty,
                "bloom_level": row.bloom_level,
                "tags": [str(tag).strip() for tag in _parse_json_list(row.tags_json, []) if str(tag).strip()],
            }
        )
    return normalized


def read_builder_questions(db: Session, exam: Exam) -> list[dict[str, Any]]:
    rows = fetch_exam_questions(db, exam.id)
    if rows:
        return _normalize_builder_questions_from_rows(rows, exam.option_count)

    # Backward compatibility: if no normalized rows exist yet, read legacy snapshot if present.
    if exam.builder_payload_json:
        try:
            payload = json.loads(exam.builder_payload_json)
            raw_questions = payload.get("questions") if isinstance(payload, dict) else None
            if isinstance(raw_questions, list):
                validated = [ExamBuilderQuestionPayload.model_validate(item) for item in raw_questions]
                return validate_builder_questions_payload(validated, exam.option_count)
        except (json.JSONDecodeError, ValueError):
            pass

    return []


def validate_builder_questions_payload(
    questions: list[ExamBuilderQuestionPayload], option_count: int
) -> list[dict[str, Any]]:
    valid_labels = allowed_options(option_count)
    question_ids: set[str] = set()
    normalized: list[dict[str, Any]] = []

    for question in questions:
        question_id = question.id.strip()
        if question_id in question_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Question ids must be unique within a builder payload",
            )
        question_ids.add(question_id)

        if len(question.options) > option_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Each question can contain at most {option_count} options",
            )

        option_ids: set[str] = set()
        option_labels: set[str] = set()
        normalized_options: list[dict[str, str]] = []
        for option in question.options:
            option_id = option.id.strip()
            if option_id in option_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Option ids must be unique inside a question",
                )
            option_ids.add(option_id)

            option_label = option.label
            if option_label not in valid_labels:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Option labels must be one of {sorted(valid_labels)}",
                )
            if option_label in option_labels:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Option labels must be unique inside a question",
                )
            option_labels.add(option_label)

            normalized_options.append(
                {
                    "id": option_id,
                    "label": option_label,
                    "text": option.text.strip(),
                }
            )

        correct_option_id = question.correct_option_id.strip() if question.correct_option_id else None
        if correct_option_id and correct_option_id not in option_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="correct_option_id must reference one of the question options",
            )

        normalized.append(
            {
                "id": question_id,
                "text": question.text.strip(),
                "options": normalized_options,
                "correct_option_id": correct_option_id,
                "points": question.points,
                "difficulty": question.difficulty,
                "bloom_level": question.bloom_level,
                "tags": [tag.strip() for tag in question.tags if tag.strip()],
            }
        )

    return normalized


def validate_builder_compatibility(questions: list[dict[str, Any]], option_count: int) -> None:
    valid_labels = allowed_options(option_count)
    for question in questions:
        options = question.get("options", [])
        if not isinstance(options, list):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid builder options format")
        if len(options) > option_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Builder payload has questions with more than {option_count} options",
            )
        for option in options:
            label = option.get("label")
            if label not in valid_labels:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Builder payload has option labels not allowed by option_count: {sorted(valid_labels)}",
                )


def extract_complete_builder_questions(
    questions: list[dict[str, Any]], option_count: int
) -> list[dict[str, Any]]:
    valid_labels = allowed_options(option_count)
    rows: list[dict[str, Any]] = []

    for question in questions:
        question_text = str(question.get("text", "")).strip()
        options = question.get("options")
        correct_option_id = question.get("correct_option_id")
        question_key = str(question.get("id", "")).strip()

        if not question_key or not question_text:
            continue
        if not isinstance(options, list) or not correct_option_id:
            continue

        correct_option_label: str | None = None
        for option in options:
            if option.get("id") == correct_option_id:
                option_label = option.get("label")
                if option_label in valid_labels:
                    correct_option_label = option_label
                break

        if not correct_option_label:
            continue

        rows.append(
            {
                "question_key": question_key,
                "question_order": int(question.get("question_order", 0)) if str(question.get("question_order", "")).isdigit() else None,
                "text": question_text,
                "options": options,
                "correct_option_id": correct_option_id,
                "correct_option": correct_option_label,
                "points": int(question.get("points", 10)),
                "difficulty": str(question.get("difficulty", "Medium")),
                "bloom_level": str(question.get("bloom_level", "Understand")),
                "tags": [str(tag).strip() for tag in question.get("tags", []) if str(tag).strip()],
            }
        )
    return rows


def sync_exam_questions_from_builder(db: Session, exam: Exam, questions: list[dict[str, Any]]) -> None:
    db.execute(delete(ExamQuestion).where(ExamQuestion.exam_id == exam.id))
    db.add_all(
        [
            ExamQuestion(
                exam_id=exam.id,
                question_key=str(item.get("id", "")).strip(),
                question_order=index,
                text=str(item.get("text", "")).strip(),
                options_json=json.dumps(item.get("options", [])),
                correct_option_id=str(item.get("correct_option_id", "")).strip() or None,
                correct_option=_derive_correct_option(item.get("options", []), str(item.get("correct_option_id", "")).strip() or None),
                points=int(item.get("points", 10)),
                difficulty=str(item.get("difficulty", "Medium")),
                bloom_level=str(item.get("bloom_level", "Understand")),
                tags_json=json.dumps([str(tag).strip() for tag in item.get("tags", []) if str(tag).strip()]),
            )
            for index, item in enumerate(questions, start=1)
            if str(item.get("id", "")).strip()
        ]
    )


def serialize_exam_builder(exam: Exam, questions: list[dict[str, Any]]) -> ExamBuilderOut:
    complete_count = len(extract_complete_builder_questions(questions, exam.option_count))
    return ExamBuilderOut(
        id=to_exam_public_id(exam.id),
        course_id=to_course_public_id(exam.course_id),
        title=exam.title,
        exam_date=exam.exam_date,
        duration_minutes=exam.duration_minutes,
        option_count=exam.option_count,  # type: ignore[arg-type]
        scoring_formula=exam.scoring_formula,  # type: ignore[arg-type]
        bubble_sheet_generated=exam.bubble_sheet_generated,
        questions=[ExamBuilderQuestionPayload.model_validate(item) for item in questions],
        total_question_count=len(questions),
        complete_question_count=complete_count,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
    )
