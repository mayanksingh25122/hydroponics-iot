from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.device import Device
from app.routers.sensor import require_device_api_key
from app.schema.device_command import CommandAckRequest, CommandListResponse, CommandOut
from app.services import command_service

router = APIRouter(prefix="/devices", tags=["device-commands"])


def _error(message: str, status_code: int) -> JSONResponse:
    # Same {"success": False, "message": ...} shape used by
    # app.routers.device and app.routers.sensor, for one consistent
    # error contract across the whole API surface.
    return JSONResponse(status_code=status_code, content={"success": False, "message": message})


def _device_or_error(device_id: int, db: Session) -> Device | None:
    return db.query(Device).filter(Device.id == device_id).first()


def _to_command_out(command) -> CommandOut:
    return CommandOut(
        id=command.id,
        command_type=command.command_type,
        requested_pump_state=command.requested_pump_state,
        requested_manual_override=command.requested_manual_override,
        created_at=command.created_at,
        expires_at=command.expires_at,
    )


@router.get(
    "/{device_id}/commands",
    response_model=CommandListResponse,
    dependencies=[Depends(require_device_api_key)],
)
def poll_commands(device_id: int, db: Session = Depends(get_db)):
    """The ESP32's outbound poll for work — the entire premise of the
    approved outbound-only architecture, the backend never calls the
    device. Requires the device's own X-API-Key (require_device_api_key),
    never a user session.

    active = status in (pending, delivered) AND not expired, oldest
    first (command_service.get_active_commands already implements this
    exactly). Every returned pending command is marked delivered before
    the response is built — but that transition is invisible in the
    response itself, since CommandOut carries no status field; the
    device doesn't need to know or care which of the two active
    statuses a command is in. Delivered commands are NOT removed from
    future polls (at-least-once delivery) — only acknowledgement,
    expiry, or (pending-only) superseding ever stop a command from
    being returned.
    """
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    command_service.touch_device_last_seen(db, device_id)

    active = command_service.get_active_commands(db, device_id)

    for command in active:
        if command.status == "pending":
            command_service.mark_delivered(db, command.id)

    return CommandListResponse(commands=[_to_command_out(c) for c in active])


@router.post(
    "/{device_id}/commands/{command_id}/ack",
    dependencies=[Depends(require_device_api_key)],
)
def acknowledge_command(
    device_id: int,
    command_id: int,
    payload: CommandAckRequest,
    db: Session = Depends(get_db),
):
    """The ESP32 reporting what it actually did with a command it was
    given. Requires the device's own X-API-Key.

    A command that exists but belongs to a DIFFERENT device, and a
    command that doesn't exist at all, both return the identical 404 —
    a device must never be able to tell "that command belongs to
    someone else" apart from "that command doesn't exist", which would
    leak the existence of another device's command ids.

    Idempotent under WiFi retry: command_service.acknowledge_command
    treats an identical repeat of an already-acknowledged result as a
    safe no-op (200, unchanged); a CONFLICTING repeat (different result
    than what's on record) is rejected with 409 rather than silently
    overwriting history.
    """
    device = _device_or_error(device_id, db)
    if device is None:
        return _error("Unknown device", 404)

    command_service.touch_device_last_seen(db, device_id)

    try:
        command = command_service.acknowledge_command(
            db,
            command_id=command_id,
            device_id=device_id,
            applied_pump_state=payload.applied_pump_state,
            applied_manual_override=payload.applied_manual_override,
            was_safety_refused=payload.was_safety_refused,
        )
    except command_service.CommandNotFoundError:
        return _error("Unknown command", 404)
    except command_service.CommandDeviceMismatchError:
        return _error("Unknown command", 404)
    except command_service.CommandAlreadyAcknowledgedError:
        return _error("Command already acknowledged with a different result", 409)

    return {
        "success": True,
        "command_id": command.id,
        "status": command.status,
        "message": "Acknowledgement recorded",
    }
