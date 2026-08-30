import type { DeviceStatus, SensorReading } from "@/types/sensor";

export const TELEMETRY_STALE_AFTER_MS = 20_000;

/**
 * GET /api/sensors/latest returns `{}` (still typed as SensorReading by
 * the service layer) when no reading has ever been stored — a genuinely
 * empty result, not an error. This is the one place that distinction is
 * checked, rather than widening SensorReading itself and rippling that
 * change through every consumer.
 */
export function hasSensorReading(reading?: SensorReading): reading is SensorReading {
  return Boolean(reading?.timestamp);
}

export function isTelemetryFresh(reading?: SensorReading): boolean {
  if (!hasSensorReading(reading)) return false;
  const timestamp = new Date(reading.timestamp).getTime();
  return !Number.isNaN(timestamp) && Date.now() - timestamp <= TELEMETRY_STALE_AFTER_MS;
}

export function formatLastUpdate(reading?: SensorReading): string {
  if (!hasSensorReading(reading)) return "No telemetry received";
  const date = new Date(reading.timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid device timestamp";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Online requires BOTH: the backend's last completed check confirmed it
 * can reach the ESP32 directly (status.wifi — live per-poll, not derived
 * from telemetry) AND that poll didn't just fail. The statusError check
 * matters because a query can keep its last successful `status` around
 * while a subsequent poll is erroring, which would otherwise let a
 * stale "online" reading outlive the device actually going unreachable
 * by up to one poll interval.
 */
export function deviceIsOnline(
  status?: DeviceStatus,
  reading?: SensorReading,
  statusError?: unknown
): boolean {
  return Boolean(status?.wifi && !statusError && isTelemetryFresh(reading));
}

export function systemHealthScore(status?: DeviceStatus, reading?: SensorReading): number {
  if (!reading || !isTelemetryFresh(reading) || !status?.wifi) return 0;
  if (reading.water_level < 0) return 60;
  if (reading.water_level > 30 || reading.water_level < 7) return 75;
  return 100;
}
