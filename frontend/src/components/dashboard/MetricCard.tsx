import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GlassCard } from "../common/GlassCard";

export interface MetricCardProps {
  /** Domain emoji per the brand identity system: 🌡 💧 🧪 ⚡ */
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  /** e.g. "+0.6°C Today" — omit if there's nothing to compare against */
  delta?: {
    direction: "up" | "down" | "flat";
    text: string;
  };
  className?: string;
}

const deltaColor: Record<"up" | "down" | "flat", string> = {
  up: "text-canopy-primary",
  down: "text-canopy-error",
  flat: "text-white/40",
};

const deltaArrow: Record<"up" | "down" | "flat", string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

/**
 * Single-metric readout card, e.g. Temperature 24.5°C ↑ +0.6°C Today.
 * Used in the top strip of the dashboard.
 */
export function MetricCard({ icon, label, value, unit, delta, className }: MetricCardProps) {
  return (
    <GlassCard className={cn("flex flex-col gap-3 animate-canopy-rise", className)}>
      <div className="flex items-center gap-2 text-sm text-white/56">
        <span className="text-base leading-none">{icon}</span>
        <span>{label}</span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-white/92">{value}</span>
        {unit && <span className="text-base text-white/40">{unit}</span>}
      </div>

      {delta && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", deltaColor[delta.direction])}>
          <span>{deltaArrow[delta.direction]}</span>
          <span>{delta.text}</span>
        </div>
      )}
    </GlassCard>
  );
}
