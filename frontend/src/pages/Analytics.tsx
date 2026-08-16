import { AlertTriangle, BarChart3, Loader2 } from "lucide-react";
import { GlassCard } from "../components/common/GlassCard";
import { LiveChart } from "../components/dashboard/LiveChart";
import { TimeframeSelector } from "../components/dashboard/TimeframeSelector";
import { useSensorHistory } from "../hooks/useSensors";
import { filterHistoryByTimeframe, type Timeframe } from "../lib/chartUtils";
import { useMemo, useState } from "react";

function range(values: number[]): string {
  if (!values.length) return "No data";
  return `${Math.min(...values).toFixed(1)} – ${Math.max(...values).toFixed(1)}`;
}

export default function Analytics() {
  const [timeframe, setTimeframe] = useState<Timeframe>("24h");
  const { data: history, loading, error } = useSensorHistory();
  const data = useMemo(() => filterHistoryByTimeframe(history ?? [], timeframe), [history, timeframe]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-emerald-300/60">VERDA Sense</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-white/92"><BarChart3 size={22} /> Sensor analytics</h1>
          <p className="mt-2 text-sm text-white/50">Historical telemetry received from the selected device.</p>
        </div>
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      </div>

      {loading ? <GlassCard className="flex items-center justify-center gap-3 py-12 text-white/65"><Loader2 size={19} className="animate-spin" /> Loading sensor history…</GlassCard> : null}
      {error ? <GlassCard className="flex items-center gap-3 border-red-500/30 bg-red-500/10 text-red-200"><AlertTriangle size={18} /> Unable to load history: {error.message}</GlassCard> : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Temperature", range(data.map((r) => r.water_temperature)), "°C"],
              ["pH", range(data.map((r) => r.ph)), ""],
              ["EC", range(data.map((r) => r.ec)), "µS/cm"],
              ["Water distance", range(data.map((r) => r.water_level)), "cm"],
            ].map(([label, value, unit]) => (
              <GlassCard key={label} className="p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">{label} range</p>
                <p className="mt-2 text-lg font-semibold text-white/90">{value} <span className="text-sm font-normal text-white/50">{unit}</span></p>
              </GlassCard>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LiveChart title="Temperature" dataKey="water_temperature" data={data} color="#34D399" unit=" °C" />
            <LiveChart title="pH" dataKey="ph" data={data} color="#A78BFA" />
            <LiveChart title="EC" dataKey="ec" data={data} color="#60A5FA" unit=" µS/cm" />
            <LiveChart title="Water level" dataKey="water_level" data={data} color="#38BDF8" unit=" cm" />
          </div>

          <GlassCard className="p-5 text-sm text-white/55">
            Humidity, target ranges, and longer-term reporting are not displayed because the current API does not provide them. The existing history endpoint returns its latest 100 readings; add server-side date-range filtering before enabling reliable 7-day or 30-day analysis.
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}
