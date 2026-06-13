from datetime import datetime, timezone
import re

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User, UserPreference


VALID_ROLES = {"admin", "school_admin", "analyst", "teacher", "student"}
ACADEMIC_YEAR_REGEX = re.compile(r"^\d{4}-\d{4}$")


def build_academic_year_options(now: datetime | None = None, count: int = 3) -> list[str]:
    now = now or datetime.now(timezone.utc)
    start_year = now.year
    return [f"{start_year - index}-{start_year - index + 1}" for index in range(count)]


def get_default_academic_year() -> str:
    now = datetime.now(timezone.utc)
    current_start_year = now.year if now.month >= 9 else now.year - 1
    return f"{current_start_year}-{current_start_year + 1}"


def academic_year_start_year(value: str) -> int:
    validate_academic_year(value)
    return int(value.split("-")[0])


def get_selected_academic_year_for_user(db: Session, current_user: User) -> str:
    preference = db.scalar(select(UserPreference).where(UserPreference.user_id == current_user.id))
    if preference:
        return preference.selected_academic_year
    return get_default_academic_year()


def ensure_request_year_matches_selected(
    db: Session,
    current_user: User,
    academic_year: str,
    *,
    mismatch_status_code: int = status.HTTP_400_BAD_REQUEST,
) -> str:
    validate_academic_year(academic_year)
    selected_academic_year = get_selected_academic_year_for_user(db, current_user)
    if academic_year != selected_academic_year:
        detail = "Resource not found" if mismatch_status_code == status.HTTP_404_NOT_FOUND else "academic_year does not match selected academic year"
        raise HTTPException(status_code=mismatch_status_code, detail=detail)
    return selected_academic_year


def ensure_academic_year_is_writable(academic_year: str) -> None:
    current_start_year = academic_year_start_year(get_default_academic_year())
    target_start_year = academic_year_start_year(academic_year)
    if target_start_year < current_start_year:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Past academic years are archived and read-only",
        )


def validate_academic_year(value: str) -> str:
    if not ACADEMIC_YEAR_REGEX.match(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic_year")
    return value
