import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { describePollError } from "@/services/api";
import { getCommandStatus } from "@/services/sensorService";
import { describeCommandOutcome, TERMINAL_COMMAND_STATUSES } from "@/lib/commandLifecycle";
import type { CommandOutcome } from "@/lib/commandLifecycle";
import type { CommandStatusResponse, CommandType } from "@/types/sensor";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 75_000;

export interface CommandTracker {
  commandId: number | null;
  outcome: CommandOutcome;
  /** Start tracking a freshly-queued command_id. Replaces any command this tracker was already following. */
  track: (commandId: number) => void;
  /** Stop tracking and clear all state — e.g. once the terminal-state message has been acknowledged by the user. */
  reset: () => void;
}

/**
 * Polls GET /api/devices/{id}/commands/{command_id} for one in-flight
 * command until it reaches a terminal state (acknowledged/superseded/
 * expired) or a timeout elapses. One hook instance == one polling loop
 * for one control; pump-state and pump-mode tracking must use separate
 * instances (Part 7) so a supersede/expiry in one never touches the
 * other's query key or interval.
 */
export function useCommandTracker(deviceId: number, commandType: CommandType): CommandTracker {
  const [commandId, setCommandId] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const query = useQuery<CommandStatusResponse, Error>({
    queryKey: ["devices", deviceId, "commands", commandType, commandId],
    queryFn: () => getCommandStatus(deviceId, commandId as number),
    enabled: commandId !== null,
    staleTime: 0,
    // Bounded retries only (never infinite) for a transient network
    // blip during one poll attempt — the interval below keeps trying on
    // its own schedule regardless, so this just smooths over a single
    // dropped request rather than flashing an error for it.
    retry: 2,
    refetchInterval: (q) => {
      if (timedOut) return false;
      // A 404 here means the command (or its device) no longer exists —
      // re-polling the same id will never produce a different answer.
      if (axios.isAxiosError(q.state.error) && q.state.error.response?.status === 404) {
        return false;
      }
      const status = q.state.data?.status;
      if (status && TERMINAL_COMMAND_STATUSES.has(status)) return false;
      return POLL_INTERVAL_MS;
    },
  });

  // Timeout watchdog: independent of the poll interval itself so it
  // still fires even if every individual poll attempt is failing.
  useEffect(() => {
    if (commandId === null) return;
    if (query.data && TERMINAL_COMMAND_STATUSES.has(query.data.status)) return;

    const intervalId = window.setInterval(() => {
      if (startedAtRef.current !== null && Date.now() - startedAtRef.current >= POLL_TIMEOUT_MS) {
        setTimedOut(true);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [commandId, query.data]);

  const track = (id: number) => {
    startedAtRef.current = Date.now();
    setTimedOut(false);
    setCommandId(id);
  };

  const reset = () => {
    startedAtRef.current = null;
    setTimedOut(false);
    setCommandId(null);
  };

  const justQueued = commandId !== null && query.data === undefined && !query.isError;

  const outcome = describeCommandOutcome({
    justQueued,
    data: query.data,
    timedOut,
    pollErrorMessage: query.isError ? describePollError(query.error) : undefined,
  });

  return { commandId, outcome, track, reset };
}
