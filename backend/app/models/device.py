from sqlalchemy import Column, Integer, String, Boolean
from app.database.base import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String(100), nullable=False)
    device_id = Column(String(100), unique=True, nullable=False)
    location = Column(String(200))
    wifi_ssid = Column(String(100))
    is_online = Column(Boolean, default=False)