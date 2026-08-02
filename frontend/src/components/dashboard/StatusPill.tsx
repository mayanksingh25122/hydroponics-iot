import { cn } from "../../lib/utils";

export type StatusState = "ok" | "warn" | "error" | "off";

export interface StatusPillProps {
  label: string;
  state: StatusState;
  className?: string;
}

const dotColor: Record<StatusState, string> = {
  ok: "bg-canopy-ok",
  warn: "bg-canopy-warn",
  error: "bg-canopy-error",
  off: "bg-white/24",
};

const textColor: Record<StatusState, string> = {
  ok: "text-white/80",
  warn: "text-white/80",
  error: "text-white/80",
  off: "text-white/40",
};

export function StatusPill({ label, state, className }: StatusPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm",
        textColor[state],
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className={cn("h-2 w-2 rounded-full", dotColor[state])} />
        {state === "ok" && (
          <span className={cn("absolute inset-0 rounded-full", dotColor[state], "animate-canopy-pulse")} />
        )}
      </span>
      {label}
    </div>
  );
}
