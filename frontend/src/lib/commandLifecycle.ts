import type { BadgeTone } from "@/components/ui/Badge";
import type { CommandStatusResponse, CommandType } from "@/types/sensor";

export const TERMINAL_COMMAND_STATUSES = new Set<CommandStatusResponse["status"]>([
  "acknowledged",
  "superseded",
  "expired",
]);

export type CommandOutcome =
  | { kind: "justQueued" }
  | { kind: "waiting" }
  | { kind: "delivered" }
  | { kind: "applied" }
  | { kind: "safetyRefused" }
  | { kind: "notApplied" }
  | { kind: "superseded" }
  | { kind: "expired" }
  | { kind: "timeout" }
  | { kind: "pollError"; message: string };

/**
 * Whether the field relevant to this command's own type (pump_state's
 * pump_state, pump_mode's manual_override) came back matching what was
 * requested. Never used alone to declare success — was_safety_refused
 * is the authoritative signal; this is the secondary, explicit
 * requested-vs-actual comparison Part 8 requires alongside it.
 */
function reachedRequestedState(data: CommandStatusResponse): boolean {
  if (!data.result) return false;
  return data.command_type === "pump_state"
    ? data.result.pump_state === data.requested.pump_state
    : data.result.manual_override === data.requested.manual_override;
}

export function describeCommandOutcome(params: {
  justQueued: boolean;
  data: CommandStatusResponse | undefined;
  timedOut: boolean;
  pollErrorMessage: string | undefined;
}): CommandOutcome {
  const { justQueued, data, timedOut, pollErrorMessage } = params;

  if (pollErrorMessage) return { kind: "pollError", message: pollErrorMessage };
  if (!data) return justQueued ? { kind: "justQueued" } : { kind: "waiting" };

  switch (data.status) {
    case "pending":
      return timedOut ? { kind: "timeout" } : { kind: "waiting" };
    case "delivered":
      return timedOut ? { kind: "timeout" } : { kind: "delivered" };
    case "superseded":
      return { kind: "superseded" };
    case "expired":
      return { kind: "expired" };
    case "acknowledged": {
      // was_safety_refused is firmware's own authoritative signal; the
      // requested-vs-actual comparison is a defensive second check, not
      // an alternate source of truth — "acknowledged" alone never
      // implies "applied as requested" (Part 8).
      if (data.result?.was_safety_refused) return { kind: "safetyRefused" };
      return reachedRequestedState(data) ? { kind: "applied" } : { kind: "notApplied" };
    }
  }
}

export function commandOutcomeMessage(
  outcome: CommandOutcome,
  requestLabel: string,
  commandType: CommandType
): string {
  switch (outcome.kind) {
    case "justQueued":
      return `${requestLabel} command queued`;
    case "waiting":
      return "Waiting for device…";
    case "delivered":
      return "Command delivered to device";
    case "applied":
      return commandType === "pump_state" ? "Pump state updated" : "Pump mode updated";
    case "safetyRefused":
      return "Command acknowledged — action blocked by safety system";
    case "notApplied":
      return "Command acknowledged — requested state was not applied";
    case "superseded":
      return "Replaced by a newer command";
    case "expired":
      return "Command expired before the device responded";
    case "timeout":
      return "Command is still pending. The device may be offline.";
    case "pollError":
      return outcome.message;
  }
}

export function commandOutcomeBadgeTone(outcome: CommandOutcome): BadgeTone {
  switch (outcome.kind) {
    case "applied":
      return "ok";
    case "safetyRefused":
    case "notApplied":
      return "danger";
    case "delivered":
      return "info";
    case "superseded":
    case "expired":
      return "idle";
    case "justQueued":
    case "waiting":
    case "timeout":
    case "pollError":
      return "warn";
  }
}
