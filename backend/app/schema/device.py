from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class PumpCommand(BaseModel):
    state: bool


class PumpModeCommand(BaseModel):
    mode: Literal["auto", "manual"]


class QueuedCommandResponse(BaseModel):
    """Response for a user-facing pump/pump-mode request.

    Deliberately does NOT claim the command was applied — the backend no
    longer talks to the ESP32 synchronously (approved outbound-only
    architecture), so at the moment this response is sent, the device
    may not even be online yet. status is always "queued" here (the
    command has just been created); the frontend learns whether it was
    actually carried out later, via GET /status or the command's own
    eventual acknowledgement — not from this response.
    """

    success: bool
    device_id: int
    status: Literal["queued"]
    command_id: int
    message: str


class RequestedCommandState(BaseModel):
    """What the user asked for. Exactly one field is non-null, matching
    which command_type the command is — mirrors DeviceCommand's own
    requested_pump_state/requested_manual_override split.
    """

    pump_state: bool | None
    manual_override: bool | None


class CommandResult(BaseModel):
    """What the ESP32 reported actually happened. Only ever populated on
    an acknowledged command — see CommandStatusResponse.result.
    """

    pump_state: bool | None
    manual_override: bool | None
    was_safety_refused: bool | None


class CommandStatusResponse(BaseModel):
    """A single command's full lifecycle and outcome, for the
    authenticated user who wants to know what happened to a command they
    queued.

    result is None for pending/delivered/superseded/expired commands —
    there is no actual outcome yet, and presenting one (even all-null)
    would blur "not yet known" with "known to be nothing". It is only
    ever populated once status == "acknowledged", at which point it
    reflects firmware's authoritative applied_*/was_safety_refused
    values, which may legitimately differ from `requested` (e.g. a
    safety refusal) — that distinction is the entire point of this
    endpoint, see command_type's docstring in models/device_command.py.
    """

    success: bool
    command_id: int
    device_id: int
    command_type: str
    status: str
    requested: RequestedCommandState
    result: CommandResult | None
    created_at: datetime
    delivered_at: datetime | None
    acknowledged_at: datetime | None
    expires_at: datetime
