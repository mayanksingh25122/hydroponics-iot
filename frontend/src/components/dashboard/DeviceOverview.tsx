import { Activity, Clock3, Cpu, Droplets, WifiOff } from "lucide-react";
import { GlassCard } from "../common/GlassCard";
import { deviceIsOnline, formatLastUpdate, isTelemetryFresh } from "@/lib/deviceHealth";
import type { DeviceStatus, SensorReading } from "@/types/sensor";

interface DeviceOverviewProps {
  deviceId: number;
  status?: DeviceStatus;
  reading?: SensorReading;
}

export function DeviceOverview({ deviceId, status, reading }: DeviceOverviewProps) {
  const online = deviceIsOnline(status, reading);
  const fresh = isTelemetryFresh(reading);

  return (
    <GlassCard className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-200/50">Device</p>
          <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-white/90">
            <Cpu size={17} className="text-emerald-300" />
            VERDA-{String(deviceId).padStart(3, "0")}
          </h2>
        </div>
        <span className={online ? "text-emerald-300" : "text-red-300"}>
          {online ? <Activity size={19} /> : <WifiOff size={19} />}
        </span>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-white/50">Connectivity</dt>
          <dd className={online ? "font-medium text-emerald-300" : "font-medium text-red-300"}>
            {online ? "Online" : "Offline / stale"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 text-white/50"><Clock3 size={14} /> Last update</dt>
          <dd className="max-w-[150px] text-right text-xs text-white/75">{formatLastUpdate(reading)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 text-white/50"><Droplets size={14} /> Pump state</dt>
          <dd className="font-medium text-white/85">{status ? (status.pump ? "ON" : "OFF") : "Unavailable"}</dd>
        </div>
      </dl>

      {!fresh ? <p className="text-xs text-amber-200/80">Telemetry is older than 20 seconds and is not shown as live.</p> : null}
      <p className="border-t border-white/8 pt-3 text-xs text-white/40">Fan and grow-light telemetry are not available from the current backend.</p>
    </GlassCard>
  );
}
