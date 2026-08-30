"""Device command queue business logic: creating, superseding, delivering,
expiring, and acknowledging DeviceCommand rows. No FastAPI, no HTTP, and
no communication with the ESP32 whatsoever — this module only manages
command *state* in the database. A future route layer calls these
functions and maps their exceptions to responses; the actual outbound
poll/ack HTTP endpoints, and any code that talks to a physical device,
belong to a later task.

Approved architecture this implements: the backend never calls the
device — the ESP32 polls for pending work on its own schedule, applies
it locally through firmware safety logic (which is authoritative, not
this service), and reports back what it actually did.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.device_command import DeviceCommand
from app.settings import DEVICE_COMMAND_TTL_SECONDS

# Commands in either of these statuses are still "in flight" — not yet
# resolved one way or the other. See get_active_commands's docstring for
# the at-least-once delivery reasoning.
_ACTIVE_STATUSES = ("pending", "delivered")


# =============================================================================
# Exceptions
# =============================================================================
# Each one is a distinct, internal signal for the future route layer to
# catch and translate into a response — this module makes no assumption
# about what that response should look like.


class UnknownDeviceError(Exception):
    """A command was requested for a device_id with no matching row in
    devices. Mirrors app.services.sensor_service.UnknownDeviceError —
    same reasoning: turn what would otherwise be an unhandled foreign-key
    IntegrityError into a clean, named, catchable failure raised before
    any write is attempted.
    """

    def __init__(self, device_id: int):
        self.device_id = device_id
        super().__init__(f"Unknown device_id: {device_id}")


class CommandNotFoundError(Exception):
    """No DeviceCommand row matches the given command id."""

    def __init__(self, command_id: int):
        self.command_id = command_id
        super().__init__(f"Unknown command id: {command_id}")


class CommandDeviceMismatchError(Exception):
    """A device attempted to acknowledge a command that was actually
    issued for a DIFFERENT device_id. Must never be allowed silently —
    a device may only confirm outcomes for commands addressed to it.
    """

    def __init__(self, command_id: int, expected_device_id: int, actual_device_id: int):
        self.command_id = command_id
        self.expected_device_id = expected_device_id
        self.actual_device_id = actual_device_id
        super().__init__(
            f"Command {command_id} belongs to device {expected_device_id}, "
            f"not {actual_device_id}"
        )


# =============================================================================
# Command creation (+ superseding)
# =============================================================================


def _supersede_pending(db: Session, device_id: int, command_type: str) -> None:
    """Marks every still-PENDING command of this type, for this device,
    as superseded. Deliberately narrow: only status == "pending" rows
    are touched — a command that's already delivered, acknowledged,
    expired, or (obviously) already superseded is left exactly as it
    is. This matches the approved rule precisely ("For now, only
    supersede commands with status: pending").

    Does not commit — the caller commits once, together with the new
    command's insert, so superseding and creation are atomic.
    """
    db.query(DeviceCommand).filter(
        DeviceCommand.device_id == device_id,
        DeviceCommand.command_type == command_type,
        DeviceCommand.status == "pending",
    ).update({"status": "superseded"}, synchronize_session=False)


def _create_command(
    db: Session,
    *,
    device_id: int,
    requested_by_user_id: int,
    command_type: str,
    requested_pump_state: bool | None,
    requested_manual_override: bool | None,
) -> DeviceCommand:
    if db.query(Device).filter(Device.id == device_id).first() is None:
        raise UnknownDeviceError(device_id)

    _supersede_pending(db, device_id, command_type)

    command = DeviceCommand(
        device_id=device_id,
        requested_by_user_id=requested_by_user_id,
        command_type=command_type,
        requested_pump_state=requested_pump_state,
        requested_manual_override=requested_manual_override,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=DEVICE_COMMAND_TTL_SECONDS),
    )
    db.add(command)
    db.commit()  # one commit covers both the supersede update and this insert
    db.refresh(command)
    return command


def create_pump_state_command(
    db: Session,
    *,
    device_id: int,
    requested_by_user_id: int,
    requested_pump_state: bool,
) -> DeviceCommand:
    """Queue a pump on/off request.

    Atomically supersedes any still-pending pump_state command for this
    device — pump_state and pump_mode are separate control domains
    (approved rule), so this never touches pending pump_mode commands.
    """
    return _create_command(
        db,
        device_id=device_id,
        requested_by_user_id=requested_by_user_id,
        command_type="pump_state",
        requested_pump_state=requested_pump_state,
        requested_manual_override=None,
    )


def create_pump_mode_command(
    db: Session,
    *,
    device_id: int,
    requested_by_user_id: int,
    requested_manual_override: bool,
) -> DeviceCommand:
    """Queue an auto/manual mode request.

    Atomically supersedes any still-pending pump_mode command for this
    device — never touches pending pump_state commands (separate
    control domain).
    """
    return _create_command(
        db,
        device_id=device_id,
        requested_by_user_id=requested_by_user_id,
        command_type="pump_mode",
        requested_pump_state=None,
        requested_manual_override=requested_manual_override,
    )


# =============================================================================
# Expiration
# =============================================================================


def expire_stale_commands(db: Session, device_id: int) -> int:
    """Transitions every pending/delivered command for this device whose
    expires_at has passed to expired. Returns the number of rows
    affected.

    Checked lazily, wherever it matters (called by get_active_commands
    below) rather than by a background job or scheduler — this project
    deliberately has neither, and a queue this size doesn't need one.
    """
    now = datetime.now(timezone.utc)
    affected = (
        db.query(DeviceCommand)
        .filter(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status.in_(_ACTIVE_STATUSES),
            DeviceCommand.expires_at <= now,
        )
        .update({"status": "expired"}, synchronize_session=False)
    )
    db.commit()
    return affected


# =============================================================================
# Fetching active commands
# =============================================================================


def get_active_commands(db: Session, device_id: int) -> list[DeviceCommand]:
    """Returns every currently-active command for this device, oldest
    first (created_at ascending).

    "Active" = status in (pending, delivered) AND not yet expired. This
    project uses at-least-once delivery: a command already marked
    delivered is NOT hidden from future polls — it stays active until
    it is acknowledged, expires, or (pending only) is superseded. The
    device is expected to use command ids to avoid re-applying a
    command it already acted on; that de-duplication is firmware's
    responsibility, not this service's.

    Expires anything stale for this device first, so callers never see
    a command that should already have expired.
    """
    expire_stale_commands(db, device_id)

    return (
        db.query(DeviceCommand)
        .filter(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status.in_(_ACTIVE_STATUSES),
            DeviceCommand.expires_at > datetime.now(timezone.utc),
        )
        .order_by(DeviceCommand.created_at.asc())
        .all()
    )


# =============================================================================
# Delivery marking
# =============================================================================


def mark_delivered(db: Session, command_id: int) -> DeviceCommand:
    """Marks a command delivered, exactly once.

    If the command is not currently pending (already delivered, or in
    any terminal state), this is a no-op that returns it unchanged —
    delivered_at is never overwritten once set, and a terminal command
    is never resurrected back into delivered.
    """
    command = db.query(DeviceCommand).filter(DeviceCommand.id == command_id).first()
    if command is None:
        raise CommandNotFoundError(command_id)

    if command.status == "pending":
        command.status = "delivered"
        command.delivered_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(command)

    return command


# =============================================================================
# Acknowledgement
# =============================================================================


def acknowledge_command(
    db: Session,
    *,
    command_id: int,
    device_id: int,
    applied_pump_state: bool | None,
    applied_manual_override: bool | None,
    was_safety_refused: bool,
) -> DeviceCommand:
    """Records what the ESP32 actually did for a command it was given.

    Stores applied_pump_state / applied_manual_override /
    was_safety_refused exactly as reported — this service does not
    second-guess or validate them against the original request; the
    firmware's applyPumpDecision() safety gate is authoritative, and
    was_safety_refused is precisely how that fact is preserved when the
    device silently overrides an unsafe request.

    Only the device the command was actually issued to may acknowledge
    it: raises CommandDeviceMismatchError if device_id doesn't match
    the command's own device_id, rather than silently accepting or
    rewriting ownership.
    """
    command = db.query(DeviceCommand).filter(DeviceCommand.id == command_id).first()
    if command is None:
        raise CommandNotFoundError(command_id)

    if command.device_id != device_id:
        raise CommandDeviceMismatchError(command_id, command.device_id, device_id)

    command.status = "acknowledged"
    command.acknowledged_at = datetime.now(timezone.utc)
    command.applied_pump_state = applied_pump_state
    command.applied_manual_override = applied_manual_override
    command.was_safety_refused = was_safety_refused

    db.commit()
    db.refresh(command)
    return command


# =============================================================================
# Last-seen helper
# =============================================================================


def touch_device_last_seen(db: Session, device_id: int) -> None:
    """Updates Device.last_seen_at to the current UTC time.

    A small, reusable helper — not a heartbeat system. It performs the
    update; it does not decide when a device has "really" been seen.
    Future callers (telemetry ingestion, command polling, command
    acknowledgement) each call this on their own real inbound contact
    from a device; none of that wiring happens in this task.

    Does not touch is_online — that flag's existing logic (set only by
    app.services.sensor_service.save_sensor_data on a successful
    telemetry POST) is untouched and out of scope here.

    No-op for an unknown device_id (an UPDATE matching zero rows is a
    normal, harmless outcome) rather than raising — by the time this is
    called, device existence has typically already been established by
    the caller for its own reasons.
    """
    db.query(Device).filter(Device.id == device_id).update(
        {"last_seen_at": datetime.now(timezone.utc)}, synchronize_session=False
    )
    db.commit()
