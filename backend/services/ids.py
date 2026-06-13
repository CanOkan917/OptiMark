from fastapi import HTTPException, status


def to_teacher_public_id(user_id: int) -> str:
    return f"t{user_id}"


def to_course_public_id(course_id: int) -> str:
    return f"c{course_id}"


def to_exam_public_id(exam_id: int) -> str:
    return f"e{exam_id}"


def to_exam_sheet_template_public_id(template_id: int) -> str:
    return f"sht{template_id}"


def to_scan_job_public_id(scan_job_id: int) -> str:
    return f"scn{scan_job_id}"


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
