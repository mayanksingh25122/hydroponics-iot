import { cn } from "@/lib/utils";
import { VerdaMark } from "./VerdaMark";

export interface VerdaWordmarkProps {
  className?: string;
  /** Shows the tagline beneath the wordmark. Off by default for compact contexts (e.g. sidebar header). */
  tagline?: boolean;
}

/**
 * Text half of the brand lockup, set in a heavy geometric sans —
 * deliberately not Geist, which runs the rest of the interface. See
 * the blueprint's "wordmark typography" note: the mismatch between
 * genres is why the wordmark stays an isolated, non-Geist element
 * rather than being approximated in the UI type scale.
 */
export function VerdaWordmark({ className, tagline = false }: VerdaWordmarkProps) {
  return (
    <div className={cn("leading-none", className)}>
      <div
        className="text-verda-forest-800 font-bold tracking-[0.16em]"
        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        VERDA
      </div>
      {tagline ? (
        <div className="mt-1 text-verda-caption text-verda-ink-3">From Roots to the Future.</div>
      ) : null}
    </div>
  );
}

export interface VerdaLockupProps {
  markSize?: number;
  tagline?: boolean;
  className?: string;
}

/** Mark + wordmark, side by side. The default full lockup. */
export function VerdaLockup({ markSize = 40, tagline = false, className }: VerdaLockupProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <VerdaMark size={markSize} />
      <VerdaWordmark tagline={tagline} className="text-lg" />
    </div>
  );
}
