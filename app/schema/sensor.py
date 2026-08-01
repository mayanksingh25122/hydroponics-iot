from pydantic import BaseModel


class SensorData(BaseModel):

    device_id: int

    ph: float

    tds: float

    ec: float

    water_temperature: float

    water_level: float

    pump_status: bool

    buzzer_status: bool