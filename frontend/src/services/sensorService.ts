import { api } from "./api";
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
  const response = await api.post<PumpCommandResponse>(`/api/devices/${deviceId}/pump`, { state });
  return response.data;
}

export async function setPumpMode(
  deviceId: number,
  mode: "auto" | "manual"
): Promise<PumpModeResponse> {
  const response = await api.post<PumpModeResponse>(`/api/devices/${deviceId}/pump/mode`, { mode });
  return response.data;
}
