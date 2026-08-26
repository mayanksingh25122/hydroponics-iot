import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.device import Device
from app.schema.device import PumpCommand, PumpModeCommand
from app.services.device_service import DeviceCommunicationError, request_device_json
from app.settings import BACKEND_API_KEY

router = APIRouter(prefix="/api/devices", tags=["devices"])


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Protects device-actuation routes only. Missing/incorrect key -> 401.

    Uses secrets.compare_digest for a constant-time comparison; never
    includes the expected key in the response or in any log output.
    """
    if x_api_key is None or not secrets.compare_digest(x_api_key, BACKEND_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


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


@router.post("/{device_id}/pump", dependencies=[Depends(require_api_key)])
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


@router.post("/{device_id}/pump/mode", dependencies=[Depends(require_api_key)])
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
