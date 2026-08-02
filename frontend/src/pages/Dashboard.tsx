import { Bell, Settings, User } from "lucide-react";
import { GlassCard } from "../components/common/GlassCard";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ChartCard, type ChartPoint } from "../components/dashboard/ChartCard";
import { WaterTank } from "../components/dashboard/WaterTank";
import { StatusPill } from "../components/dashboard/StatusPill";
import { HealthRing } from "../components/dashboard/HealthRing";

const tempSeries: ChartPoint[] = [
  { t: "6am", value: 21.4 },
  { t: "8am", value: 22.1 },
  { t: "10am", value: 23.0 },
  { t: "12pm", value: 24.2 },
  { t: "2pm", value: 24.8 },
  { t: "4pm", value: 24.5 },
  { t: "now", value: 24.5 },
];

export default function Dashboard() {
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard icon="🌡" label="Temperature" value="24.5" unit="°C" delta={{ direction: "up", text: "+0.6°C Today" }} />
        <MetricCard icon="💧" label="Humidity" value="71" unit="%" delta={{ direction: "flat", text: "Stable" }} />
        <MetricCard icon="🧪" label="pH" value="6.3" delta={{ direction: "down", text: "-0.1 Today" }} />
        <MetricCard icon="⚡" label="EC" value="780" unit="ppm" delta={{ direction: "up", text: "+20ppm Today" }} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Live Temperature Graph" icon="📈" data={tempSeries} unit="°C" />
        </div>
        <WaterTank percent={71} state="ok" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <StatusPill label="Pump" state="ok" />
          <StatusPill label="ESP32" state="ok" />
          <StatusPill label="WiFi" state="ok" />
          <StatusPill label="Lights" state="warn" />
        </GlassCard>
        <HealthRing percent={98} />
      </div>
    </div>
  );
}
