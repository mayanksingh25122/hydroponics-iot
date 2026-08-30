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

export type CommandType = "pump_state" | "pump_mode";

export type CommandLifecycleStatus = "pending" | "delivered" | "acknowledged" | "superseded" | "expired";

/** What the user asked for. Exactly one field is non-null, matching command_type. */
export interface RequestedCommandState {
  pump_state: boolean | null;
  manual_override: boolean | null;
}

/**
 * What the ESP32 reported actually happened. Present only once a command
 * is acknowledged — see CommandStatusResponse.result.
 */
export interface CommandResult {
  pump_state: boolean | null;
  manual_override: boolean | null;
  was_safety_refused: boolean | null;
}

/**
 * GET /api/devices/{id}/commands/{command_id}. result is null for every
 * non-acknowledged status — there is no outcome to report yet. Once
 * acknowledged, result reflects firmware's authoritative applied state,
 * which may differ from `requested` (e.g. a safety refusal); callers
 * must compare the two rather than assuming status === "acknowledged"
 * means the request was honored as-is.
 */
export interface CommandStatusResponse {
  success: true;
  command_id: number;
  device_id: number;
  command_type: CommandType;
  status: CommandLifecycleStatus;
  requested: RequestedCommandState;
  result: CommandResult | null;
  created_at: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  expires_at: string;
}
