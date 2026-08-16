import type { DeviceStatus, SensorReading } from "@/types/sensor";

export const TELEMETRY_STALE_AFTER_MS = 20_000;

export function isTelemetryFresh(reading?: SensorReading): boolean {
  if (!reading?.timestamp) return false;
  const timestamp = new Date(reading.timestamp).getTime();
  return !Number.isNaN(timestamp) && Date.now() - timestamp <= TELEMETRY_STALE_AFTER_MS;
}

export function formatLastUpdate(reading?: SensorReading): string {
  if (!reading?.timestamp) return "No telemetry received";
  const date = new Date(reading.timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid device timestamp";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function deviceIsOnline(status?: DeviceStatus, reading?: SensorReading): boolean {
  return Boolean(status?.wifi && isTelemetryFresh(reading));
}

export function systemHealthScore(status?: DeviceStatus, reading?: SensorReading): number {
  if (!reading || !isTelemetryFresh(reading) || !status?.wifi) return 0;
  if (reading.water_level < 0) return 60;
  if (reading.water_level > 30 || reading.water_level < 7) return 75;
  return 100;
}
