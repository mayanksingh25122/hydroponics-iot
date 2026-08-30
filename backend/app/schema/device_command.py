from datetime import datetime

from pydantic import BaseModel


class CommandOut(BaseModel):
    """What the ESP32 needs to know about one active command.

    Deliberately excludes requested_by_user_id, status, delivered_at,
    acknowledged_at, and every applied_*/was_safety_refused field — none
    of that is the device's business to see. status specifically is
    omitted on purpose: whether a command is pending or delivered
    changes nothing about what the device should do with it, and the
    device has no use for the distinction.
    """

    id: int
    command_type: str
    requested_pump_state: bool | None
    requested_manual_override: bool | None
    created_at: datetime
    expires_at: datetime


class CommandListResponse(BaseModel):
    commands: list[CommandOut]


class CommandAckRequest(BaseModel):
    """What the ESP32 reports after actually attempting a command.

    applied_pump_state / applied_manual_override are optional (default
    None) rather than strictly required — only one is ever meaningful
    for a given command_type, and the device shouldn't need to invent a
    value for the field that doesn't apply to what it was asked to do.
    was_safety_refused has no default: the device must always say
    explicitly whether firmware safety logic overrode the request.
    """

    applied_pump_state: bool | None = None
    applied_manual_override: bool | None = None
    was_safety_refused: bool
