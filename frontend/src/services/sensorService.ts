import { api, getApiUrl } from "./api";
import type {
  DeviceStatus,
  PumpCommandResponse,
  PumpModeResponse,
  SensorReading,
  SensorHistory,
} from "@/types/sensor";

export async function getLatestSensor(): Promise<SensorReading> {
  const response = await api.get<SensorReading>("/api/sensors/latest");
  return response.data;
}

export async function getSensorHistory(): Promise<SensorHistory> {
  const response = await api.get<SensorHistory>("/api/sensors/history");
  return response.data;
}

export async function getDeviceStatus(deviceId: number): Promise<DeviceStatus> {
  const response = await api.get<DeviceStatus>(`/api/devices/${deviceId}/status`);
  return response.data;
}

export async function setPumpState(
  deviceId: number,
  state: boolean
): Promise<PumpCommandResponse> {
  const path = `/api/devices/${deviceId}/pump`;
  const command = { state };

  console.info("[PUMP] Device ID:", deviceId);
  console.info("[PUMP] Sending command:", command);
  console.info("[PUMP] API URL:", getApiUrl(path));

  try {
    const response = await api.post<PumpCommandResponse>(path, command);
    console.info("[PUMP] Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("[PUMP] Error:", error);
    throw error;
  }
}

export async function setPumpMode(
  deviceId: number,
  mode: "auto" | "manual"
): Promise<PumpModeResponse> {
  const path = `/api/devices/${deviceId}/pump/mode`;
  const command = { mode };

  console.info("[PUMP] Device ID:", deviceId);
  console.info("[PUMP] Sending command:", command);
  console.info("[PUMP] API URL:", getApiUrl(path));

  try {
    const response = await api.post<PumpModeResponse>(path, command);
    console.info("[PUMP] Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("[PUMP] Error:", error);
    throw error;
  }
}
