import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "ok" | "warn" | "danger" | "info" | "idle";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Leading status dot — the junction-node motif from the mark. */
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  ok: "bg-verda-ok/10 text-verda-ok",
  warn: "bg-verda-warn/10 text-verda-warn",
  danger: "bg-verda-danger/10 text-verda-danger",
  info: "bg-verda-info/10 text-verda-info",
  idle: "bg-verda-idle/10 text-verda-idle",
};

const dotClasses: Record<BadgeTone, string> = {
  ok: "bg-verda-ok",
  warn: "bg-verda-warn",
  danger: "bg-verda-danger",
  info: "bg-verda-info",
  idle: "bg-verda-idle",
};

/**
 * Semantic state chip. Tone is separate from the brand accent by
 * design — see the blueprint's "why success and brand are different
 * greens" note. Not yet wired into any page.
 */
export function Badge({ className, tone = "idle", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-verda-sm px-2 py-0.5",
        "font-verda-mono text-verda-label font-medium uppercase tracking-wider",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[tone])} /> : null}
      {children}
    </span>
  );
}
