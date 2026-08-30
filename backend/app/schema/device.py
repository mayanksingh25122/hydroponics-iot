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
