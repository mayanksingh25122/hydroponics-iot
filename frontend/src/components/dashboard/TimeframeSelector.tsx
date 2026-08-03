import { cn } from "../../lib/utils";
import { TIMEFRAME_OPTIONS, type Timeframe } from "../../lib/chartUtils";
export interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (timeframe: Timeframe) => void;
  className?: string;
}

export function TimeframeSelector({ value, onChange, className }: TimeframeSelectorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1",
        className
      )}
    >
      {TIMEFRAME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-canopy-primary/20 text-canopy-primary"
              : "text-white/56 hover:text-white/80"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}