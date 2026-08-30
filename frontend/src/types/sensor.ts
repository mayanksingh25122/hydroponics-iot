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

/**
 * The backend no longer contacts the ESP32 synchronously — pump/mode
 * requests are queued as a DeviceCommand and applied later, whenever
 * the device next polls. This response reflects only that the request
 * was accepted, never that it was carried out; status is always
 * "queued". Actual device state comes from DeviceStatus (GET /status)
 * on the next poll, not from this response.
 */
export interface PumpCommandResponse {
  success: true;
  device_id: number;
  status: "queued";
  command_id: number;
  message: string;
}

export type PumpModeResponse = PumpCommandResponse;
