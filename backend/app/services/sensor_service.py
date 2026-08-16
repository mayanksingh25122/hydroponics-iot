from sqlalchemy.orm import Session
from app.models.device import Device
from app.models.sensor_reading import SensorReading
from app.schema.sensor import SensorData


def save_sensor_data(db: Session, data: SensorData):
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
        device = db.query(Device).filter(Device.id == data.device_id).first()
        if device is not None:
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
