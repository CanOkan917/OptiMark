import csv
from datetime import datetime, timezone
import json
import os
import re
from io import StringIO
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import SessionLocal, get_db, init_db
from .deps import get_current_user, require_roles
from .models import (
    Course,
    CourseAuditLog,
    CourseTeacher,
    Exam,
    ExamAuditLog,
    ExamQuestion,
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
    ExamQuestionOut,
    ExamQuestionsUpsert,
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
from .security import create_access_token, get_password_hash, verify_password
from .seed import ensure_default_admin

VALID_ROLES = {"admin", "school_admin", "analyst", "teacher", "student"}
ACADEMIC_YEAR_REGEX = re.compile(r"^\d{4}-\d{4}$")

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(
        select(User).where(
            (User.username == payload.username_or_email)
            | (User.email == payload.username_or_email)
        )
    )
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is disabled")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(user.username)
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@app.get("/academic-years", response_model=AcademicYearsResponse)
def get_academic_years(_: User = Depends(get_current_user)) -> AcademicYearsResponse:
    return AcademicYearsResponse(items=build_academic_year_options())


@app.get("/users/me/preferences", response_model=UserPreferenceOut)
def get_my_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferenceOut:
    preference = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.id))

    if not preference:
        preference = UserPreference(
            user_id=current_user.id,
            selected_academic_year=get_default_academic_year(),
        )
        db.add(preference)
        db.commit()
        db.refresh(preference)

    return UserPreferenceOut(selected_academic_year=preference.selected_academic_year)


@app.put("/users/me/preferences", response_model=UserPreferenceOut)
def update_my_preferences(
    payload: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferenceOut:
    available_years = set(build_academic_year_options())
    if payload.selected_academic_year not in available_years:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid selected_academic_year",
        )

    preference = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.id))
    previous_year: str | None = None

    if not preference:
        preference = UserPreference(
            user_id=current_user.id,
            selected_academic_year=payload.selected_academic_year,
        )
        db.add(preference)
    else:
        previous_year = preference.selected_academic_year
        preference.selected_academic_year = payload.selected_academic_year

    audit_log = UserPreferenceAuditLog(
        user_id=current_user.id,
        previous_selected_academic_year=previous_year,
        new_selected_academic_year=payload.selected_academic_year,
        action="update_selected_academic_year",
        metadata_json=json.dumps({"endpoint": "PUT /users/me/preferences"}),
    )
    db.add(audit_log)

    db.commit()
    db.refresh(preference)

    return UserPreferenceOut(selected_academic_year=preference.selected_academic_year)


@app.get("/teachers", response_model=TeachersResponse)
def list_teachers(
    academic_year: str = Query(...),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeachersResponse:
    ensure_request_year_matches_selected(db, current_user, academic_year)

    statement = select(User).where(User.role == "teacher", User.is_active.is_(True))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                User.full_name.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    teachers = db.scalars(statement.order_by(User.full_name.asc().nullslast(), User.username.asc())).all()
    items = [
        TeacherItem(
            id=to_teacher_public_id(teacher.id),
            name=teacher.full_name or teacher.username,
            email=teacher.email,
        )
        for teacher in teachers
    ]

    return TeachersResponse(items=items)


@app.post("/courses", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> CourseOut:
    validate_academic_year(payload.academic_year)
    ensure_request_year_matches_selected(db, current_user, payload.academic_year)
    ensure_academic_year_is_writable(payload.academic_year)
    teacher_user_ids = resolve_teacher_user_ids(db, payload.teacher_ids)

    if current_user.role == "teacher" and current_user.id not in teacher_user_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teachers can only create courses assigned to themselves",
        )

    course = Course(
        academic_year=payload.academic_year,
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        description=payload.description.strip() if payload.description else None,
        created_by_user_id=current_user.id,
    )
    db.add(course)
    db.flush()

    db.add_all(
        [
            CourseTeacher(course_id=course.id, teacher_user_id=teacher_user_id)
            for teacher_user_id in teacher_user_ids
        ]
    )

    db.add(
        CourseAuditLog(
            course_id=course.id,
            actor_user_id=current_user.id,
            action="create",
            metadata_json=json.dumps(
                {
                    "academic_year": course.academic_year,
                    "name": course.name,
                    "code": course.code,
                    "teacher_ids": payload.teacher_ids,
                }
            ),
        )
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A course with this code already exists in the academic year",
        ) from None

    db.refresh(course)
    teacher_ids = [to_teacher_public_id(teacher_id) for teacher_id in teacher_user_ids]
    return serialize_course(course, teacher_ids)


@app.get("/courses", response_model=CoursesResponse)
def list_courses(
    academic_year: str = Query(...),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CoursesResponse:
    ensure_request_year_matches_selected(db, current_user, academic_year)

    statement = select(Course).where(Course.academic_year == academic_year)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Course.name.ilike(pattern),
                Course.code.ilike(pattern),
                Course.description.ilike(pattern),
            )
        )

    courses = db.scalars(statement.order_by(Course.created_at.desc())).all()
    course_ids = [course.id for course in courses]
    teacher_map = get_teacher_map_for_courses(db, course_ids)

    return CoursesResponse(
        items=[serialize_course(course, teacher_map.get(course.id, [])) for course in courses]
    )


@app.get("/courses/{course_id}", response_model=CourseOut)
def get_course_detail(
    course_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CourseOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_course_id = parse_public_id(course_id, "c", "course_id")
    course = db.scalar(select(Course).where(Course.id == parsed_course_id))
    if not course or course.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    teacher_map = get_teacher_map_for_courses(db, [course.id])
    return serialize_course(course, teacher_map.get(course.id, []))


@app.patch("/courses/{course_id}", response_model=CourseOut)
def update_course(
    course_id: str,
    payload: CoursePatch,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> CourseOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_course_id = parse_public_id(course_id, "c", "course_id")
    course = db.scalar(select(Course).where(Course.id == parsed_course_id))
    if not course or course.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    ensure_academic_year_is_writable(course.academic_year)

    current_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == course.id)
        ).all()
    )

    if not can_manage_course(current_user, current_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    changes: dict[str, Any] = {}

    if payload.name is not None:
        updated_name = payload.name.strip()
        if updated_name != course.name:
            changes["name"] = {"from": course.name, "to": updated_name}
            course.name = updated_name

    if payload.code is not None:
        updated_code = payload.code.strip().upper()
        if updated_code != course.code:
            changes["code"] = {"from": course.code, "to": updated_code}
            course.code = updated_code

    if payload.description is not None:
        updated_description = payload.description.strip() if payload.description else None
        if updated_description != course.description:
            changes["description"] = {"from": course.description, "to": updated_description}
            course.description = updated_description

    next_teacher_user_ids = list(current_teacher_user_ids)
    if payload.teacher_ids is not None:
        resolved_teacher_user_ids = resolve_teacher_user_ids(db, payload.teacher_ids)

        if current_user.role == "teacher" and current_user.id not in resolved_teacher_user_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers cannot remove themselves from a course they manage",
            )

        if set(resolved_teacher_user_ids) != current_teacher_user_ids:
            changes["teacher_ids"] = {
                "from": [to_teacher_public_id(item) for item in sorted(current_teacher_user_ids)],
                "to": [to_teacher_public_id(item) for item in resolved_teacher_user_ids],
            }
            db.execute(delete(CourseTeacher).where(CourseTeacher.course_id == course.id))
            db.add_all(
                [
                    CourseTeacher(course_id=course.id, teacher_user_id=teacher_user_id)
                    for teacher_user_id in resolved_teacher_user_ids
                ]
            )
            next_teacher_user_ids = resolved_teacher_user_ids

    if changes:
        db.add(
            CourseAuditLog(
                course_id=course.id,
                actor_user_id=current_user.id,
                action="update",
                metadata_json=json.dumps(changes),
            )
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A course with this code already exists in the academic year",
        ) from None

    db.refresh(course)
    return serialize_course(
        course,
        [to_teacher_public_id(teacher_user_id) for teacher_user_id in next_teacher_user_ids],
    )


@app.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> None:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_course_id = parse_public_id(course_id, "c", "course_id")
    course = db.scalar(select(Course).where(Course.id == parsed_course_id))
    if not course or course.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    ensure_academic_year_is_writable(course.academic_year)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == course.id)
        ).all()
    )

    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    snapshot = {
        "public_id": to_course_public_id(course.id),
        "academic_year": course.academic_year,
        "name": course.name,
        "code": course.code,
        "teacher_ids": [to_teacher_public_id(item) for item in sorted(course_teacher_user_ids)],
    }

    db.add(
        CourseAuditLog(
            course_id=course.id,
            actor_user_id=current_user.id,
            action="delete",
            metadata_json=json.dumps(snapshot),
        )
    )
    db.delete(course)
    db.commit()


@app.get("/student-groups", response_model=StudentGroupsResponse)
def list_student_groups(
    academic_year: str = Query(...),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentGroupsResponse:
    ensure_request_year_matches_selected(db, current_user, academic_year)
    statement = select(StudentGroup).where(StudentGroup.academic_year == academic_year)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                StudentGroup.code.ilike(pattern),
                StudentGroup.name.ilike(pattern),
                StudentGroup.advisor_name.ilike(pattern),
            )
        )
    groups = db.scalars(statement.order_by(StudentGroup.created_at.desc())).all()
    counts = get_student_counts_by_group_ids(db, [item.id for item in groups])
    return StudentGroupsResponse(
        items=[serialize_student_group(item, counts.get(item.id, 0)) for item in groups]
    )


@app.post("/student-groups", response_model=StudentGroupOut, status_code=status.HTTP_201_CREATED)
def create_student_group(
    payload: StudentGroupCreate,
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> StudentGroupOut:
    validate_academic_year(payload.academic_year)
    ensure_request_year_matches_selected(db, current_user, payload.academic_year)
    ensure_academic_year_is_writable(payload.academic_year)

    group = StudentGroup(
        academic_year=payload.academic_year,
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        advisor_name=payload.advisor_name.strip(),
        capacity=payload.capacity,
        created_by_user_id=current_user.id,
    )
    if not group.code or not group.name or not group.advisor_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code, name and advisor_name are required")
    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A group with this code already exists in the academic year",
        ) from None
    db.refresh(group)
    return serialize_student_group(group, 0)


@app.get("/student-groups/{group_id}", response_model=StudentGroupOut)
def get_student_group(
    group_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentGroupOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_group_id = parse_public_id(group_id, "sg", "group_id")
    group = db.scalar(select(StudentGroup).where(StudentGroup.id == parsed_group_id))
    if not group or group.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student group not found")
    counts = get_student_counts_by_group_ids(db, [group.id])
    return serialize_student_group(group, counts.get(group.id, 0))


@app.patch("/student-groups/{group_id}", response_model=StudentGroupOut)
def update_student_group(
    group_id: str,
    payload: StudentGroupPatch,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> StudentGroupOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_group_id = parse_public_id(group_id, "sg", "group_id")
    group = db.scalar(select(StudentGroup).where(StudentGroup.id == parsed_group_id))
    if not group or group.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student group not found")
    ensure_academic_year_is_writable(group.academic_year)

    if payload.code is not None:
        next_code = payload.code.strip().upper()
        if not next_code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code is required")
        group.code = next_code
    if payload.name is not None:
        next_name = payload.name.strip()
        if not next_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name is required")
        group.name = next_name
    if payload.advisor_name is not None:
        next_advisor_name = payload.advisor_name.strip()
        if not next_advisor_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="advisor_name is required")
        group.advisor_name = next_advisor_name
    if payload.capacity is not None:
        group.capacity = payload.capacity

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A group with this code already exists in the academic year",
        ) from None
    db.refresh(group)
    counts = get_student_counts_by_group_ids(db, [group.id])
    return serialize_student_group(group, counts.get(group.id, 0))


@app.delete("/student-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_group(
    group_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> None:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_group_id = parse_public_id(group_id, "sg", "group_id")
    group = db.scalar(select(StudentGroup).where(StudentGroup.id == parsed_group_id))
    if not group or group.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student group not found")
    ensure_academic_year_is_writable(group.academic_year)
    db.delete(group)
    db.commit()


@app.get("/students", response_model=StudentsResponse)
def list_students(
    academic_year: str = Query(...),
    search: str | None = Query(default=None),
    group_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentsResponse:
    ensure_request_year_matches_selected(db, current_user, academic_year)
    statement = select(Student).where(Student.academic_year == academic_year)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Student.student_no.ilike(pattern),
                Student.full_name.ilike(pattern),
                Student.email.ilike(pattern),
            )
        )
    students = db.scalars(statement.order_by(Student.created_at.desc())).all()
    if group_id:
        parsed_group_id = parse_public_id(group_id, "sg", "group_id")
        group = db.scalar(select(StudentGroup).where(StudentGroup.id == parsed_group_id))
        if not group or group.academic_year != academic_year:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student group not found")
        grouped_student_ids = set(
            db.scalars(
                select(StudentGroupMembership.student_id).where(StudentGroupMembership.group_id == group.id)
            ).all()
        )
        students = [item for item in students if item.id in grouped_student_ids]
    mapping = get_group_ids_by_student_ids(db, [item.id for item in students])
    return StudentsResponse(items=[serialize_student(item, mapping.get(item.id, [])) for item in students])


@app.post("/students", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> StudentOut:
    validate_academic_year(payload.academic_year)
    ensure_request_year_matches_selected(db, current_user, payload.academic_year)
    ensure_academic_year_is_writable(payload.academic_year)
    group_db_ids = validate_group_ids_for_year(db, payload.academic_year, payload.group_ids)

    student = Student(
        academic_year=payload.academic_year,
        student_no=payload.student_no.strip(),
        full_name=payload.full_name.strip(),
        email=str(payload.email).strip().lower(),
        grade_level=payload.grade_level.strip(),
        status=payload.status,
        created_by_user_id=current_user.id,
    )
    if not student.student_no or not student.full_name or not student.email or not student.grade_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="student_no, full_name, email and grade_level are required",
        )

    db.add(student)
    db.flush()
    sync_student_group_memberships(db, student.id, group_db_ids)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this student_no already exists in the academic year",
        ) from None
    db.refresh(student)
    mapping = get_group_ids_by_student_ids(db, [student.id])
    return serialize_student(student, mapping.get(student.id, []))


@app.get("/students/{student_id}", response_model=StudentOut)
def get_student(
    student_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_student_id = parse_public_id(student_id, "st", "student_id")
    student = db.scalar(select(Student).where(Student.id == parsed_student_id))
    if not student or student.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    mapping = get_group_ids_by_student_ids(db, [student.id])
    return serialize_student(student, mapping.get(student.id, []))


@app.patch("/students/{student_id}", response_model=StudentOut)
def update_student(
    student_id: str,
    payload: StudentPatch,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> StudentOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_student_id = parse_public_id(student_id, "st", "student_id")
    student = db.scalar(select(Student).where(Student.id == parsed_student_id))
    if not student or student.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    ensure_academic_year_is_writable(student.academic_year)

    if payload.student_no is not None:
        next_student_no = payload.student_no.strip()
        if not next_student_no:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_no is required")
        student.student_no = next_student_no
    if payload.full_name is not None:
        next_full_name = payload.full_name.strip()
        if not next_full_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="full_name is required")
        student.full_name = next_full_name
    if payload.email is not None:
        next_email = str(payload.email).strip().lower()
        if not next_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email is required")
        student.email = next_email
    if payload.grade_level is not None:
        next_grade_level = payload.grade_level.strip()
        if not next_grade_level:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="grade_level is required")
        student.grade_level = next_grade_level
    if payload.status is not None:
        student.status = payload.status

    if payload.group_ids is not None:
        group_db_ids = validate_group_ids_for_year(db, student.academic_year, payload.group_ids)
        sync_student_group_memberships(db, student.id, group_db_ids)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this student_no already exists in the academic year",
        ) from None
    db.refresh(student)
    mapping = get_group_ids_by_student_ids(db, [student.id])
    return serialize_student(student, mapping.get(student.id, []))


@app.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> None:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_student_id = parse_public_id(student_id, "st", "student_id")
    student = db.scalar(select(Student).where(Student.id == parsed_student_id))
    if not student or student.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    ensure_academic_year_is_writable(student.academic_year)
    db.delete(student)
    db.commit()


@app.get("/student-import-jobs", response_model=StudentImportJobsResponse)
def list_student_import_jobs(
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentImportJobsResponse:
    ensure_request_year_matches_selected(db, current_user, academic_year)
    jobs = db.scalars(
        select(StudentImportJob)
        .where(StudentImportJob.academic_year == academic_year)
        .order_by(StudentImportJob.created_at.desc())
    ).all()
    return StudentImportJobsResponse(items=[serialize_student_import_job(item) for item in jobs])


@app.post("/student-import-jobs/mock", response_model=StudentImportJobOut, status_code=status.HTTP_201_CREATED)
def create_student_import_job_mock(
    payload: StudentImportJobCreate,
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> StudentImportJobOut:
    validate_academic_year(payload.academic_year)
    ensure_request_year_matches_selected(db, current_user, payload.academic_year)
    ensure_academic_year_is_writable(payload.academic_year)
    if payload.imported_rows + payload.failed_rows > payload.total_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="imported_rows + failed_rows cannot exceed total_rows",
        )

    job = StudentImportJob(
        academic_year=payload.academic_year,
        file_name=payload.file_name.strip(),
        total_rows=payload.total_rows,
        imported_rows=payload.imported_rows,
        failed_rows=payload.failed_rows,
        status=payload.status,
        created_by_user_id=current_user.id,
    )
    if not job.file_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_name is required")
    db.add(job)
    db.commit()
    db.refresh(job)
    return serialize_student_import_job(job)


@app.post("/student-import-jobs/import", response_model=StudentCsvImportResponse, status_code=status.HTTP_201_CREATED)
def import_students_from_csv(
    payload: StudentCsvImportRequest,
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> StudentCsvImportResponse:
    validate_academic_year(payload.academic_year)
    ensure_request_year_matches_selected(db, current_user, payload.academic_year)
    ensure_academic_year_is_writable(payload.academic_year)

    csv_content = payload.csv_content.strip()
    if not csv_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="csv_content is required")

    reader = csv.DictReader(StringIO(csv_content))
    required_columns = {"student_no", "full_name", "email", "grade_level", "group_code", "status"}
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV header row is required")
    normalized_headers = {normalize_csv_header(header) for header in reader.fieldnames if normalize_csv_header(header)}
    missing_columns = sorted(required_columns - normalized_headers)
    if missing_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required CSV columns: {', '.join(missing_columns)}",
        )

    groups = db.scalars(
        select(StudentGroup).where(StudentGroup.academic_year == payload.academic_year)
    ).all()
    groups_by_code = {group.code.strip().upper(): group for group in groups}

    existing_students = db.scalars(
        select(Student).where(Student.academic_year == payload.academic_year)
    ).all()
    students_by_student_no = {student.student_no.strip(): student for student in existing_students}

    total_rows = 0
    created_count = 0
    updated_count = 0
    failed_count = 0
    errors: list[str] = []

    for line_number, row in enumerate(reader, start=2):
        normalized_row = {normalize_csv_header(key): value for key, value in row.items()}
        total_rows += 1
        student_no = str(normalized_row.get("student_no", "")).strip()
        full_name = str(normalized_row.get("full_name", "")).strip()
        email = str(normalized_row.get("email", "")).strip().lower()
        grade_level = str(normalized_row.get("grade_level", "")).strip()
        group_code = str(normalized_row.get("group_code", "")).strip().upper()
        status_value = str(normalized_row.get("status", "active")).strip().lower() or "active"

        if not student_no or not full_name or not email or not grade_level or not group_code:
            failed_count += 1
            errors.append(f"Line {line_number}: missing required field(s)")
            continue
        if status_value not in {"active", "inactive"}:
            failed_count += 1
            errors.append(f"Line {line_number}: status must be active or inactive")
            continue
        group = groups_by_code.get(group_code)
        if not group:
            failed_count += 1
            errors.append(f"Line {line_number}: group_code '{group_code}' not found in academic year {payload.academic_year}")
            continue

        student = students_by_student_no.get(student_no)
        if student is None:
            student = Student(
                academic_year=payload.academic_year,
                student_no=student_no,
                full_name=full_name,
                email=email,
                grade_level=grade_level,
                status=status_value,
                created_by_user_id=current_user.id,
            )
            db.add(student)
            db.flush()
            students_by_student_no[student_no] = student
            created_count += 1
        else:
            student.full_name = full_name
            student.email = email
            student.grade_level = grade_level
            student.status = status_value
            updated_count += 1

        sync_student_group_memberships(db, student.id, [group.id])

    imported_rows = created_count + updated_count
    job_status = "completed" if failed_count == 0 else ("failed" if imported_rows == 0 else "partial")
    job = StudentImportJob(
        academic_year=payload.academic_year,
        file_name=payload.file_name.strip(),
        total_rows=total_rows,
        imported_rows=imported_rows,
        failed_rows=failed_count,
        status=job_status,
        created_by_user_id=current_user.id,
    )
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Import failed due to duplicate student numbers in the same academic year",
        ) from None
    db.refresh(job)

    return StudentCsvImportResponse(
        job=serialize_student_import_job(job),
        total_rows=total_rows,
        created_count=created_count,
        updated_count=updated_count,
        failed_count=failed_count,
        errors=errors[:50],
    )


@app.post("/exams", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(
    payload: ExamCreate,
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamOut:
    validate_academic_year(payload.academic_year)
    ensure_request_year_matches_selected(db, current_user, payload.academic_year)
    ensure_academic_year_is_writable(payload.academic_year)
    validate_questions_payload(payload.questions, payload.option_count)

    parsed_course_id = parse_public_id(payload.course_id, "c", "course_id")
    course = db.scalar(select(Course).where(Course.id == parsed_course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.academic_year != payload.academic_year:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="course_id does not belong to academic_year",
        )

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == course.id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    exam = Exam(
        academic_year=payload.academic_year,
        course_id=course.id,
        title=payload.title.strip(),
        exam_date=payload.exam_date,
        duration_minutes=payload.duration_minutes,
        option_count=payload.option_count,
        scoring_formula=payload.scoring_formula,
        bubble_sheet_generated=False,
        publish_status="draft",
        published_at=None,
        assigned_student_groups_json=json.dumps(
            [item.strip() for item in payload.assigned_student_groups if item.strip()]
        ),
        bubble_sheet_config_json=json.dumps(payload.bubble_sheet_config),
        created_by_user_id=current_user.id,
    )
    if not exam.title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title is required")
    db.add(exam)
    db.flush()

    builder_questions: list[dict[str, Any]] = []
    for question in payload.questions:
        question_key = question.id.strip()
        options = _default_option_rows(question_key, payload.option_count)
        correct_option_id = next(
            (item["id"] for item in options if item["label"] == question.correct_option),
            None,
        )
        builder_questions.append(
            {
                "id": question_key,
                "text": question.text.strip(),
                "options": options,
                "correct_option_id": correct_option_id,
                "points": 10,
                "difficulty": "Medium",
                "bloom_level": "Understand",
                "tags": [],
            }
        )
    sync_exam_questions_from_builder(db, exam, builder_questions)

    db.add(
        ExamAuditLog(
            exam_id=exam.id,
            actor_user_id=current_user.id,
            action="create",
            metadata_json=json.dumps(
                {
                    "academic_year": exam.academic_year,
                    "course_id": payload.course_id,
                    "title": exam.title,
                    "question_count": len(payload.questions),
                }
            ),
        )
    )

    db.commit()
    db.refresh(exam)

    persisted_questions = fetch_exam_questions(db, exam.id)
    return serialize_exam(exam, persisted_questions)


@app.get("/exams", response_model=ExamsResponse)
def list_exams(
    academic_year: str = Query(...),
    course_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExamsResponse:
    ensure_request_year_matches_selected(db, current_user, academic_year)

    statement = select(Exam).where(Exam.academic_year == academic_year)
    if course_id:
        parsed_course_id = parse_public_id(course_id, "c", "course_id")
        statement = statement.where(Exam.course_id == parsed_course_id)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(Exam.title.ilike(pattern))

    exams = db.scalars(statement.order_by(Exam.created_at.desc())).all()
    exam_ids = [exam.id for exam in exams]

    question_rows = db.scalars(
        select(ExamQuestion)
        .where(ExamQuestion.exam_id.in_(exam_ids))
        .order_by(ExamQuestion.exam_id.asc(), ExamQuestion.question_order.asc())
    ).all() if exam_ids else []

    question_map: dict[int, list[ExamQuestion]] = {exam_id: [] for exam_id in exam_ids}
    for row in question_rows:
        question_map[row.exam_id].append(row)

    return ExamsResponse(items=[serialize_exam(exam, question_map.get(exam.id, [])) for exam in exams])


@app.get("/exams/{exam_id}", response_model=ExamOut)
def get_exam_detail(
    exam_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExamOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    questions = fetch_exam_questions(db, exam.id)
    return serialize_exam(exam, questions)


@app.get("/exams/{exam_id}/builder", response_model=ExamBuilderOut)
def get_exam_builder(
    exam_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExamBuilderOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    builder_questions = read_builder_questions(db, exam)
    return serialize_exam_builder(exam, builder_questions)


@app.put("/exams/{exam_id}/builder", response_model=ExamBuilderOut)
def upsert_exam_builder(
    exam_id: str,
    payload: ExamBuilderUpsert,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamBuilderOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    ensure_academic_year_is_writable(exam.academic_year)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    changes: dict[str, Any] = {}

    if payload.title is not None:
        updated_title = payload.title.strip()
        if updated_title != exam.title:
            changes["title"] = {"from": exam.title, "to": updated_title}
            exam.title = updated_title

    if payload.exam_date is not None and payload.exam_date != exam.exam_date:
        changes["exam_date"] = {"from": str(exam.exam_date), "to": str(payload.exam_date)}
        exam.exam_date = payload.exam_date

    if payload.duration_minutes is not None and payload.duration_minutes != exam.duration_minutes:
        changes["duration_minutes"] = {"from": exam.duration_minutes, "to": payload.duration_minutes}
        exam.duration_minutes = payload.duration_minutes

    if payload.option_count is not None and payload.option_count != exam.option_count:
        changes["option_count"] = {"from": exam.option_count, "to": payload.option_count}
        exam.option_count = payload.option_count

    if payload.scoring_formula is not None and payload.scoring_formula != exam.scoring_formula:
        changes["scoring_formula"] = {"from": exam.scoring_formula, "to": payload.scoring_formula}
        exam.scoring_formula = payload.scoring_formula

    normalized_questions = validate_builder_questions_payload(payload.questions, exam.option_count)
    sync_exam_questions_from_builder(db, exam, normalized_questions)

    db.add(
        ExamAuditLog(
            exam_id=exam.id,
            actor_user_id=current_user.id,
            action="upsert_builder",
            metadata_json=json.dumps(
                {
                    "changes": changes,
                    "question_count": len(normalized_questions),
                    "complete_question_count": len(extract_complete_builder_questions(normalized_questions, exam.option_count)),
                }
            ),
        )
    )

    db.commit()
    db.refresh(exam)
    builder_questions = read_builder_questions(db, exam)
    return serialize_exam_builder(exam, builder_questions)


@app.patch("/exams/{exam_id}/builder/meta", response_model=ExamBuilderOut)
def update_exam_builder_meta(
    exam_id: str,
    payload: ExamBuilderMetaPatch,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamBuilderOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    ensure_academic_year_is_writable(exam.academic_year)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    changes: dict[str, Any] = {}
    builder_questions = read_builder_questions(db, exam)

    if payload.title is not None:
        updated_title = payload.title.strip()
        if updated_title != exam.title:
            changes["title"] = {"from": exam.title, "to": updated_title}
            exam.title = updated_title

    if payload.exam_date is not None and payload.exam_date != exam.exam_date:
        changes["exam_date"] = {"from": str(exam.exam_date), "to": str(payload.exam_date)}
        exam.exam_date = payload.exam_date

    if payload.duration_minutes is not None and payload.duration_minutes != exam.duration_minutes:
        changes["duration_minutes"] = {"from": exam.duration_minutes, "to": payload.duration_minutes}
        exam.duration_minutes = payload.duration_minutes

    if payload.option_count is not None and payload.option_count != exam.option_count:
        validate_builder_compatibility(builder_questions, payload.option_count)
        changes["option_count"] = {"from": exam.option_count, "to": payload.option_count}
        exam.option_count = payload.option_count
        sync_exam_questions_from_builder(db, exam, builder_questions)

    if payload.scoring_formula is not None and payload.scoring_formula != exam.scoring_formula:
        changes["scoring_formula"] = {"from": exam.scoring_formula, "to": payload.scoring_formula}
        exam.scoring_formula = payload.scoring_formula

    if payload.assigned_student_groups is not None:
        next_groups = [item.strip() for item in payload.assigned_student_groups if item.strip()]
        current_groups = [str(item).strip() for item in _parse_json_list(exam.assigned_student_groups_json, []) if str(item).strip()]
        if next_groups != current_groups:
            changes["assigned_student_groups"] = {"from": current_groups, "to": next_groups}
            exam.assigned_student_groups_json = json.dumps(next_groups)

    if payload.bubble_sheet_config is not None:
        current_config_raw = exam.bubble_sheet_config_json or "{}"
        try:
            current_config = json.loads(current_config_raw)
        except json.JSONDecodeError:
            current_config = {}
        if not isinstance(current_config, dict):
            current_config = {}
        next_config = dict(payload.bubble_sheet_config)
        if next_config != current_config:
            changes["bubble_sheet_config"] = {"from": current_config, "to": next_config}
            exam.bubble_sheet_config_json = json.dumps(next_config)

    if payload.publish_status is not None and payload.publish_status != exam.publish_status:
        changes["publish_status"] = {"from": exam.publish_status, "to": payload.publish_status}
        exam.publish_status = payload.publish_status
        exam.published_at = datetime.now(timezone.utc) if payload.publish_status == "published" else None

    if changes:
        db.add(
            ExamAuditLog(
                exam_id=exam.id,
                actor_user_id=current_user.id,
                action="update_builder_meta",
                metadata_json=json.dumps(changes),
            )
        )

    db.commit()
    db.refresh(exam)
    return serialize_exam_builder(exam, builder_questions)


@app.put("/exams/{exam_id}/builder/questions/{question_id}", response_model=ExamBuilderOut)
def upsert_exam_builder_question(
    exam_id: str,
    question_id: str,
    payload: ExamBuilderQuestionSave,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamBuilderOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    ensure_academic_year_is_writable(exam.academic_year)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    normalized_single = validate_builder_questions_payload([payload.question], exam.option_count)[0]
    route_question_id = question_id.strip()
    if normalized_single["id"] != route_question_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="question_id in route must match payload.question.id",
        )

    builder_questions = read_builder_questions(db, exam)
    existing_index = next(
        (index for index, item in enumerate(builder_questions) if str(item.get("id", "")).strip() == route_question_id),
        None,
    )
    if existing_index is not None:
        builder_questions.pop(existing_index)

    target_index = max(0, payload.question_order - 1)
    if target_index > len(builder_questions):
        target_index = len(builder_questions)
    builder_questions.insert(target_index, normalized_single)

    sync_exam_questions_from_builder(db, exam, builder_questions)

    db.add(
        ExamAuditLog(
            exam_id=exam.id,
            actor_user_id=current_user.id,
            action="upsert_builder_question",
            metadata_json=json.dumps(
                {
                    "question_id": route_question_id,
                    "question_order": payload.question_order,
                }
            ),
        )
    )

    db.commit()
    db.refresh(exam)
    updated_questions = read_builder_questions(db, exam)
    return serialize_exam_builder(exam, updated_questions)


@app.patch("/exams/{exam_id}", response_model=ExamOut)
def update_exam(
    exam_id: str,
    payload: ExamPatch,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    ensure_academic_year_is_writable(exam.academic_year)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    changes: dict[str, Any] = {}

    if payload.title is not None:
        updated_title = payload.title.strip()
        if not updated_title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title is required")
        if updated_title != exam.title:
            changes["title"] = {"from": exam.title, "to": updated_title}
            exam.title = updated_title

    if payload.exam_date is not None and payload.exam_date != exam.exam_date:
        changes["exam_date"] = {"from": str(exam.exam_date), "to": str(payload.exam_date)}
        exam.exam_date = payload.exam_date

    if payload.duration_minutes is not None and payload.duration_minutes != exam.duration_minutes:
        changes["duration_minutes"] = {"from": exam.duration_minutes, "to": payload.duration_minutes}
        exam.duration_minutes = payload.duration_minutes

    if payload.option_count is not None and payload.option_count != exam.option_count:
        builder_questions = read_builder_questions(db, exam)
        validate_builder_compatibility(builder_questions, payload.option_count)
        changes["option_count"] = {"from": exam.option_count, "to": payload.option_count}
        exam.option_count = payload.option_count

    if payload.scoring_formula is not None and payload.scoring_formula != exam.scoring_formula:
        changes["scoring_formula"] = {"from": exam.scoring_formula, "to": payload.scoring_formula}
        exam.scoring_formula = payload.scoring_formula

    if changes:
        db.add(
            ExamAuditLog(
                exam_id=exam.id,
                actor_user_id=current_user.id,
                action="update",
                metadata_json=json.dumps(changes),
            )
        )

    db.commit()
    db.refresh(exam)
    questions = fetch_exam_questions(db, exam.id)
    return serialize_exam(exam, questions)


@app.put("/exams/{exam_id}/questions", response_model=ExamOut)
def upsert_exam_questions(
    exam_id: str,
    payload: ExamQuestionsUpsert,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamOut:
    ensure_request_year_matches_selected(
        db,
        current_user,
        academic_year,
        mismatch_status_code=status.HTTP_404_NOT_FOUND,
    )
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    exam = db.scalar(select(Exam).where(Exam.id == parsed_exam_id))
    if not exam or exam.academic_year != academic_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    ensure_academic_year_is_writable(exam.academic_year)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    validate_questions_payload(payload.questions, exam.option_count)

    existing_builder_questions = read_builder_questions(db, exam)
    existing_builder_map = {str(item.get("id", "")).strip(): item for item in existing_builder_questions}

    next_builder_questions: list[dict[str, Any]] = []
    for question in payload.questions:
        question_key = question.id.strip()
        previous = existing_builder_map.get(question_key) or {}
        options = _default_option_rows(question_key, exam.option_count)
        previous_options = previous.get("options")
        if isinstance(previous_options, list):
            option_map = {
                str(item.get("label", "")).strip(): item
                for item in previous_options
                if isinstance(item, dict)
            }
            for option in options:
                matched = option_map.get(option["label"])
                if matched:
                    option["id"] = str(matched.get("id", option["id"])).strip() or option["id"]
                    option["text"] = str(matched.get("text", "")).strip()

        correct_option_id = next(
            (item["id"] for item in options if item["label"] == question.correct_option),
            None,
        )
        next_builder_questions.append(
            {
                "id": question_key,
                "text": question.text.strip(),
                "options": options,
                "correct_option_id": correct_option_id,
                "points": int(previous.get("points", 10)),
                "difficulty": previous.get("difficulty", "Medium"),
                "bloom_level": previous.get("bloom_level", "Understand"),
                "tags": [str(tag).strip() for tag in previous.get("tags", []) if str(tag).strip()],
            }
        )
    sync_exam_questions_from_builder(db, exam, next_builder_questions)

    db.add(
        ExamAuditLog(
            exam_id=exam.id,
            actor_user_id=current_user.id,
            action="upsert_questions",
            metadata_json=json.dumps({"question_count": len(payload.questions)}),
        )
    )

    db.commit()
    db.refresh(exam)
    questions = fetch_exam_questions(db, exam.id)
    return serialize_exam(exam, questions)


@app.post("/admin/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    payload: UserCreate,
    role: str = "teacher",
    _: User = Depends(require_roles("admin", "school_admin")),
    db: Session = Depends(get_db),
) -> User:
    normalized_role = role.strip().lower()
    if normalized_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing_email = db.scalar(select(User).where(User.email == payload.email))
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = db.scalar(select(User).where(User.username == payload.username))
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        school_name=payload.school_name,
        hashed_password=get_password_hash(payload.password),
        role=normalized_role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    _: User = Depends(require_roles("admin", "school_admin", "analyst")),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    admins = db.scalar(select(func.count(User.id)).where(User.role == "admin")) or 0
    school_admins = db.scalar(select(func.count(User.id)).where(User.role == "school_admin")) or 0
    analysts = db.scalar(select(func.count(User.id)).where(User.role == "analyst")) or 0
    teachers = db.scalar(select(func.count(User.id)).where(User.role == "teacher")) or 0
    students = db.scalar(select(func.count(User.id)).where(User.role == "student")) or 0

    return DashboardSummary(
        total_users=total_users,
        active_users=active_users,
        admins=admins,
        school_admins=school_admins,
        analysts=analysts,
        teachers=teachers,
        students=students,
    )
