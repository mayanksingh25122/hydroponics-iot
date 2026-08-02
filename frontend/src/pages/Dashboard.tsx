import { Bell, Settings, User, Loader2, AlertTriangle } from "lucide-react";
import { GlassCard } from "../components/common/GlassCard";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ChartCard, type ChartPoint } from "../components/dashboard/ChartCard";
import { WaterTank, type WaterLevelState } from "../components/dashboard/WaterTank";
import { StatusPill } from "../components/dashboard/StatusPill";
import { HealthRing } from "../components/dashboard/HealthRing";
import { useLatestSensor } from "../hooks/useSensors";

const tempSeries: ChartPoint[] = [
  { t: "6am", value: 21.4 },
  { t: "8am", value: 22.1 },
  { t: "10am", value: 23.0 },
  { t: "12pm", value: 24.2 },
  { t: "2pm", value: 24.8 },
  { t: "4pm", value: 24.5 },
  { t: "now", value: 24.5 },
];

function formatMetric(value: number | undefined, fractionDigits = 1): string {
  return value !== undefined ? value.toFixed(fractionDigits) : "—";
}

/**
 * Maps the firmware's 4-state water_level enum (0-3) to a display
 * percent + WaterTank state. Adjust the enum→percent bands here if the
 * firmware's threshold semantics change.
 */
function mapWaterLevel(level: number | undefined): { percent: number; state: WaterLevelState } {
  switch (level) {
    case 3:
      return { percent: 100, state: "full" };
    case 2:
      return { percent: 70, state: "ok" };
    case 1:
      return { percent: 35, state: "low" };
    case 0:
      return { percent: 10, state: "critical" };
    default:
      return { percent: 0, state: "critical" };
  }
}

export default function Dashboard() {
  const { data, loading, error } = useLatestSensor();
  const waterLevel = mapWaterLevel(data?.water_level);

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
              <ChartCard title="Live Temperature Graph" icon="📈" data={tempSeries} unit="°C" />
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