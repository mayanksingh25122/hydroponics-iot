import { cn } from "../../lib/utils";

export type StatusState = "ok" | "warn" | "error" | "off";

export interface StatusPillProps {
  label: string;
  state: StatusState;
  className?: string;
}

const dotColor: Record<StatusState, string> = {
  ok: "bg-emerald-400",
  warn: "bg-yellow-400",
  error: "bg-red-400",
  off: "bg-white/24",
};

const glowColor: Record<StatusState, string> = {
  ok: "shadow-[0_0_10px_rgba(52,211,153,0.7)]",
  warn: "shadow-[0_0_10px_rgba(250,204,21,0.6)]",
  error: "shadow-[0_0_10px_rgba(248,113,113,0.6)]",
  off: "shadow-none",
};

const textColor: Record<StatusState, string> = {
  ok: "text-emerald-200/90",
  warn: "text-yellow-200/90",
  error: "text-red-200/90",
  off: "text-white/40",
};

const borderColor: Record<StatusState, string> = {
  ok: "border-emerald-500/25 hover:border-emerald-400/40",
  warn: "border-yellow-500/25 hover:border-yellow-400/40",
  error: "border-red-500/25 hover:border-red-400/40",
  off: "border-white/10 hover:border-white/20",
};

/**
 * Compact glass status indicator. Same StatusState union and props as
 * before — only the visual treatment changed (glass pill, glowing
 * animated dot for "ok", Dark Forest palette).
 */
export function StatusPill({ label, state, className }: StatusPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-white/[0.03] px-3.5 py-1.5 text-sm backdrop-blur-md transition-all duration-300",
        borderColor[state],
        textColor[state],
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className={cn("h-2 w-2 rounded-full", dotColor[state], glowColor[state])} />
        {state === "ok" && (
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping",
              dotColor[state],
              "opacity-60"
            )}
          />
        )}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}