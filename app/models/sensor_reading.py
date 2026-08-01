from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.base import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)

    device_id = Column(Integer, ForeignKey("devices.id"))

    ph = Column(Float)

    tds = Column(Float)

    ec = Column(Float)

    water_temperature = Column(Float)

    water_level = Column(Float)

    pump_status = Column(Boolean, default=False)

    buzzer_status = Column(Boolean, default=False)

    timestamp = Column(DateTime(timezone=True), server_default=func.now())