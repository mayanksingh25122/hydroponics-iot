from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import CORS_ALLOW_ORIGINS
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
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
