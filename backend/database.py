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
    migrate_exams_table()
    migrate_exam_questions_table()
    migrate_exam_sheet_templates_table()
    migrate_exam_submissions_table()


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


def migrate_exams_table() -> None:
    expected_columns = {
        "builder_payload_json": "TEXT",
        "publish_status": "VARCHAR(16) NOT NULL DEFAULT 'draft'",
        "published_at": "TIMESTAMPTZ",
        "assigned_student_groups_json": "TEXT NOT NULL DEFAULT '[]'",
        "bubble_sheet_config_json": "TEXT NOT NULL DEFAULT '{}'",
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = inspector.get_table_names()
        if "exams" not in table_names:
            return

        existing_columns = {col["name"] for col in inspector.get_columns("exams")}
        for column_name, ddl in expected_columns.items():
            if column_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE exams ADD COLUMN {column_name} {ddl}"))


def migrate_exam_questions_table() -> None:
    expected_columns = {
        "options_json": "TEXT NOT NULL DEFAULT '[]'",
        "correct_option_id": "VARCHAR(64)",
        "points": "INTEGER NOT NULL DEFAULT 10",
        "difficulty": "VARCHAR(16) NOT NULL DEFAULT 'Medium'",
        "bloom_level": "VARCHAR(32) NOT NULL DEFAULT 'Understand'",
        "tags_json": "TEXT NOT NULL DEFAULT '[]'",
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = inspector.get_table_names()
        if "exam_questions" not in table_names:
            return

        existing_columns = {col["name"] for col in inspector.get_columns("exam_questions")}
        for column_name, ddl in expected_columns.items():
            if column_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE exam_questions ADD COLUMN {column_name} {ddl}"))

        # Builder autosave can persist incomplete questions, so correct_option must be nullable.
        conn.execute(text("ALTER TABLE exam_questions ALTER COLUMN correct_option DROP NOT NULL"))


def migrate_exam_sheet_templates_table() -> None:
    expected_columns = {
        "template_json": "TEXT NOT NULL",
        "pdf_storage_path": "TEXT NOT NULL",
        "question_count": "INTEGER NOT NULL DEFAULT 0",
        "option_count": "INTEGER NOT NULL DEFAULT 4",
        "generated_by_user_id": "INTEGER",
        "created_at": "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = inspector.get_table_names()
        if "exam_sheet_templates" not in table_names:
            return

        existing_columns = {col["name"] for col in inspector.get_columns("exam_sheet_templates")}
        for column_name, ddl in expected_columns.items():
            if column_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE exam_sheet_templates ADD COLUMN {column_name} {ddl}"))


def migrate_exam_submissions_table() -> None:
    expected_columns = {
        "status": "VARCHAR(16) NOT NULL DEFAULT 'submitted'",
        "score": "INTEGER",
        "submitted_at": "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "graded_at": "TIMESTAMPTZ",
        "created_at": "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "updated_at": "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    }
    expected_indexes = {
        "ix_exam_submissions_exam_id": "CREATE INDEX IF NOT EXISTS ix_exam_submissions_exam_id ON exam_submissions (exam_id)",
        "ix_exam_submissions_student_id": "CREATE INDEX IF NOT EXISTS ix_exam_submissions_student_id ON exam_submissions (student_id)",
        "ix_exam_submissions_status": "CREATE INDEX IF NOT EXISTS ix_exam_submissions_status ON exam_submissions (status)",
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = inspector.get_table_names()
        if "exam_submissions" not in table_names:
            return

        existing_columns = {col["name"] for col in inspector.get_columns("exam_submissions")}
        for column_name, ddl in expected_columns.items():
            if column_name not in existing_columns:
                conn.execute(text(f"ALTER TABLE exam_submissions ADD COLUMN {column_name} {ddl}"))

        for _, index_sql in expected_indexes.items():
            conn.execute(text(index_sql))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
