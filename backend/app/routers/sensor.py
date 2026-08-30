from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sensor_reading import SensorReading
from app.schema.sensor import SensorData
from app.services.sensor_service import UnknownDeviceError, save_sensor_data

router = APIRouter()


# ============================================
# ESP32 Upload Endpoint
# ============================================

@router.post("/sensor-data")
def receive_sensor_data(
    data: SensorData,
    db: Session = Depends(get_db)
):
    try:
        reading = save_sensor_data(db, data)
    except UnknownDeviceError:
        # Matches app.routers.device's existing error shape for consistency.
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Unknown device"},
        )

    return {
        "status": "success",
        "id": reading.id,
        "message": "Sensor data saved successfully!"
    }


# ============================================
# Latest Reading
# ============================================

@router.get("/api/sensors/latest")
def latest_sensor(
    db: Session = Depends(get_db)
):
    reading = (
        db.query(SensorReading)
        .order_by(SensorReading.id.desc())
        .first()
    )

    if reading is None:
        return {}

    return {
        "id": reading.id,
        "device_id": reading.device_id,
        "ph": reading.ph,
        "tds": reading.tds,
        "ec": reading.ec,
        "water_temperature": reading.water_temperature,
        "water_level": reading.water_level,
        "pump_status": reading.pump_status,
        "buzzer_status": reading.buzzer_status,
        "timestamp": reading.timestamp
    }


# ============================================
# History
# ============================================

@router.get("/api/sensors/history")
def sensor_history(
    db: Session = Depends(get_db)
):
    readings = (
        db.query(SensorReading)
        .order_by(SensorReading.id.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": r.id,
            "device_id": r.device_id,
            "ph": r.ph,
            "tds": r.tds,
            "ec": r.ec,
            "water_temperature": r.water_temperature,
            "water_level": r.water_level,
            "pump_status": r.pump_status,
            "buzzer_status": r.buzzer_status,
            "timestamp": r.timestamp
        }
        for r in readings
    ]
