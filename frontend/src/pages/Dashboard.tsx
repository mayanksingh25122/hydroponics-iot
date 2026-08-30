import { useMemo, useState } from "react";
import { Bell, Settings, User, Loader2, AlertTriangle } from "lucide-react";
import { GlassCard } from "../components/common/GlassCard";
import { MetricCard } from "../components/dashboard/MetricCard";
import { LiveChart } from "../components/dashboard/LiveChart";
import { TimeframeSelector } from "../components/dashboard/TimeframeSelector";
import { WaterTank, type WaterLevelState } from "../components/dashboard/WaterTank";
import { StatusPill } from "../components/dashboard/StatusPill";
import { HealthRing } from "../components/dashboard/HealthRing";
import { PumpControl } from "../components/controls/PumpControl";
import { DeviceOverview } from "../components/dashboard/DeviceOverview";
import { useDeviceStatus, useLatestSensor, useSensorHistory } from "../hooks/useSensors";
import { filterHistoryByTimeframe, type Timeframe } from "../lib/chartUtils";
import { deviceIsOnline, hasSensorReading, isTelemetryFresh, systemHealthScore } from "../lib/deviceHealth";
import { getApiErrorMessage } from "../services/api";

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
  const DEVICE_ID = Number(import.meta.env.VITE_DEVICE_ID || 1);
  const { data, loading, error } = useLatestSensor();
  const {
    data: deviceStatus,
    loading: deviceStatusLoading,
    error: deviceStatusError,
  } = useDeviceStatus(DEVICE_ID);
  const {
    data: history,
    loading: historyLoading,
    error: historyError,
  } = useSensorHistory();

  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const telemetryFresh = isTelemetryFresh(data);
  const liveData = telemetryFresh ? data : undefined;
  const waterSensorValid = liveData !== undefined && liveData.water_level >= 0;
  const waterLevel = mapWaterLevel(liveData?.water_level);
  const deviceOnline = deviceIsOnline(deviceStatus, data, deviceStatusError);
  const healthScore = systemHealthScore(deviceStatus, data);
  const deviceStatusErrorMessage = deviceStatusError
    ? getApiErrorMessage(deviceStatusError)
    : undefined;

  // GET /api/sensors/latest resolves successfully to {} (no `id`/`timestamp`)
  // when the device has never sent a reading — distinct from a reading that
  // arrived once and then went stale. Conflating the two would show "Device
  // telemetry is stale" on a device that has never reported anything at all.
  const neverReceivedTelemetry = !loading && !error && data !== undefined && !hasSensorReading(data);

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
            <h1 className="text-xl font-semibold text-white/92">VERDA Farms</h1>
            <span className="text-sm text-emerald-300/50">Live farm systems monitoring</span>
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

      {neverReceivedTelemetry ? (
        <GlassCard className="flex items-center gap-3 border-white/10 bg-white/[0.03] text-white/70">
          <AlertTriangle size={18} />
          <span>No telemetry has been received from this device yet. Readings will appear here once the ESP32 sends its first upload.</span>
        </GlassCard>
      ) : !telemetryFresh && hasSensorReading(data) ? (
        <GlassCard className="flex items-center gap-3 border-amber-500/30 bg-amber-500/10 text-amber-100">
          <AlertTriangle size={18} />
          <span>Device telemetry is stale. Values below are not treated as live until a new upload arrives.</span>
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
              value={formatMetric(liveData?.water_temperature)}
              unit="°C"
              delta={{ direction: "flat", text: "Live" }}
            />
            <MetricCard
              icon="🧪"
              label="pH"
              value={formatMetric(liveData?.ph)}
              delta={{ direction: "flat", text: "Live" }}
            />
            <MetricCard
              icon="⚡"
              label="EC"
              value={formatMetric(liveData?.ec)}
              unit="µS/cm"
              delta={{ direction: "flat", text: "Live" }}
            />
            <MetricCard
              icon="💧"
              label="TDS"
              value={formatMetric(liveData?.tds)}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {waterSensorValid ? (
              <WaterTank percent={waterLevel.percent} state={waterLevel.state} />
            ) : (
              <GlassCard className="flex min-h-64 items-center justify-center p-5 text-center text-sm text-white/55">
                Water-level sensor data is unavailable. Check for fresh telemetry and ultrasonic sensor readings.
              </GlassCard>
            )}
            <PumpControl
              deviceId={DEVICE_ID}
              status={deviceStatus}
              loading={deviceStatusLoading}
              error={deviceStatusErrorMessage}
            />
            <DeviceOverview deviceId={DEVICE_ID} status={deviceStatus} reading={data} />
            <GlassCard className="flex flex-col justify-between gap-5 p-5">
              <div className="flex flex-wrap gap-2">
                <StatusPill label={deviceOnline ? "Device online" : "Device offline"} state={deviceOnline ? "ok" : "error"} />
                <StatusPill label={deviceStatus?.pump ? "Pump on" : "Pump off"} state={deviceStatus?.pump ? "ok" : "off"} />
              </div>
              <HealthRing percent={healthScore} label="System Health" />
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
