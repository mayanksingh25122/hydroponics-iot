export interface SensorReading {
  id: number;
  device_id: number;
  ph: number;
  tds: number;
  ec: number;
  water_temperature: number;
  water_level: number;
  pump_status: boolean;
  buzzer_status: boolean;
  timestamp: string;
}

export type SensorHistory = SensorReading[];