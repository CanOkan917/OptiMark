# Backend Architecture

The backend is organized around a small FastAPI composition root and route modules
that delegate shared behavior to application services.

## Module Roles

- `api.py` and `api_app.py`: compatibility entrypoints that expose `app`.
- `app.py`: application factory, CORS configuration, startup bootstrap, router registration.
- `routes/`: HTTP layer only. Routes should parse request data, enforce endpoint dependencies,
  call application services, and return schemas.
- `application_services.py`: compatibility facade for route imports while services are split.
- `services/`: domain-level application services:
  `academic`, `ids`, `courses`, `students`, `exams`, and `sheets`.
- `models.py`: SQLAlchemy persistence models.
- `schemas.py`: Pydantic request and response contracts.
- `database.py`: engine/session setup and startup migrations.
- `deps.py`: FastAPI dependencies for authentication and authorization.
- `security.py`: password hashing and token helpers.

## Maintenance Rules

- Add new endpoints as `APIRouter` handlers under `routes/`; register the router in `app.py`.
- Keep FastAPI app creation out of route modules.
- Avoid wildcard imports in route modules so dependencies stay visible.
- Keep SQLAlchemy table definitions in `models.py` and API contracts in `schemas.py`.
- Put shared business rules and serialization helpers in the matching `services/` module.
- Use `application_services.py` only as a facade while route imports are being migrated.
- Preserve `backend.api:app` as the stable import path for ASGI servers.
