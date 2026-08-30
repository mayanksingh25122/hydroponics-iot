from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.v1.routes.auth import get_current_user
from app.database.session import get_db
from app.models.device import Device
from app.models.sensor_reading import SensorReading
from app.models.user import User
from app.schema.device import PumpCommand, PumpModeCommand, QueuedCommandResponse
from app.services import command_service
from app.settings import DEVICE_ONLINE_TIMEOUT_SECONDS

router = APIRouter(prefix="/api/devices", tags=["devices"])


def _device_or_error(device_id: int, db: Session) -> Device | None:
    return db.query(Device).filter(Device.id == device_id).first()


def _error(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "message": message})


def _is_device_online(device: Device) -> bool:
    """Whether `device` has made real inbound contact (telemetry POST,
    command poll, or command ack — see command_service.touch_device_
    last_seen) within DEVICE_ONLINE_TIMEOUT_SECONDS.

    This replaces the old, direct-HTTP "ask the ESP32 right now" check,
    which cannot work for a cloud-hosted backend and a device on a
    private LAN — see the approved outbound-only architecture. It is
    necessarily an approximation (a device could be reachable this
    instant and simply not due to poll/report yet, or vice versa), not
    a live guarantee, which is exactly why it is timeout-based rather
    than synchronous.
    """
    if device.last_seen_at is None:
        return False
    age = datetime.now(timezone.utc) - device.last_seen_at
    return age.total_seconds() <= DEVICE_ONLINE_TIMEOUT_SECONDS


@router.get("/{device_id}/status")
def get_device_status(device_id: int, db: Session = Depends(get_db)):
    """Device status derived entirely from data the backend already has
    — no request to the ESP32 is made (the backend cannot reach a
    device on a private LAN; see the approved outbound-only
    architecture). Response field names are unchanged from before, for
    frontend compatibility (frontend/src/types/sensor.ts's DeviceStatus
    is untouched):

      pump           <- the most recent telemetry upload's pump_status
                        (app.models.sensor_reading.SensorReading),
                        False if no telemetry has ever been received.
      manualOverride <- the most recently ACKNOWLEDGED pump_mode
                        command's applied_manual_override (never a
                        still-pending/undelivered one — an unconfirmed
                        request is not "current state"), False if no
                        pump_mode command has ever been acknowledged.
      wifi           <- last_seen_at-based recency (_is_device_online),
                        not a live WiFi query. The field name is kept
                        for frontend compatibility
                        (frontend/src/lib/deviceHealth.ts reads
                        status.wifi); its *meaning* has changed from "the
                        ESP32 just reported its WiFi state live" to "the
                        device has been in contact recently."
    """
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    latest_reading = (
        db.query(SensorReading)
        .filter(SensorReading.device_id == device_id)
        .order_by(SensorReading.id.desc())
        .first()
    )
    pump_state = bool(latest_reading.pump_status) if latest_reading is not None else False

    latest_mode_command = command_service.get_latest_acknowledged_command(
        db, device_id, "pump_mode"
    )
    manual_override = bool(
        latest_mode_command is not None and latest_mode_command.applied_manual_override
    )

    return {
        "success": True,
        "device_id": device_id,
        "pump": pump_state,
        "manualOverride": manual_override,
        "wifi": _is_device_online(device),
    }


@router.post("/{device_id}/pump", response_model=QueuedCommandResponse)
def set_pump(
    device_id: int,
    command: PumpCommand,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Queues a pump on/off request — does NOT contact the ESP32.
    Authentication is unchanged: get_current_user (session cookie),
    same as before this task. The device applies the command later,
    through its own poll of GET /api/v1/devices/{id}/commands, subject
    to firmware's own safety logic — this endpoint has no way to know
    or claim the outcome, so it never says the pump turned on or off,
    only that the request was accepted and queued.
    """
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    new_command = command_service.create_pump_state_command(
        db,
        device_id=device_id,
        requested_by_user_id=user.id,
        requested_pump_state=command.state,
    )

    return QueuedCommandResponse(
        success=True,
        device_id=device_id,
        status="queued",
        command_id=new_command.id,
        message="Pump command queued",
    )


@router.post("/{device_id}/pump/mode", response_model=QueuedCommandResponse)
def set_pump_mode(
    device_id: int,
    command: PumpModeCommand,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Queues an auto/manual mode request — does NOT contact the ESP32.
    Same authentication (get_current_user) and same "queued, not
    applied" contract as set_pump above.
    """
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    new_command = command_service.create_pump_mode_command(
        db,
        device_id=device_id,
        requested_by_user_id=user.id,
        requested_manual_override=command.mode == "manual",
    )

    return QueuedCommandResponse(
        success=True,
        device_id=device_id,
        status="queued",
        command_id=new_command.id,
        message="Pump mode command queued",
    )
