import { useEffect } from "react";
import { Loader2, Power, TriangleAlert } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../common/Button";
import { GlassCard } from "../common/GlassCard";
import { Badge } from "../ui/Badge";
import { getApiErrorMessage } from "@/services/api";
import { setPumpMode, setPumpState } from "@/services/sensorService";
import { useCommandTracker } from "@/hooks/useCommandTracker";
import { commandOutcomeBadgeTone, commandOutcomeMessage } from "@/lib/commandLifecycle";
import type { CommandOutcome } from "@/lib/commandLifecycle";
import type { DeviceStatus } from "@/types/sensor";

interface PumpControlProps {
  deviceId: number;
  status?: DeviceStatus;
  loading: boolean;
  error?: string;
}

/** True once a command has been acknowledged, one way or another — the only point a fresh device-status read is worth paying for. */
function isSettled(outcome: CommandOutcome): boolean {
  return outcome.kind === "applied" || outcome.kind === "safetyRefused" || outcome.kind === "notApplied";
}

function CommandStatusLine({ outcome, requestLabel, commandType }: {
  outcome: CommandOutcome;
  requestLabel: string;
  commandType: "pump_state" | "pump_mode";
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge tone={commandOutcomeBadgeTone(outcome)} dot />
      <span className="text-white/60">{commandOutcomeMessage(outcome, requestLabel, commandType)}</span>
    </div>
  );
}

export function PumpControl({ deviceId, status, loading, error }: PumpControlProps) {
  const queryClient = useQueryClient();

  const pumpTracker = useCommandTracker(deviceId, "pump_state");
  const modeTracker = useCommandTracker(deviceId, "pump_mode");

  // Refresh confirmed device state once a command is actually settled —
  // never on queue alone, which would suggest the pump/mode changed
  // before the ESP32 has done anything at all.
  const pumpSettled = isSettled(pumpTracker.outcome);
  const modeSettled = isSettled(modeTracker.outcome);

  useEffect(() => {
    if (!pumpSettled) return;
    queryClient.refetchQueries({ queryKey: ["devices", deviceId, "status"], type: "active" });
    queryClient.invalidateQueries({ queryKey: ["sensors", "latest"] });
  }, [pumpSettled, pumpTracker.commandId, queryClient, deviceId]);

  useEffect(() => {
    if (!modeSettled) return;
    queryClient.refetchQueries({ queryKey: ["devices", deviceId, "status"], type: "active" });
    queryClient.invalidateQueries({ queryKey: ["sensors", "latest"] });
  }, [modeSettled, modeTracker.commandId, queryClient, deviceId]);

  const pumpMutation = useMutation({
    mutationFn: (state: boolean) => setPumpState(deviceId, state),
    onSuccess: (response) => pumpTracker.track(response.command_id),
  });
  const modeMutation = useMutation({
    mutationFn: (mode: "auto" | "manual") => setPumpMode(deviceId, mode),
    onSuccess: (response) => modeTracker.track(response.command_id),
  });

  const mode = status?.manualOverride ? "MANUAL" : "AUTO";

  // Only the in-flight POST itself blocks the buttons — once a command
  // is queued, the control re-enables so the user can intentionally
  // issue a newer one (which supersedes the pending command server-side).
  // Pump-state and pump-mode disablement are deliberately independent
  // (Part 7): sending a mode change must never lock out the ON/OFF
  // buttons, and vice versa.
  const pumpCommandDisabled = pumpMutation.isPending || status?.manualOverride === false;
  const modeCommandDisabled = modeMutation.isPending;

  const pumpErrorMessage = pumpMutation.error ? getApiErrorMessage(pumpMutation.error) : undefined;
  const modeErrorMessage = modeMutation.error ? getApiErrorMessage(modeMutation.error) : undefined;

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

      <div className="space-y-2">
        <div className="flex gap-2 rounded-xl bg-white/[0.04] p-1">
          <Button
            className="flex-1"
            variant={mode === "AUTO" ? "primary" : "ghost"}
            size="sm"
            disabled={modeCommandDisabled}
            onClick={() => modeMutation.mutate("auto")}
          >
            {modeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            AUTO
          </Button>
          <Button
            className="flex-1"
            variant={mode === "MANUAL" ? "primary" : "ghost"}
            size="sm"
            disabled={modeCommandDisabled}
            onClick={() => modeMutation.mutate("manual")}
          >
            {modeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            MANUAL
          </Button>
        </div>
        {modeTracker.commandId !== null ? (
          <CommandStatusLine
            outcome={modeTracker.outcome}
            requestLabel={modeMutation.variables === "manual" ? "MANUAL mode" : "AUTO mode"}
            commandType="pump_mode"
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <Button disabled={pumpCommandDisabled} onClick={() => pumpMutation.mutate(true)}>
            {pumpMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            TURN ON
          </Button>
          <Button variant="danger" disabled={pumpCommandDisabled} onClick={() => pumpMutation.mutate(false)}>
            {pumpMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            TURN OFF
          </Button>
        </div>
        {pumpTracker.commandId !== null ? (
          <CommandStatusLine
            outcome={pumpTracker.outcome}
            requestLabel={pumpMutation.variables ? "Pump ON" : "Pump OFF"}
            commandType="pump_state"
          />
        ) : null}
      </div>

      {status?.manualOverride === false && !loading ? (
        <p className="text-xs text-amber-200/80">Select MANUAL before requesting pump ON or OFF. Tank-full safety remains active.</p>
      ) : null}
      {!status && !loading ? (
        <p className="text-xs text-amber-200/80">Device status is unavailable. Commands remain available; the ESP32 switches to MANUAL mode when it accepts a pump command.</p>
      ) : null}
      {pumpErrorMessage || modeErrorMessage || error ? (
        <p className="flex items-center gap-2 text-sm text-red-300">
          <TriangleAlert size={15} />
          {pumpErrorMessage ?? modeErrorMessage ?? error}
        </p>
      ) : null}
    </GlassCard>
  );
}
