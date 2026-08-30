from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database.base import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String(100), nullable=False)
    device_id = Column(String(100), unique=True, nullable=False)
    location = Column(String(200))
    wifi_ssid = Column(String(100))
    is_online = Column(Boolean, default=False)

    # Refreshed on every inbound contact from the device — a telemetry
    # POST, a command poll, or a command ack (see app.models.device_command)
    # — once those exist. The authoritative recency signal for the
    # outbound-only polling architecture. Additive only: is_online is
    # untouched, not redesigned, not removed.
    last_seen_at = Column(DateTime(timezone=True), nullable=True)

    commands = relationship("DeviceCommand", back_populates="device")
