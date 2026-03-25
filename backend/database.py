import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/optimark-v1",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    migrate_users_table()


def migrate_users_table() -> None:
    expected_columns = {
        "school_name": "VARCHAR(160)",
        "role": "VARCHAR(32) NOT NULL DEFAULT 'teacher'",
    }
    expected_indexes = {
        "ix_users_role": "CREATE INDEX IF NOT EXISTS ix_users_role ON users (role)",
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = inspector.get_table_names()
        if "users" not in table_names:
            return

        existing_columns = {col["name"] for col in inspector.get_columns("users")}
        for column_name, ddl in expected_columns.items():
            if column_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))

        for _, index_sql in expected_indexes.items():
            conn.execute(text(index_sql))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
