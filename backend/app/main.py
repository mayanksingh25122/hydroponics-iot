from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.settings import CORS_ALLOW_ORIGINS
from app.rate_limit import limiter
from app.api.v1.router import router as api_v1_router
from app.routers.sensor import router as sensor_router
from app.routers.device import router as device_router

cors_origins = [
    origin.strip()
    for origin in CORS_ALLOW_ORIGINS.split(",")
    if origin.strip()
]

app = FastAPI(
    title="VERDA Hydroponics Platform API",
    description="Backend API for the VERDA hydroponics/agriculture platform.",
    version="1.0.0",
)

# Rate limiting for the two unauthenticated authentication endpoints
# (POST /api/v1/auth/register, POST /api/v1/auth/login — see the
# @limiter.limit(...) decorators on those routes in
# app.api.v1.routes.auth). app.state.limiter and this exception handler
# are the two pieces slowapi requires at the app level; SlowAPIMiddleware
# additionally attaches X-RateLimit-* headers to every response. See
# app.rate_limit's module docstring for why it deliberately never
# trusts X-Forwarded-For (Render does not sanitize it before
# appending), and for the one accepted, documented tradeoff that
# follows from that (in-memory storage assumes a single backend
# instance; behind Render's edge, distinct clients can share an
# apparent identity, making these limits closer to global than
# per-user — the safe failure direction, not a bypass).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# allow_credentials=True is required for the browser to send the
# verda_session httpOnly cookie (app.api.v1.routes.auth) on
# cross-origin requests — e.g. frontend on :5173, backend on :8000.
# This is only safe because allow_origins is always an explicit list
# from CORS_ALLOW_ORIGINS, never "*" — the CORS spec (and browsers)
# reject wildcard origins combined with credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def home():
    return {
        "service": "verda-api",
        "status": "running",
    }


# Versioned API — new endpoints (telemetry, devices, commands, ...) land
# under /api/v1 going forward. Currently exposes only /api/v1/health.
app.include_router(api_v1_router)

# Legacy unversioned routes — unchanged. Both the current frontend
# (frontend/src/services/sensorService.ts) and the ESP32 firmware's
# hardcoded /sensor-data URL call these paths directly, so they stay
# mounted exactly as before.
app.include_router(sensor_router)
app.include_router(device_router)
