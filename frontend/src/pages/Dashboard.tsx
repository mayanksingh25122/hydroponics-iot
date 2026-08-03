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
 * Maps the firmware's raw ultrasonic distance reading into a display
 * percent + WaterTank state. Calibration unchanged:
 * FULL_DISTANCE = 9cm, EMPTY_DISTANCE = 28cm.
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
    ((EMPTY_DISTANCE - distance) / (EMPTY_DISTANCE - FULL_DISTANCE)) * 100
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
 * Routed dashboard page — rendered inside PageLayout's <Outlet />.
 * Does not render its own sidebar or app shell; PageLayout owns those.
 */
export default function Dashboard() {
  const { data, loading, error } = useLatestSensor();
  const {
    data: history,
    loading: historyLoading,
    error: historyError,
  } = useSensorHistory();

  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const waterLevel = mapWaterLevel(data?.water_level);

  const filteredHistory = useMemo(
    () => filterHistoryByTimeframe(history ?? [], timeframe),
    [history, timeframe]
  );

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-lime-400/10 text-2xl shadow-[0_0_20px_rgba(34,197,94,0.15)]">
            🌱
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-xl font-semibold text-white/92">Hydroponics Platform</h1>
            <span className="text-sm text-emerald-300/50">Real-time system monitoring</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-white/56">
          {[Bell, User, Settings].map((Icon, i) => (
            <button
              key={i}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition-all duration-300 hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-white/90"
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <GlassCard className="flex items-center gap-3 border-red-500/30 bg-red-500/10 text-red-200">
          <AlertTriangle size={18} />
          <span>Failed to load sensor data: {error?.message ?? "Unknown error"}</span>
        </GlassCard>
      ) : null}

      {loading && !data ? (
        <GlassCard className="flex items-center justify-center gap-3 py-12 text-white/70">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading live sensor data…</span>
        </GlassCard>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

          {/* Analytics header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">📊</span>
              <h2 className="text-lg font-semibold text-white/90">Live Analytics</h2>
            </div>
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          </div>

          {/* Charts */}
          {historyLoading && !history ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
            <GlassCard className="flex items-center gap-3 border-red-500/30 bg-red-500/10 text-red-200">
              <AlertTriangle size={18} />
              <span>Failed to load history: {historyError?.message ?? "Unknown error"}</span>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

          {/* Bottom row */}
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