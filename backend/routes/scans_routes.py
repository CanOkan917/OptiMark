from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..application_services import (
    can_manage_course,
    create_scan_job,
    dispatch_scan_job,
    ensure_request_year_matches_selected,
    parse_public_id,
    serialize_scan_job,
    serialize_scan_job_result,
    to_exam_public_id,
    to_scan_job_public_id,
)
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import CourseTeacher, Exam, ExamSheetTemplate, ScanJob, User
from ..schemas import (
    RecentScanItem,
    RecentScansResponse,
    ScanJobOut,
    ScanJobResultOut,
    ScanJobsResponse,
)

router = APIRouter()


def _load_exam_for_user(
    db: Session, current_user: User, exam_id: str, academic_year: str
) -> Exam:
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
    return exam


def _load_scan_job_for_user(
    db: Session, current_user: User, scan_id: str, academic_year: str
) -> ScanJob:
    parsed_id = parse_public_id(scan_id, "scn", "scan_id")
    job = db.get(ScanJob, parsed_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found")
    # Ownership is enforced through the parent exam's access rules.
    exam = db.get(Exam, job.exam_id)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found")
    _load_exam_for_user(db, current_user, f"e{exam.id}", academic_year)
    return job


@router.post(
    "/exams/{exam_id}/scans",
    response_model=ScanJobOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_scan(
    exam_id: str,
    academic_year: str = Form(...),
    file: UploadFile = File(...),
    sheet_template_id: str | None = Form(default=None),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ScanJobOut:
    exam = _load_exam_for_user(db, current_user, exam_id, academic_year)

    parsed_template_id: int | None = None
    if sheet_template_id:
        parsed_template_id = parse_public_id(sheet_template_id, "sht", "sheet_template_id")
        template = db.get(ExamSheetTemplate, parsed_template_id)
        if template is None or template.exam_id != exam.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Sheet template not found"
            )

    data = file.file.read()
    job = create_scan_job(
        db,
        exam,
        original_filename=file.filename or "sheet",
        content_type=file.content_type,
        data=data,
        sheet_template_id=parsed_template_id,
        created_by_user_id=current_user.id,
    )
    dispatch_scan_job(job, db)
    return serialize_scan_job(job)


@router.get("/exams/{exam_id}/scans", response_model=ScanJobsResponse)
def list_scans(
    exam_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScanJobsResponse:
    exam = _load_exam_for_user(db, current_user, exam_id, academic_year)
    jobs = db.scalars(
        select(ScanJob).where(ScanJob.exam_id == exam.id).order_by(ScanJob.created_at.desc())
    ).all()
    return ScanJobsResponse(items=[serialize_scan_job(job) for job in jobs])


@router.get("/scans/{scan_id}", response_model=ScanJobResultOut)
def get_scan(
    scan_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScanJobResultOut:
    job = _load_scan_job_for_user(db, current_user, scan_id, academic_year)
    return serialize_scan_job_result(job)


@router.get("/scans/{scan_id}/overlay")
def get_scan_overlay(
    scan_id: str,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    job = _load_scan_job_for_user(db, current_user, scan_id, academic_year)
    if not job.overlay_storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overlay not available")
    overlay_path = Path(job.overlay_storage_path)
    if not overlay_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overlay not available")
    return FileResponse(overlay_path, media_type="image/png", filename=f"{scan_id}_overlay.png")


@router.get("/dashboard/recent-scans", response_model=RecentScansResponse)
def recent_scans(
    limit: int = Query(default=8, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecentScansResponse:
    stmt = select(ScanJob, Exam).join(Exam, ScanJob.exam_id == Exam.id)

    # Admins/analysts see everything; teachers only see their own courses' scans.
    if current_user.role not in {"admin", "school_admin", "analyst"}:
        course_ids = select(CourseTeacher.course_id).where(
            CourseTeacher.teacher_user_id == current_user.id
        )
        stmt = stmt.where(Exam.course_id.in_(course_ids))

    stmt = stmt.order_by(ScanJob.created_at.desc()).limit(limit)
    rows = db.execute(stmt).all()

    items = [
        RecentScanItem(
            id=to_scan_job_public_id(job.id),
            exam_id=to_exam_public_id(exam.id),
            exam_title=exam.title,
            original_filename=job.original_filename,
            status=job.status,
            score=job.score,
            max_score=job.max_score,
            detected_student_no=job.detected_student_no,
            created_at=job.created_at,
        )
        for job, exam in rows
    ]
    return RecentScansResponse(items=items)
