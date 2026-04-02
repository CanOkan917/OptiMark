from ..api_app import *  # noqa: F401,F403

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
