import { cn } from "../../lib/utils";
import { GlassCard } from "../common/GlassCard";

export interface HealthRingProps {
  /** 0-100 */
  percent: number;
  label?: string;
  className?: string;
}

export function HealthRing({ percent, label = "Plant Health", className }: HealthRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <GlassCard className={cn("flex items-center gap-6", className)}>
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
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
            className="transition-[stroke-dashoffset] duration-700 ease-canopy"
          />
          <defs>
            <linearGradient id="canopy-health-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#84CC16" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/92">
          {clamped}%
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-white/56">
          <span className="text-base leading-none">🌿</span>
          <span>{label}</span>
        </div>
        <span className="text-xs text-white/40">
          {clamped >= 90 ? "Everything looks healthy." : clamped >= 70 ? "Minor attention needed." : "Needs attention soon."}
        </span>
      </div>
    </GlassCard>
  );
}
