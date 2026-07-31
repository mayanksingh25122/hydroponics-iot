from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.sensor import router as sensor_router
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(
    title="Hydroponics Platform API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Change to your frontend domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensor_router)


@app.get("/")
def home():
    return {
        "message": "Database Connected Successfully!"
    }