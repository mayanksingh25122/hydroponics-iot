from fastapi import FastAPI

from app.database.connection import engine
from app.routers.sensor import router as sensor_router

app = FastAPI(
    title="Hydroponics Platform API",
    version="1.0.0"
)

app.include_router(sensor_router)


@app.get("/")
def home():
    return {
        "message": "Database Connected Successfully!"
    }