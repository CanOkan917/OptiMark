from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Course, CourseTeacher, User
from ..schemas import CourseOut
from .ids import parse_public_id, to_course_public_id, to_teacher_public_id


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


def can_manage_course(current_user: User, course_teacher_user_ids: set[int]) -> bool:
    if current_user.role in {"admin", "school_admin"}:
        return True
    if current_user.role == "teacher" and current_user.id in course_teacher_user_ids:
        return True
    return False
