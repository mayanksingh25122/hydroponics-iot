import { cn } from "../../lib/utils";
import { GlassCard } from "../common/GlassCard";

export type WaterLevelState = "full" | "ok" | "low" | "critical";

export interface WaterTankProps {
  /** 0-100 */
  percent: number;
  state: WaterLevelState;
  className?: string;
}

const stateColor: Record<WaterLevelState, string> = {
  full: "from-canopy-primary to-canopy-accent",
  ok: "from-canopy-primary to-canopy-accent",
  low: "from-canopy-warn to-canopy-secondary",
  critical: "from-canopy-error to-red-400",
};

const stateLabel: Record<WaterLevelState, string> = {
  full: "Full",
  ok: "Good",
  low: "Low — refill soon",
  critical: "Critical — refill now",
};

export function WaterTank({ percent, state, className }: WaterTankProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <GlassCard className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-sm text-white/56">
        <span className="text-base leading-none">💧</span>
        <span>Water Tank</span>
      </div>

      <div className="relative h-40 w-full overflow-hidden rounded-canopy-sm border border-white/10 bg-white/[0.03]">
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t transition-[height] duration-700 ease-canopy",
            stateColor[state]
          )}
          style={{ height: `${clamped}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            {clamped}%
          </span>
        </div>
      </div>

      <span
        className={cn(
          "text-xs font-medium",
          state === "critical" ? "text-canopy-error" : state === "low" ? "text-canopy-warn" : "text-white/56"
        )}
      >
        {stateLabel[state]}
      </span>
    </GlassCard>
  );
}
