import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Border + background tint on hover. No lift, no scale — ever. */
  interactive?: boolean;
  /** Tighter padding for dense contexts (list rows, compact tiles). */
  compact?: boolean;
}

/**
 * Flat white-on-canvas surface — the VERDA base for every card, panel,
 * and tile. Depth comes from the 1px border and canvas/surface value
 * contrast, never from a shadow: static panels carry no shadow at all.
 *
 * Not yet wired into any page — existing screens still use GlassCard.
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, interactive = false, compact = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-verda-md border border-verda-line bg-verda-surface",
          compact ? "p-4" : "p-5",
          "transition-colors duration-(--verda-motion-fast) ease-verda",
          interactive && "hover:border-verda-trace-600/40 hover:bg-verda-sage-wash",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Panel.displayName = "Panel";
