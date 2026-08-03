import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { GlassCard } from "../common/GlassCard";
import { cn } from "../../lib/utils";

interface Delta {
  direction: "up" | "down" | "flat";
  text: string;
}

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  delta?: Delta;
  className?: string;
}

const deltaIcon = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export function MetricCard({
  icon,
  label,
  value,
  unit,
  delta,
  className,
}: MetricCardProps) {
  const Icon = delta ? deltaIcon[delta.direction] : Minus;

  return (
    <GlassCard
      className={cn(
        "group relative overflow-hidden transition-all duration-500 hover:-translate-y-1",
        className
      )}
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-green-400/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Top Row */}
      <div className="relative flex items-center justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 shadow-[0_0_25px_rgba(34,197,94,.20)] transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-500/20">
          <span className="text-3xl">{icon}</span>
        </div>

        {delta && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
            <Icon size={13} />
            <span>{delta.text}</span>
          </div>
        )}
      </div>

      {/* Metric */}
      <div className="relative mt-6">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-200/60">
          {label}
        </p>

        <div className="mt-2 flex items-end gap-1">
          <span className="text-4xl font-bold tracking-tight text-white">
            {value}
          </span>

          {unit && (
            <span className="mb-1 text-sm text-emerald-300/70">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Accent */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 via-green-400 to-lime-400 opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
    </GlassCard>
  );
}