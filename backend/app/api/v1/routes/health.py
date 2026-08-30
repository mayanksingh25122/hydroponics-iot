from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_v1():
    """Liveness check for the versioned API.

    Confirms the process is up and able to serve requests. Deliberately
    does not touch the database or any other dependency — a DB blip must
    never fail this check and trigger an unnecessary restart. Mirrors the
    unversioned GET /health in app.main, which stays in place for the
    current frontend/ESP32 clients that call it directly.
    """
    return {"status": "ok", "service": "verda-api"}
