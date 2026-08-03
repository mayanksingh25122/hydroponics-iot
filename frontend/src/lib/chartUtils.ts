import type { SensorReading } from "@/types/sensor";

export type Timeframe = "1h" | "6h" | "24h" | "7d";

export const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
];

const TIMEFRAME_WINDOW_MS: Record<Timeframe, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

// Caps how many points ever reach a chart, independent of how many raw
// samples the backend returns for a given range. Keeps 7-day views
// readable/performant instead of plotting every 5s sample.
const MAX_POINTS: Record<Timeframe, number> = {
  "1h": 60,
  "6h": 90,
  "24h": 120,
  "7d": 168,
};

/**
 * Evenly decimates a chronologically-sorted array down to at most
 * `maxPoints` entries. Always keeps the final (most recent) sample so
 * the right edge of the chart reflects the latest reading.
 */
function downsample(data: SensorReading[], maxPoints: number): SensorReading[] {
  if (data.length <= maxPoints) return data;

  const step = data.length / maxPoints;
  const result: SensorReading[] = [];

  for (let i = 0; i < maxPoints; i++) {
    result.push(data[Math.floor(i * step)]);
  }

  const last = data[data.length - 1];
  if (result[result.length - 1] !== last) {
    result[result.length - 1] = last;
  }

  return result;
}

/**
 * Filters raw history down to the selected timeframe window and
 * downsamples it for chart readability. Purely frontend — does not
 * touch the API, per the "filter frontend data only" requirement.
 */
export function filterHistoryByTimeframe(
  history: SensorReading[],
  timeframe: Timeframe
): SensorReading[] {
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const windowMs = TIMEFRAME_WINDOW_MS[timeframe];
  const cutoff = Date.now() - windowMs;

  const withinWindow = sorted.filter((reading) => {
    const t = new Date(reading.timestamp).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });

  return downsample(withinWindow, MAX_POINTS[timeframe]);
}