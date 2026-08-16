import { Loader2, Power, TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../common/Button";
import { GlassCard } from "../common/GlassCard";
import { setPumpMode, setPumpState } from "@/services/sensorService";
import type { DeviceStatus } from "@/types/sensor";

interface PumpControlProps {
  deviceId: number;
  status?: DeviceStatus;
  loading: boolean;
  error?: string;
}

export function PumpControl({ deviceId, status, loading, error }: PumpControlProps) {
  const queryClient = useQueryClient();
  const invalidateDeviceState = () => {
    void queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "status"] });
    void queryClient.invalidateQueries({ queryKey: ["sensors", "latest"] });
  };

  const pumpMutation = useMutation({
    mutationFn: (state: boolean) => setPumpState(deviceId, state),
    onSuccess: invalidateDeviceState,
  });
  const modeMutation = useMutation({
    mutationFn: (mode: "auto" | "manual") => setPumpMode(deviceId, mode),
    onSuccess: invalidateDeviceState,
  });

  const pending = pumpMutation.isPending || modeMutation.isPending;
  const actionError = pumpMutation.error ?? modeMutation.error;
  const mode = status?.manualOverride ? "MANUAL" : "AUTO";

  return (
    <GlassCard className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white/90">Pump Control</h2>
          <p className="mt-1 text-sm text-white/50">Confirmed directly by the ESP32</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            status?.pump ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
          }`}
        >
          {status?.pump ? "● ON" : "● OFF"}
        </span>
      </div>

      <div className="flex gap-2 rounded-xl bg-white/[0.04] p-1">
        <Button
          className="flex-1"
          variant={mode === "AUTO" ? "primary" : "ghost"}
          size="sm"
          disabled={pending || loading}
          onClick={() => modeMutation.mutate("auto")}
        >
          AUTO
        </Button>
        <Button
          className="flex-1"
          variant={mode === "MANUAL" ? "primary" : "ghost"}
          size="sm"
          disabled={pending || loading}
          onClick={() => modeMutation.mutate("manual")}
        >
          MANUAL
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          disabled={pending || loading || !status?.manualOverride}
          onClick={() => pumpMutation.mutate(true)}
        >
          {pumpMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
          TURN ON
        </Button>
        <Button
          variant="danger"
          disabled={pending || loading || !status?.manualOverride}
          onClick={() => pumpMutation.mutate(false)}
        >
          {pumpMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
          TURN OFF
        </Button>
      </div>

      {!status?.manualOverride && !loading ? (
        <p className="text-xs text-amber-200/80">Select MANUAL before requesting pump ON or OFF. Tank-full safety remains active.</p>
      ) : null}
      {error || actionError ? (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <TriangleAlert size={15} />
          {error ?? "Unable to reach device."}
        </p>
      ) : null}
    </GlassCard>
  );
}
