from ..api_app import *  # noqa: F401,F403

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

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
