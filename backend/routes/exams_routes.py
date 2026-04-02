from ..api_app import *  # noqa: F401,F403

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
    ensure_exam_builder_is_editable(exam)

    course_teacher_user_ids = set(
        db.scalars(
            select(CourseTeacher.teacher_user_id).where(CourseTeacher.course_id == exam.course_id)
        ).all()
    )
    if not can_manage_course(current_user, course_teacher_user_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    builder_questions = read_builder_questions(db, exam)
    return serialize_exam_builder(exam, builder_questions)

@app.post("/exams/{exam_id}/publish", response_model=ExamOut)
def publish_exam(
    exam_id: str,
    payload: ExamPublishPayload,
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

    # Validate that selected groups exist in the same academic year.
    validate_group_ids_for_year(db, exam.academic_year, payload.assigned_student_groups)

    changes: dict[str, Any] = {}
    updated_title = payload.title.strip()
    if updated_title != exam.title:
        changes["title"] = {"from": exam.title, "to": updated_title}
        exam.title = updated_title

    if payload.exam_date != exam.exam_date:
        changes["exam_date"] = {"from": str(exam.exam_date), "to": str(payload.exam_date)}
        exam.exam_date = payload.exam_date

    if payload.duration_minutes != exam.duration_minutes:
        changes["duration_minutes"] = {"from": exam.duration_minutes, "to": payload.duration_minutes}
        exam.duration_minutes = payload.duration_minutes

    if payload.scoring_formula != exam.scoring_formula:
        changes["scoring_formula"] = {"from": exam.scoring_formula, "to": payload.scoring_formula}
        exam.scoring_formula = payload.scoring_formula

    next_groups = [item.strip() for item in payload.assigned_student_groups if item.strip()]
    current_groups = [str(item).strip() for item in _parse_json_list(exam.assigned_student_groups_json, []) if str(item).strip()]
    if next_groups != current_groups:
        changes["assigned_student_groups"] = {"from": current_groups, "to": next_groups}
        exam.assigned_student_groups_json = json.dumps(next_groups)

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

    if exam.publish_status != "published":
        changes["publish_status"] = {"from": exam.publish_status, "to": "published"}
    exam.publish_status = "published"
    exam.published_at = datetime.now(timezone.utc)

    db.add(
        ExamAuditLog(
            exam_id=exam.id,
            actor_user_id=current_user.id,
            action="publish",
            metadata_json=json.dumps(changes),
        )
    )
    db.commit()
    db.refresh(exam)
    questions = fetch_exam_questions(db, exam.id)
    return serialize_exam(exam, questions)

@app.get("/exams/{exam_id}/overview", response_model=ExamOverviewOut)
def get_exam_overview(
    exam_id: str,
    request: Request,
    academic_year: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExamOverviewOut:
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

    questions = fetch_exam_questions(db, exam.id)
    exam_out = serialize_exam(exam, questions)

    templates = db.scalars(
        select(ExamSheetTemplate)
        .where(ExamSheetTemplate.exam_id == exam.id)
        .order_by(ExamSheetTemplate.created_at.desc())
    ).all()
    template_items = [
        serialize_exam_sheet_template(
            template,
            exam,
            build_sheet_template_download_url(request, exam, template),
        )
        for template in templates
    ]

    return ExamOverviewOut(
        exam=exam_out,
        sheet_templates=template_items,
        metrics=build_exam_overview_metrics(db, exam),
    )

@app.post("/exams/{exam_id}/sheet-generation", response_model=ExamSheetGenerationOut, status_code=status.HTTP_201_CREATED)
def generate_exam_sheet(
    exam_id: str,
    request: Request,
    academic_year: str = Query(...),
    current_user: User = Depends(require_roles("admin", "school_admin", "teacher")),
    db: Session = Depends(get_db),
) -> ExamSheetGenerationOut:
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

    builder_questions = read_builder_questions(db, exam)
    question_count = len(builder_questions)
    if question_count < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam must contain at least one question before generating a sheet",
        )

    pdf_storage_path, template_json = generate_sheet_artifacts_for_exam(
        exam,
        question_count=question_count,
        option_count=exam.option_count,
    )

    sheet_template = ExamSheetTemplate(
        exam_id=exam.id,
        template_json=template_json,
        pdf_storage_path=pdf_storage_path,
        question_count=question_count,
        option_count=exam.option_count,
        generated_by_user_id=current_user.id,
    )
    db.add(sheet_template)
    db.flush()

    exam.bubble_sheet_generated = True

    download_token = create_token(
        {
            "purpose": DOWNLOAD_TOKEN_PURPOSE,
            "exam_id": exam.id,
            "template_id": sheet_template.id,
        },
        expires_minutes=DOWNLOAD_TOKEN_EXPIRE_MINUTES,
    )
    template_public_id = to_exam_sheet_template_public_id(sheet_template.id)
    download_url = build_exam_sheet_download_url(
        request=request,
        exam_public_id=to_exam_public_id(exam.id),
        template_public_id=template_public_id,
        download_token=download_token,
    )

    db.add(
        ExamAuditLog(
            exam_id=exam.id,
            actor_user_id=current_user.id,
            action="generate_sheet_template",
            metadata_json=json.dumps(
                {
                    "sheet_template_id": template_public_id,
                    "question_count": question_count,
                    "option_count": exam.option_count,
                    "download_link_expire_minutes": DOWNLOAD_TOKEN_EXPIRE_MINUTES,
                }
            ),
        )
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        Path(pdf_storage_path).unlink(missing_ok=True)
        raise

    db.refresh(exam)
    db.refresh(sheet_template)
    return serialize_exam_sheet_generation(sheet_template, exam, download_url)

@app.get("/exams/{exam_id}/sheet-templates/{template_id}/download")
def download_exam_sheet_template_pdf(
    exam_id: str,
    template_id: str,
    token: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> FileResponse:
    parsed_exam_id = parse_public_id(exam_id, "e", "exam_id")
    parsed_template_id = parse_public_id(template_id, "sht", "template_id")

    token_payload = decode_token_payload(token)
    if not token_payload or token_payload.get("purpose") != DOWNLOAD_TOKEN_PURPOSE:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid download token")

    token_exam_id = parse_int_claim(token_payload.get("exam_id"))
    token_template_id = parse_int_claim(token_payload.get("template_id"))
    if token_exam_id is None or token_template_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid download token")

    if token_exam_id != parsed_exam_id or token_template_id != parsed_template_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Download token does not match resource")

    sheet_template = db.scalar(
        select(ExamSheetTemplate).where(
            ExamSheetTemplate.id == parsed_template_id,
            ExamSheetTemplate.exam_id == parsed_exam_id,
        )
    )
    if not sheet_template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sheet template not found")

    pdf_path = Path(sheet_template.pdf_storage_path)
    if not pdf_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated PDF file not found")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=pdf_path.name,
    )

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
    ensure_exam_builder_is_editable(exam)
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
    ensure_exam_builder_is_editable(exam)
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
    ensure_exam_builder_is_editable(exam)
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
