from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.v1.routes.auth import get_current_user
from app.database.session import get_db
from app.models.device import Device
from app.schema.device import PumpCommand, PumpModeCommand
from app.services.device_service import DeviceCommunicationError, request_device_json

router = APIRouter(prefix="/api/devices", tags=["devices"])


def _device_or_error(device_id: int, db: Session) -> Device | None:
    return db.query(Device).filter(Device.id == device_id).first()


def _error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "message": message})


@router.get("/{device_id}/status")
def get_device_status(device_id: int, db: Session = Depends(get_db)):
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    try:
        status = request_device_json(device_id, "/status")
    except DeviceCommunicationError as exc:
        return _error(str(exc), 503)

    return {
        "success": True,
        "device_id": device_id,
        "pump": bool(status.get("pump", False)),
        "manualOverride": bool(status.get("manualOverride", False)),
        "wifi": bool(status.get("wifi", False)),
    }


@router.post("/{device_id}/pump", dependencies=[Depends(get_current_user)])
def set_pump(device_id: int, command: PumpCommand, db: Session = Depends(get_db)):
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    try:
        result = request_device_json(device_id, "/pump", {"state": command.state})
    except DeviceCommunicationError as exc:
        return _error(str(exc), 503)

    if result.get("success") is not True or not isinstance(result.get("state"), bool):
        return _error("ESP32 rejected the pump command", 502)

    return {
        "success": True,
        "device_id": device_id,
        "pump": result["state"],
        "message": "Pump command confirmed by device",
    }


@router.post("/{device_id}/pump/mode", dependencies=[Depends(get_current_user)])
def set_pump_mode(device_id: int, command: PumpModeCommand, db: Session = Depends(get_db)):
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    try:
        result = request_device_json(
            device_id,
            "/pump/mode",
            {"manualOverride": command.mode == "manual"},
        )
    except DeviceCommunicationError as exc:
        return _error(str(exc), 503)

    if result.get("success") is not True:
        return _error("ESP32 rejected the pump mode command", 502)

    return {
        "success": True,
        "device_id": device_id,
        "pump": bool(result.get("pump", False)),
        "manualOverride": bool(result.get("manualOverride", False)),
        "message": "Pump mode confirmed by device",
    }
