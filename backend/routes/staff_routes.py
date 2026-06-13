from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import User
from ..schemas import StaffCreate, StaffListResponse, StaffUpdate, UserOut
from ..security import get_password_hash

router = APIRouter()

STAFF_ROLES = ("admin", "school_admin", "analyst", "teacher")


@router.get("/staff", response_model=StaffListResponse)
def list_staff(
    role: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(require_roles("admin", "school_admin")),
    db: Session = Depends(get_db),
) -> StaffListResponse:
    stmt = select(User).where(User.role.in_(STAFF_ROLES))

    if role:
        normalized = role.strip().lower()
        if normalized not in STAFF_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role filter")
        stmt = stmt.where(User.role == normalized)

    if search and search.strip():
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.full_name).like(like),
                func.lower(User.username).like(like),
                func.lower(User.email).like(like),
            )
        )

    stmt = stmt.order_by(User.created_at.desc())
    users = db.scalars(stmt).all()
    return StaffListResponse(items=[UserOut.model_validate(user) for user in users])


@router.post("/staff", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreate,
    current_user: User = Depends(require_roles("admin", "school_admin")),
    db: Session = Depends(get_db),
) -> User:
    # Only an admin may grant the admin role.
    if payload.role == "admin" and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an admin can create another admin",
        )

    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        school_name=payload.school_name or current_user.school_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/staff/{user_id}", response_model=UserOut)
def update_staff(
    user_id: int,
    payload: StaffUpdate,
    current_user: User = Depends(require_roles("admin", "school_admin")),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None or user.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    # Guard against locking yourself out or self-demotion.
    if user.id == current_user.id and (payload.is_active is False or payload.role is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role or active status",
        )

    if payload.role == "admin" and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an admin can promote a user to admin",
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return user
