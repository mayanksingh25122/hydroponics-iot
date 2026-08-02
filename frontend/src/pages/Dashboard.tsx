import { Bell, Settings, User, Loader2, AlertTriangle } from "lucide-react";
import { GlassCard } from "../components/common/GlassCard";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ChartCard, type ChartPoint } from "../components/dashboard/ChartCard";
import { WaterTank, type WaterLevelState } from "../components/dashboard/WaterTank";
import { StatusPill } from "../components/dashboard/StatusPill";
import { HealthRing } from "../components/dashboard/HealthRing";
import { useLatestSensor, useSensorHistory } from "../hooks/useSensors";
import type { SensorHistory } from "@/types/sensor";

function formatMetric(value: number | undefined, fractionDigits = 1): string {
  return value !== undefined ? value.toFixed(fractionDigits) : "—";
}

/**
 * Maps the firmware's 4-state water_level enum (0-3) to a display
 * percent + WaterTank state. Adjust the enum→percent bands here if the
 * firmware's threshold semantics change.
 */
function mapWaterLevel(distance: number | undefined): {
  percent: number;
  state: WaterLevelState;
} {
  if (distance === undefined) {
    return { percent: 0, state: "critical" };
  }

  const FULL_DISTANCE = 9;
  const EMPTY_DISTANCE = 28;

  const percent = Math.round(
    ((EMPTY_DISTANCE - distance) /
      (EMPTY_DISTANCE - FULL_DISTANCE)) * 100
  );

  const clamped = Math.max(0, Math.min(100, percent));

  let state: WaterLevelState;

  if (clamped >= 76) {
    state = "full";
  } else if (clamped >= 41) {
    state = "ok";
  } else if (clamped >= 21) {
    state = "low";
  } else {
    state = "critical";
  }

  return {
    percent: clamped,
    state,
  };
}



/**
 * Converts raw backend history readings into ChartCard's expected
 * { t, value } shape, plotting water_temperature over time.
 */
function toTemperatureSeries(history: SensorHistory | undefined): ChartPoint[] {
  if (!history) return [];

  // Only keep the latest 50 readings
  const recent = history.slice(-50);

  return recent.map((reading) => {
    const date = new Date(reading.timestamp);
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");

    return {
      t: `${hh}:${mm}`,
      value: reading.water_temperature,
    };
  });
}

export default function Dashboard() {
  const { data, loading, error } = useLatestSensor();
  const {
    data: history,
    loading: historyLoading,
    error: historyError,
  } = useSensorHistory();

  const waterLevel = mapWaterLevel(data?.water_level);
  const temperatureSeries = toTemperatureSeries(history);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-semibold text-white/92">
          <span>🌱</span>
          <span>Hydroponics Platform</span>
        </div>
        <div className="flex items-center gap-4 text-white/56">
          <Bell size={18} className="cursor-pointer hover:text-white/90" />
          <User size={18} className="cursor-pointer hover:text-white/90" />
          <Settings size={18} className="cursor-pointer hover:text-white/90" />
        </div>
      </div>

      {error ? (
        <GlassCard className="flex items-center gap-3 border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <AlertTriangle size={18} />
          <span>Failed to load sensor data: {error?.message ?? "Unknown error"}</span>
        </GlassCard>
      ) : null}

      {loading && !data ? (
        <GlassCard className="flex items-center justify-center gap-3 p-8 text-white/70">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading live sensor data…</span>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              icon="🌡"
              label="Temperature"
              value={formatMetric(data?.water_temperature)}
              unit="°C"
              delta={{ direction: "flat", text: "Live" }}
            />
            <MetricCard
              icon="🧪"
              label="pH"
              value={formatMetric(data?.ph)}
              delta={{ direction: "flat", text: "Live" }}
            />
            <MetricCard
              icon="⚡"
              label="EC"
              value={formatMetric(data?.ec)}
              unit="ppm"
              delta={{ direction: "flat", text: "Live" }}
            />
            <MetricCard
              icon="💧"
              label="TDS"
              value={formatMetric(data?.tds)}
              unit="ppm"
              delta={{ direction: "flat", text: "Live" }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {historyLoading && !history ? (
                <GlassCard className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-white/56">
                    <span className="text-base leading-none">📈</span>
                    <span>Live Temperature Graph</span>
                  </div>
                  <div className="flex h-[220px] w-full items-center justify-center gap-3 text-white/40">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Loading history…</span>
                  </div>
                </GlassCard>
              ) : historyError ? (
                <GlassCard className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-white/56">
                    <span className="text-base leading-none">📈</span>
                    <span>Live Temperature Graph</span>
                  </div>
                  <div className="flex h-[220px] w-full items-center justify-center gap-2 text-red-300">
                    <AlertTriangle size={16} />
                    <span>Failed to load history</span>
                  </div>
                </GlassCard>
              ) : temperatureSeries.length === 0 ? (
                <GlassCard className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-white/56">
                    <span className="text-base leading-none">📈</span>
                    <span>Live Temperature Graph</span>
                  </div>
                  <div className="flex h-[220px] w-full items-center justify-center text-white/40">
                    No historical data
                  </div>
                </GlassCard>
              ) : (
                <ChartCard title="Live Temperature Graph" icon="📈" data={temperatureSeries} unit="°C" />
              )}
            </div>
            <WaterTank percent={waterLevel.percent} state={waterLevel.state} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard className="flex flex-wrap items-center gap-3 lg:col-span-2">
              <StatusPill label="Pump" state={data?.pump_status ? "ok" : "off"} />
              <StatusPill label="ESP32" state="ok" />
              <StatusPill label="WiFi" state="ok" />
              <StatusPill label="Lights" state="warn" />
            </GlassCard>
            <HealthRing percent={98} />
          </div>
        </>
      )}
    </div>
  );
}