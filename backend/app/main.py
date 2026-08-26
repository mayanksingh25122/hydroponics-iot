from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import CORS_ALLOW_ORIGINS
from app.routers.sensor import router as sensor_router
from app.routers.device import router as device_router

cors_origins = [
    origin.strip()
    for origin in CORS_ALLOW_ORIGINS.split(",")
    if origin.strip()
]

app = FastAPI(
    title="Hydroponics Platform API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensor_router)
app.include_router(device_router)


@app.get("/")
def home():
    return {
        "message": "Database Connected Successfully!"
    }
