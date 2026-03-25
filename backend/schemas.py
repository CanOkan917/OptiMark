from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64)
    full_name: str | None = Field(default=None, max_length=120)
    school_name: str | None = Field(default=None, max_length=160)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    full_name: str | None
    role: str
    school_name: str | None
    is_active: bool
    is_superuser: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None


class DashboardSummary(BaseModel):
    total_users: int
    active_users: int
    admins: int
    school_admins: int
    analysts: int
    teachers: int
    students: int
