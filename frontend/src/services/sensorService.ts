import { api } from "./api";
import type { SensorReading, SensorHistory } from "@/types/sensor";

export async function getLatestSensor(): Promise<SensorReading> {
  const response = await api.get<SensorReading>("/api/sensors/latest");
  return response.data;
}

export async function getSensorHistory(): Promise<SensorHistory> {
  const response = await api.get<SensorHistory>("/api/sensors/history");
  return response.data;
}