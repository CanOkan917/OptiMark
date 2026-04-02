from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import os
import secrets
from typing import Any

from jose import JWTError, jwt

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
PBKDF2_ITERATIONS = int(os.getenv("PBKDF2_ITERATIONS", "210000"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        _, iterations_str, salt_b64, digest_b64 = hashed_password.split("$", 3)
        iterations = int(iterations_str)
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        expected_digest = base64.b64decode(digest_b64.encode("utf-8"))
    except (ValueError, TypeError):
        return False

    calculated_digest = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(calculated_digest, expected_digest)


def get_password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PBKDF2_ITERATIONS}$"
        f"{base64.b64encode(salt).decode('utf-8')}$"
        f"{base64.b64encode(digest).decode('utf-8')}"
    )


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expire_minutes = expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    payload: dict[str, Any] = {"sub": subject}
    return create_token(payload, expires_minutes=expire_minutes)


def create_token(payload: dict[str, Any], expires_minutes: int | None = None) -> str:
    expire_minutes = expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    token_payload = dict(payload)
    token_payload["exp"] = expire_at
    return jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token_payload(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    return payload if isinstance(payload, dict) else None


def decode_token(token: str) -> str | None:
    payload = decode_token_payload(token)
    if payload is None:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None
