import { cn } from "../../lib/utils";
import { GlassCard } from "../common/GlassCard";

export interface HealthRingProps {
  /** 0-100 */
  percent: number;
  label?: string;
  className?: string;
}

/**
 * Circular plant-health gauge. Props unchanged — percent, optional
 * label, optional className. Visual upgrade only: Dark Forest gradient
 * ring, ambient glow, larger/bolder readout typography.
 */
export function HealthRing({ percent, label = "Plant Health", className }: HealthRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const statusText =
    clamped >= 90
      ? "Everything looks healthy."
      : clamped >= 70
      ? "Minor attention needed."
      : "Needs attention soon.";

  const statusColor =
    clamped >= 90 ? "text-emerald-300/80" : clamped >= 70 ? "text-yellow-300/80" : "text-red-300/80";

  return (
    <GlassCard
      className={cn(
        "group relative flex items-center gap-6 overflow-hidden transition-all duration-500 hover:-translate-y-1",
        className
      )}
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-lime-400/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90 drop-shadow-[0_0_18px_rgba(34,197,94,0.25)]">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="url(#canopy-health-gradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
          <defs>
            <linearGradient id="canopy-health-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="50%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#84CC16" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white drop-shadow-lg">
          {clamped}%
        </div>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-emerald-200/60">
          <span className="text-base leading-none">🌿</span>
          <span>{label}</span>
        </div>
        <span className={cn("text-sm font-medium", statusColor)}>{statusText}</span>
      </div>
    </GlassCard>
  );
}