from typing import Literal

from pydantic import BaseModel


class PumpCommand(BaseModel):
    state: bool


class PumpModeCommand(BaseModel):
    mode: Literal["auto", "manual"]
