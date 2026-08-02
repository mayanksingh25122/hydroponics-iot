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
          "relative border border-white/10 bg-white/[0.06] backdrop-blur-glass",
          "shadow-glass",
          compact ? "rounded-canopy-sm p-4" : "rounded-canopy p-6",
          interactive &&
            "transition-all duration-300 ease-canopy cursor-pointer hover:bg-white/[0.09] hover:-translate-y-0.5 hover:shadow-glass-hover",
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
