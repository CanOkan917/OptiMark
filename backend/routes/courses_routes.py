from ..api_app import *  # noqa: F401,F403

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
