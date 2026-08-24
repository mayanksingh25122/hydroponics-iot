import { Loader2, Power, TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../common/Button";
import { GlassCard } from "../common/GlassCard";
import { getApiErrorMessage } from "@/services/api";
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
  const refreshDeviceState = async () => {
    await queryClient.refetchQueries({
      queryKey: ["devices", deviceId, "status"],
      type: "active",
    });
    await queryClient.invalidateQueries({ queryKey: ["sensors", "latest"] });
  };

  const pumpMutation = useMutation({
    mutationFn: (state: boolean) => setPumpState(deviceId, state),
    onSuccess: refreshDeviceState,
  });
  const modeMutation = useMutation({
    mutationFn: (mode: "auto" | "manual") => setPumpMode(deviceId, mode),
    onSuccess: refreshDeviceState,
  });

  const pending = pumpMutation.isPending || modeMutation.isPending;
  const actionError = pumpMutation.error ?? modeMutation.error;
  const actionErrorMessage = actionError ? getApiErrorMessage(actionError) : undefined;
  const mode = status?.manualOverride ? "MANUAL" : "AUTO";
  const pumpCommandDisabled = pending || status?.manualOverride === false;

  const handlePumpCommand = (state: boolean) => {
    console.info("[PUMP] Button clicked", state ? "TURN ON" : "TURN OFF");
    pumpMutation.mutate(state);
  };

  const handleModeChange = (nextMode: "auto" | "manual") => {
    console.info("[PUMP] Button clicked", nextMode.toUpperCase());
    modeMutation.mutate(nextMode);
  };

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
          disabled={pending}
          onClick={() => handleModeChange("auto")}
        >
          AUTO
        </Button>
        <Button
          className="flex-1"
          variant={mode === "MANUAL" ? "primary" : "ghost"}
          size="sm"
          disabled={pending}
          onClick={() => handleModeChange("manual")}
        >
          MANUAL
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          disabled={pumpCommandDisabled}
          onClick={() => handlePumpCommand(true)}
        >
          {pumpMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
          TURN ON
        </Button>
        <Button
          variant="danger"
          disabled={pumpCommandDisabled}
          onClick={() => handlePumpCommand(false)}
        >
          {pumpMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
          TURN OFF
        </Button>
      </div>

      {status?.manualOverride === false && !loading ? (
        <p className="text-xs text-amber-200/80">Select MANUAL before requesting pump ON or OFF. Tank-full safety remains active.</p>
      ) : null}
      {!status && !loading ? (
        <p className="text-xs text-amber-200/80">Device status is unavailable. Commands remain available; the ESP32 switches to MANUAL mode when it accepts a pump command.</p>
      ) : null}
      {error || actionErrorMessage ? (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <TriangleAlert size={15} />
          {actionErrorMessage ?? error}
        </p>
      ) : null}
    </GlassCard>
  );
}
