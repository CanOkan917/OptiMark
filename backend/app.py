import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import SessionLocal, init_db
from .routes.core_routes import router as core_router
from .routes.courses_routes import router as courses_router
from .routes.exams_routes import router as exams_router
from .routes.scans_routes import router as scans_router
from .routes.staff_routes import router as staff_router
from .routes.students_routes import router as students_router
from .seed import ensure_default_admin


def get_allowed_origins() -> list[str]:
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    extra_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return list(dict.fromkeys(default_origins + extra_origins))


def create_app() -> FastAPI:
    app = FastAPI(title="OptiMark API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        with SessionLocal() as db:
            ensure_default_admin(db)

    app.include_router(core_router)
    app.include_router(courses_router)
    app.include_router(students_router)
    app.include_router(exams_router)
    app.include_router(scans_router)
    app.include_router(staff_router)

    return app
