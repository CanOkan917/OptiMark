import csv
from datetime import datetime, timezone
import json
import os
import re
from io import StringIO
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from generator.config import SheetConfig
from generator.sheet_generator import BubbleSheetGenerator

from .database import SessionLocal, get_db, init_db
from .deps import get_current_user, require_roles
from .models import (
    Course,
    CourseAuditLog,
    CourseTeacher,
    Exam,
    ExamAuditLog,
    ExamQuestion,
    ExamSheetTemplate,
    ExamSubmission,
    Student,
    StudentGroup,
    StudentGroupMembership,
    StudentImportJob,
    User,
    UserPreference,
    UserPreferenceAuditLog,
)
from .schemas import (
    AcademicYearsResponse,
    CourseCreate,
    CourseOut,
    CoursePatch,
    CoursesResponse,
    DashboardSummary,
    ExamBuilderMetaPatch,
    ExamBuilderOut,
    ExamBuilderQuestionPayload,
    ExamBuilderQuestionSave,
    ExamBuilderUpsert,
    ExamCreate,
    ExamOut,
    ExamPatch,
    ExamPublishPayload,
    ExamQuestionOut,
    ExamQuestionsUpsert,
    ExamOverviewMetricsOut,
    ExamOverviewOut,
    ExamSheetGenerationOut,
    ExamSheetTemplateOut,
    ExamsResponse,
    StudentCreate,
    StudentCsvImportRequest,
    StudentCsvImportResponse,
    StudentGroupCreate,
    StudentGroupOut,
    StudentGroupPatch,
    StudentGroupsResponse,
    StudentImportJobCreate,
    StudentImportJobOut,
    StudentImportJobsResponse,
    StudentOut,
    StudentPatch,
    StudentsResponse,
    TeacherItem,
    TeachersResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserOut,
    UserPreferenceOut,
    UserPreferenceUpdate,
)
from .security import (
    create_access_token,
    create_token,
    decode_token_payload,
    get_password_hash,
    verify_password,
)
from .seed import ensure_default_admin

VALID_ROLES = {"admin", "school_admin", "analyst", "teacher", "student"}
ACADEMIC_YEAR_REGEX = re.compile(r"^\d{4}-\d{4}$")
DOWNLOAD_TOKEN_PURPOSE = "exam_sheet_pdf_download"
DOWNLOAD_TOKEN_EXPIRE_MINUTES = int(os.getenv("SHEET_DOWNLOAD_LINK_EXPIRE_MINUTES", "60"))
PROJECT_ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(title="OptiMark API")

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origins = list(dict.fromkeys(default_origins + extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    with SessionLocal() as db:
        ensure_default_admin(db)




def build_academic_year_options(now: datetime | None = None, count: int = 3) -> list[str]:
    now = now or datetime.now(timezone.utc)
    start_year = now.year
    return [f"{start_year - index}-{start_year - index + 1}" for index in range(count)]


def get_default_academic_year() -> str:
    now = datetime.now(timezone.utc)
    current_start_year = now.year if now.month >= 9 else now.year - 1
    return f"{current_start_year}-{current_start_year + 1}"


def academic_year_start_year(value: str) -> int:
    validate_academic_year(value)
    return int(value.split("-")[0])


def get_selected_academic_year_for_user(db: Session, current_user: User) -> str:
    preference = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.id))
    if preference:
        return preference.selected_academic_year
    return get_default_academic_year()


def ensure_request_year_matches_selected(
    db: Session,
    current_user: User,
    academic_year: str,
    *,
    mismatch_status_code: int = status.HTTP_400_BAD_REQUEST,
) -> str:
    validate_academic_year(academic_year)
    selected_academic_year = get_selected_academic_year_for_user(db, current_user)
    if academic_year != selected_academic_year:
        detail = "Resource not found" if mismatch_status_code == status.HTTP_404_NOT_FOUND else "academic_year does not match selected academic year"
        raise HTTPException(status_code=mismatch_status_code, detail=detail)
    return selected_academic_year


def ensure_academic_year_is_writable(academic_year: str) -> None:
    current_start_year = academic_year_start_year(get_default_academic_year())
    target_start_year = academic_year_start_year(academic_year)
    if target_start_year < current_start_year:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Past academic years are archived and read-only",
        )


def validate_academic_year(value: str) -> str:
    if not ACADEMIC_YEAR_REGEX.match(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic_year")
    return value


def to_teacher_public_id(user_id: int) -> str:
    return f"t{user_id}"


def to_course_public_id(course_id: int) -> str:
    return f"c{course_id}"


def to_exam_public_id(exam_id: int) -> str:
    return f"e{exam_id}"


def to_exam_sheet_template_public_id(template_id: int) -> str:
    return f"sht{template_id}"


def to_student_public_id(student_id: int) -> str:
    return f"st{student_id}"


def to_student_group_public_id(group_id: int) -> str:
    return f"sg{group_id}"


def to_student_import_job_public_id(job_id: int) -> str:
    return f"ij{job_id}"


def parse_public_id(value: str, prefix: str, field_name: str) -> int:
    if not value or not value.startswith(prefix):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}")

    numeric = value[len(prefix) :]
    if not numeric.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}")
    return int(numeric)


def get_sheet_output_dir() -> Path:
    configured_output_dir = os.getenv("SHEET_OUTPUT_DIR", "").strip()
    if configured_output_dir:
        candidate = Path(configured_output_dir)
        if not candidate.is_absolute():
            candidate = PROJECT_ROOT / candidate
    else:
        candidate = PROJECT_ROOT / "output" / "sheets"
    candidate.mkdir(parents=True, exist_ok=True)
    return candidate.resolve()


def get_sheet_choice_labels(option_count: int) -> list[str]:
    return ["A", "B", "C", "D"] if option_count == 4 else ["A", "B", "C", "D", "E"]


def generate_sheet_artifacts_for_exam(
    exam: Exam,
    question_count: int,
    option_count: int,
) -> tuple[str, str]:
    output_dir = get_sheet_output_dir()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    base_filename = f"exam_{exam.id}_{timestamp}"
    pdf_path = output_dir / f"{base_filename}.pdf"
    template_path = output_dir / f"{base_filename}.json"

    config = SheetConfig(
        title=exam.title,
        output_path=str(pdf_path),
        num_questions=question_count,
        choices=get_sheet_choice_labels(option_count),
        export_template_json=True,
        template_output_path=str(template_path),
    )
    try:
        BubbleSheetGenerator(config).generate()
    except Exception as exc:
        pdf_path.unlink(missing_ok=True)
        template_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bubble sheet artifacts could not be generated",
        ) from exc

    if not template_path.exists():
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Template JSON could not be generated",
        )

    template_json_raw = template_path.read_text(encoding="utf-8")
    template_path.unlink(missing_ok=True)

    try:
        template_json = json.dumps(json.loads(template_json_raw), ensure_ascii=False)
    except json.JSONDecodeError as exc:
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Generated template JSON is invalid",
        ) from exc

    return str(pdf_path), template_json


def build_exam_sheet_download_url(
    request: Request,
    exam_public_id: str,
    template_public_id: str,
    download_token: str,
) -> str:
    base_url = str(
        request.url_for(
            "download_exam_sheet_template_pdf",
            exam_id=exam_public_id,
            template_id=template_public_id,
        )
    )
    query = urlencode({"token": download_token})
    return f"{base_url}?{query}"


def serialize_exam_sheet_generation(
    template: ExamSheetTemplate,
    exam: Exam,
    download_url: str,
) -> ExamSheetGenerationOut:
    return ExamSheetGenerationOut(
        id=to_exam_sheet_template_public_id(template.id),
        exam_id=to_exam_public_id(exam.id),
        academic_year=exam.academic_year,
        question_count=template.question_count,
        option_count=template.option_count,  # type: ignore[arg-type]
        created_at=template.created_at,
        download_url=download_url,
    )


def serialize_exam_sheet_template(
    template: ExamSheetTemplate,
    exam: Exam,
    download_url: str,
) -> ExamSheetTemplateOut:
    return ExamSheetTemplateOut(
        id=to_exam_sheet_template_public_id(template.id),
        exam_id=to_exam_public_id(exam.id),
        question_count=template.question_count,
        option_count=template.option_count,  # type: ignore[arg-type]
        created_at=template.created_at,
        download_url=download_url,
    )


def build_sheet_template_download_url(
    request: Request,
    exam: Exam,
    template: ExamSheetTemplate,
) -> str:
    download_token = create_token(
        {
            "purpose": DOWNLOAD_TOKEN_PURPOSE,
            "exam_id": exam.id,
            "template_id": template.id,
        },
        expires_minutes=DOWNLOAD_TOKEN_EXPIRE_MINUTES,
    )
    return build_exam_sheet_download_url(
        request=request,
        exam_public_id=to_exam_public_id(exam.id),
        template_public_id=to_exam_sheet_template_public_id(template.id),
        download_token=download_token,
    )


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


def get_group_ids_by_student_ids(db: Session, student_ids: list[int]) -> dict[int, list[str]]:
    if not student_ids:
        return {}

    rows = db.execute(
        select(StudentGroupMembership.student_id, StudentGroup.id)
        .join(StudentGroup, StudentGroup.id == StudentGroupMembership.group_id)
        .where(StudentGroupMembership.student_id.in_(student_ids))
    ).all()
    mapping: dict[int, list[str]] = {student_id: [] for student_id in student_ids}
    for student_id, group_id in rows:
        mapping.setdefault(student_id, []).append(to_student_group_public_id(group_id))
    return mapping


def get_student_counts_by_group_ids(db: Session, group_ids: list[int]) -> dict[int, int]:
    if not group_ids:
        return {}
    rows = db.execute(
        select(
            StudentGroupMembership.group_id,
            func.count(StudentGroupMembership.id),
        )
        .where(StudentGroupMembership.group_id.in_(group_ids))
        .group_by(StudentGroupMembership.group_id)
    ).all()
    return {group_id: int(count) for group_id, count in rows}


def serialize_student(student: Student, group_ids: list[str]) -> StudentOut:
    return StudentOut(
        id=to_student_public_id(student.id),
        academic_year=student.academic_year,
        student_no=student.student_no,
        full_name=student.full_name,
        email=student.email,
        grade_level=student.grade_level,
        group_ids=group_ids,
        status=student.status,  # type: ignore[arg-type]
        created_at=student.created_at,
        updated_at=student.updated_at,
    )


def serialize_student_group(group: StudentGroup, student_count: int) -> StudentGroupOut:
    return StudentGroupOut(
        id=to_student_group_public_id(group.id),
        academic_year=group.academic_year,
        code=group.code,
        name=group.name,
        advisor_name=group.advisor_name,
        capacity=group.capacity,
        student_count=student_count,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def serialize_student_import_job(job: StudentImportJob) -> StudentImportJobOut:
    return StudentImportJobOut(
        id=to_student_import_job_public_id(job.id),
        academic_year=job.academic_year,
        file_name=job.file_name,
        created_at=job.created_at,
        total_rows=job.total_rows,
        imported_rows=job.imported_rows,
        failed_rows=job.failed_rows,
        status=job.status,  # type: ignore[arg-type]
    )


def validate_group_ids_for_year(db: Session, academic_year: str, group_ids: list[str]) -> list[int]:
    if not group_ids:
        return []
    parsed_ids = [parse_public_id(item, "sg", "group_ids") for item in group_ids]
    unique_ids = list(dict.fromkeys(parsed_ids))
    rows = db.scalars(
        select(StudentGroup.id).where(
            StudentGroup.id.in_(unique_ids),
            StudentGroup.academic_year == academic_year,
        )
    ).all()
    if len(rows) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more group_ids are invalid")
    return unique_ids


def sync_student_group_memberships(db: Session, student_id: int, group_db_ids: list[int]) -> None:
    db.execute(delete(StudentGroupMembership).where(StudentGroupMembership.student_id == student_id))
    if group_db_ids:
        db.add_all(
            [
                StudentGroupMembership(student_id=student_id, group_id=group_id)
                for group_id in group_db_ids
            ]
        )


def normalize_csv_header(value: str | None) -> str:
    return (value or "").replace("\ufeff", "").strip().lower()


def resolve_teacher_user_ids(db: Session, teacher_ids: list[str]) -> list[int]:
    if not teacher_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="teacher_ids cannot be empty")

    parsed_ids: list[int] = []
    for teacher_id in teacher_ids:
        parsed_ids.append(parse_public_id(teacher_id, "t", "teacher_ids"))

    unique_ids = list(dict.fromkeys(parsed_ids))
    teachers = db.scalars(
        select(User.id).where(
            User.id.in_(unique_ids),
            User.role == "teacher",
            User.is_active.is_(True),
        )
    ).all()

    if len(teachers) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more teacher_ids are invalid",
        )

    return unique_ids


def get_teacher_map_for_courses(db: Session, course_ids: list[int]) -> dict[int, list[str]]:
    if not course_ids:
        return {}

    pairs = db.execute(
        select(CourseTeacher.course_id, CourseTeacher.teacher_user_id).where(
            CourseTeacher.course_id.in_(course_ids)
        )
    ).all()

    teacher_map: dict[int, list[str]] = {course_id: [] for course_id in course_ids}
    for course_id, teacher_user_id in pairs:
        teacher_map[course_id].append(to_teacher_public_id(teacher_user_id))

    return teacher_map


def serialize_course(course: Course, teacher_ids: list[str]) -> CourseOut:
    return CourseOut(
        id=to_course_public_id(course.id),
        academic_year=course.academic_year,
        name=course.name,
        code=course.code,
        description=course.description,
        teacher_ids=teacher_ids,
        created_at=course.created_at,
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


def can_manage_course(current_user: User, course_teacher_user_ids: set[int]) -> bool:
    if current_user.role in {"admin", "school_admin"}:
        return True
    if current_user.role == "teacher" and current_user.id in course_teacher_user_ids:
        return True
    return False


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

# Route modules
from .routes import core_routes as _core_routes  # noqa: F401
from .routes import courses_routes as _courses_routes  # noqa: F401
from .routes import students_routes as _students_routes  # noqa: F401
from .routes import exams_routes as _exams_routes  # noqa: F401
