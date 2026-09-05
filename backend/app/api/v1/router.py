"""Aggregates every /api/v1 route into one router, mounted once in app.main.

Additive only: the existing unversioned routers (app.routers.sensor,
app.routers.device) are untouched by this module and keep serving the
current frontend and ESP32 firmware exactly as before — neither one calls
any /api/v1 path today. New endpoints (telemetry, devices, commands) land
under this prefix as they're built; this task adds /api/v1/health,
/api/v1/auth/{login,register,me,logout},
/api/v1/admin/users/{,{id}/approve,{id}/disable} (admin-only account
approval), and /api/v1/devices/{id}/commands (the ESP32 command-polling
and acknowledgement API).
"""

from fastapi import APIRouter

from app.api.v1.routes.admin import router as admin_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.device_commands import router as device_commands_router
from app.api.v1.routes.health import router as health_router

router = APIRouter(prefix="/api/v1")

router.include_router(health_router)
router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(device_commands_router)
