import { useMemo, useState } from "react";
import { Bell, Settings, User, Loader2, AlertTriangle } from "lucide-react";
import { GlassCard } from "../components/common/GlassCard";
import { MetricCard } from "../components/dashboard/MetricCard";
import { LiveChart } from "../components/dashboard/LiveChart";
import { TimeframeSelector } from "../components/dashboard/TimeframeSelector";
import { WaterTank, type WaterLevelState } from "../components/dashboard/WaterTank";
import { StatusPill } from "../components/dashboard/StatusPill";
import { HealthRing } from "../components/dashboard/HealthRing";
import { useLatestSensor, useSensorHistory } from "../hooks/useSensors";
import { filterHistoryByTimeframe, type Timeframe } from "../lib/chartUtils";

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
    return {
      percent: 0,
      state: "critical",
    };
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

export default function Dashboard() {
  const { data, loading, error } = useLatestSensor();
  const {
    data: history,
    loading: historyLoading,
    error: historyError,
  } = useSensorHistory();

  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const waterLevel = mapWaterLevel(data?.water_level);
<WaterTank
  percent={waterLevel.percent}
  state={waterLevel.state}
/>
  const filteredHistory = useMemo(
    () => filterHistoryByTimeframe(history ?? [], timeframe),
    [history, timeframe]
  );

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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-white/56">
              <span className="text-base leading-none">📊</span>
              <span>Live Analytics</span>
            </div>
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          </div>

          {historyLoading && !history ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {["Temperature", "pH", "EC", "TDS"].map((label) => (
                <GlassCard key={label} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-sm text-white/56">
                    <span className="text-base leading-none">📈</span>
                    <span>{label}</span>
                  </div>
                  <div className="flex h-[220px] w-full items-center justify-center gap-3 text-white/40">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Loading history…</span>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : historyError ? (
            <GlassCard className="flex items-center gap-3 border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <AlertTriangle size={18} />
              <span>Failed to load history: {historyError?.message ?? "Unknown error"}</span>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LiveChart
                title="Temperature"
                icon="🌡"
                dataKey="water_temperature"
                color="#34D399"
                unit="°C"
                data={filteredHistory}
              />
              <LiveChart
                title="pH Level"
                icon="🧪"
                dataKey="ph"
                color="#A78BFA"
                data={filteredHistory}
              />
              <LiveChart
                title="EC"
                icon="⚡"
                dataKey="ec"
                color="#60A5FA"
                unit="ppm"
                data={filteredHistory}
              />
              <LiveChart
                title="TDS"
                icon="💧"
                dataKey="tds"
                color="#FBBF24"
                unit="ppm"
                data={filteredHistory}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <WaterTank percent={waterLevel.percent} state={waterLevel.state} />
            <GlassCard className="flex flex-wrap items-center gap-3">
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