from .database import SessionLocal, init_db
from .seed import ensure_default_admin


if __name__ == "__main__":
    init_db()
    with SessionLocal() as db:
        ensure_default_admin(db)
    print("Database initialized successfully.")
