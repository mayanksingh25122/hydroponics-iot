from pydantic import BaseModel, Field


class SensorData(BaseModel):
    """ESP32 telemetry payload.

    Field set and JSON keys match the firmware's upload exactly
    (firmware/finalhardwarefile/finalhardwarefile.ino, uploadTask()) — all
    eight fields are required there and required here; nothing is renamed
    or added. Numeric bounds below mirror limits the firmware itself
    already enforces before sending, not new limits invented here:
      - ph: clamped to [0.0, 14.0] in firmware (pHValue clamp block).
      - water_level: the firmware sends -1 as an explicit sentinel for
        "no echo / out of range" from the ultrasonic sensor, otherwise a
        non-negative distance in cm.
      - tds/ec/water_temperature: firmware applies no clamp, so no range
        is enforced here beyond rejecting NaN/Infinity, which Python's
        json module can parse but no legitimate sensor reading produces.
    """

    device_id: int = Field(gt=0)

    ph: float = Field(ge=0.0, le=14.0, allow_inf_nan=False)

    tds: float = Field(allow_inf_nan=False)

    ec: float = Field(allow_inf_nan=False)

    water_temperature: float = Field(allow_inf_nan=False)

    water_level: float = Field(ge=-1.0, allow_inf_nan=False)

    pump_status: bool

    buzzer_status: bool
