import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift + glow on hover. Use for interactive/clickable cards. */
  interactive?: boolean;
  /** Tighter radius + padding for compact contexts (e.g. list rows). */
  compact?: boolean;
}

/**
 * Base glass surface for Canopy. Every card, panel, and modal in the
 * platform composes on top of this.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive = false, compact = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
  "rounded-3xl",
  "border border-emerald-500/15",
  "bg-[#0A1D12]/70",
  "backdrop-blur-xl",
  "shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
  "transition-all duration-300",
  "hover:border-emerald-400/30",
  "hover:shadow-[0_0_35px_rgba(34,197,94,0.12)]",
  className
)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";
