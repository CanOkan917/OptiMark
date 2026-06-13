from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import Student, StudentGroup, StudentGroupMembership, StudentImportJob
from ..schemas import StudentGroupOut, StudentImportJobOut, StudentOut
from .ids import (
    parse_public_id,
    to_student_group_public_id,
    to_student_import_job_public_id,
    to_student_public_id,
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
