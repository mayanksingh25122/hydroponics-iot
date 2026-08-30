"""Aggregates every /api/v1 route into one router, mounted once in app.main.

Additive only: the existing unversioned routers (app.routers.sensor,
app.routers.device) are untouched by this module and keep serving the
current frontend and ESP32 firmware exactly as before — neither one calls
any /api/v1 path today. New endpoints (telemetry, devices, commands) land
under this prefix as they're built; this task adds only /api/v1/health.
"""

from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router

router = APIRouter(prefix="/api/v1")

router.include_router(health_router)
