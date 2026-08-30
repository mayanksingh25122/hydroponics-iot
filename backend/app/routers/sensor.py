import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sensor_reading import SensorReading
from app.schema.sensor import SensorData
from app.services.sensor_service import UnknownDeviceError, save_sensor_data
from app.settings import BACKEND_API_KEY

router = APIRouter()


def require_device_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Authenticates the ESP32 itself to the backend for telemetry
    ingestion. Missing/incorrect key -> 401.

    This is the device's own credential — generated and known only to
    the backend and the physical ESP32, never sent to or stored by the
    frontend. Moved here from app.routers.device (where it was
    previously, incorrectly, applied to browser-facing pump-control
    routes that the frontend could never actually satisfy, since it
    never sent this header). Those routes now use the session-cookie
    based get_current_user instead — see app.routers.device.

    Uses secrets.compare_digest for a constant-time comparison; never
    includes the expected key in the response or in any log output.
    """
    if x_api_key is None or not secrets.compare_digest(x_api_key, BACKEND_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ============================================
# ESP32 Upload Endpoint
# ============================================

@router.post("/sensor-data", dependencies=[Depends(require_device_api_key)])
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
