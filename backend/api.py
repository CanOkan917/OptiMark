from datetime import datetime, timezone
import os

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import SessionLocal, get_db, init_db
from .deps import get_current_user, require_roles
from .models import User
from .schemas import DashboardSummary, TokenResponse, UserCreate, UserLogin, UserOut
from .security import create_access_token, get_password_hash, verify_password
from .seed import ensure_default_admin

VALID_ROLES = {"admin", "school_admin", "analyst", "teacher", "student"}

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
