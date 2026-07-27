from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schema.sensor import SensorData
from app.services.sensor_service import save_sensor_data

router = APIRouter()


@router.post("/sensor-data")
def receive_sensor_data(
    data: SensorData,
    db: Session = Depends(get_db)
):
    reading = save_sensor_data(db, data)

    return {
        "status": "success",
        "id": reading.id,
        "message": "Sensor data saved successfully!"
    }