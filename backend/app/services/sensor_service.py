from sqlalchemy.orm import Session
from app.models.device import Device
from app.models.sensor_reading import SensorReading
from app.schema.sensor import SensorData


class UnknownDeviceError(Exception):
    """Telemetry referenced a device_id with no matching row in devices.

    The database already enforces this via a real foreign key
    (sensor_readings.device_id -> devices.id). Checking it here, before
    attempting the insert, turns what would otherwise be an unhandled
    IntegrityError (500, no useful detail to the caller) into an expected,
    named failure the router can translate into a clean 404.
    """

    def __init__(self, device_id: int):
        self.device_id = device_id
        super().__init__(f"Unknown device_id: {device_id}")


def save_sensor_data(db: Session, data: SensorData) -> SensorReading:
    device = db.query(Device).filter(Device.id == data.device_id).first()
    if device is None:
        raise UnknownDeviceError(data.device_id)

    try:
        reading = SensorReading(
            device_id=data.device_id,
            ph=data.ph,
            tds=data.tds,
            ec=data.ec,
            water_temperature=data.water_temperature,
            water_level=data.water_level,
            pump_status=data.pump_status,
            buzzer_status=data.buzzer_status,
        )

        db.add(reading)

        # Telemetry remains the persisted source of truth for actual pump state.
        device.is_online = True

        db.commit()
        db.refresh(reading)

        print("SUCCESS:", reading.id)

        return reading

    except Exception as e:
        db.rollback()
        print("DATABASE ERROR:")
        print(e)
        raise
