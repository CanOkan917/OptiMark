import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import User
from .security import get_password_hash


def ensure_default_admin(db: Session) -> None:
    user_exists = db.scalar(select(User.id).limit(1))
    if user_exists:
        return

    admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@okancore.com")
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin12345!")
    admin_full_name = os.getenv("DEFAULT_ADMIN_FULL_NAME", "System Admin")
    admin_school_name = os.getenv("DEFAULT_ADMIN_SCHOOL", "OptiMark Demo School")

    admin_user = User(
        email=admin_email,
        username=admin_username,
        full_name=admin_full_name,
        school_name=admin_school_name,
        hashed_password=get_password_hash(admin_password),
        role="admin",
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )
    db.add(admin_user)
    db.commit()
