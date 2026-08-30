"""Idempotent provisioning for the first real VERDA ESP32 device.

This is a local operator script, not an HTTP endpoint — it is run manually
by whoever already has the backend/.env database credentials, the same
access level required to run `alembic upgrade head`. There is no new API
surface, no new secret, and nothing reachable over the network.

Why the device row must get id=1 specifically:
The real firmware (firmware/finalhardwarefile/finalhardwarefile.ino,
uploadTask()) hardcodes `"device_id":1` in every telemetry POST, and that
JSON field is written straight into sensor_readings.device_id, which
carries a real foreign key to devices.id. Firmware is out of scope to
modify in this task, so the database has to meet it where it already is.

id=1 cannot be left to auto-increment: devices.id is a Postgres SERIAL
column, and its sequence was already advanced once during a prior task's
end-to-end test (an inserted-then-deleted temporary row) — deletes do not
roll back a sequence, so the next default-assigned id would be 2, not 1.
This script sets id=1 explicitly, which is a normal, supported operation
on a SERIAL column and does not touch or require adjusting the sequence:
whatever the sequence's next() call returns later is untouched by this,
and won't collide with the row this script creates.

Idempotent: running this any number of times leaves exactly one VERDA
device row (id=1, device_id=DEVICE_SLUG) — it never creates a duplicate.

Usage (either form works, same sys.path pattern alembic/env.py already
uses to make backend/ importable regardless of invocation directory):
    python backend/scripts/provision_device.py
    # or, from backend/:
    python -m scripts.provision_device
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import or_  # noqa: E402

from app.database.connection import SessionLocal  # noqa: E402
from app.models.device import Device  # noqa: E402

# The real firmware's hardcoded telemetry device_id (int PK, via the
# sensor_readings.device_id foreign key) — see module docstring.
DEVICE_PK = 1

# Device.device_id: a separate, human-readable unique string identifier
# (distinct from the integer PK above) — a project-internal slug, not a
# hardware serial number or MAC address.
DEVICE_SLUG = "verda-esp32-dev-01"

DEVICE_NAME = "VERDA ESP32 Hydroponics Controller"

# location and wifi_ssid are nullable columns on Device (models/device.py).
# No confirmed real-world value exists for either yet, so both are left
# unset here rather than filled with invented data — update this script
# (or the row directly) once that information is actually known.


def provision() -> Device:
    db = SessionLocal()
    try:
        existing = (
            db.query(Device)
            .filter(or_(Device.id == DEVICE_PK, Device.device_id == DEVICE_SLUG))
            .first()
        )
        if existing is not None:
            print(
                f"Already provisioned — no changes made. "
                f"id={existing.id}, device_id={existing.device_id!r}, "
                f"device_name={existing.device_name!r}, is_online={existing.is_online}"
            )
            return existing

        device = Device(
            id=DEVICE_PK,
            device_name=DEVICE_NAME,
            device_id=DEVICE_SLUG,
            location=None,
            wifi_ssid=None,
            # Not faked: this device has not yet sent telemetry. The only
            # code path that ever sets is_online=True is
            # app.services.sensor_service.save_sensor_data, triggered by a
            # real, successfully-persisted telemetry POST.
            is_online=False,
        )
        db.add(device)
        db.commit()
        db.refresh(device)

        print(
            f"Provisioned VERDA device: id={device.id}, "
            f"device_id={device.device_id!r}, device_name={device.device_name!r}"
        )
        return device
    finally:
        db.close()


if __name__ == "__main__":
    provision()
