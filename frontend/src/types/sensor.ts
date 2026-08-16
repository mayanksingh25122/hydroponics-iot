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

export interface DeviceStatus {
  success: true;
  device_id: number;
  pump: boolean;
  manualOverride: boolean;
  wifi: boolean;
}

export interface PumpCommandResponse {
  success: true;
  device_id: number;
  pump: boolean;
  message: string;
}

export interface PumpModeResponse extends PumpCommandResponse {
  manualOverride: boolean;
}
