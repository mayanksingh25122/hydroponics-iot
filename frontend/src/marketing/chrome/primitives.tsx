import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TIER_LABEL, type ClaimTier, type Limit } from "@/marketing/content/claims";

/**
 * Marketing page primitives, built only from VERDA Design Foundation
 * tokens (--color-verda-*, --radius-verda-*, --text-verda-*).
 *
 * Deliberately NOT a new design system: these compose the same tokens
 * the application shell already uses, at marketing scale. The one thing
 * they add is a display type ramp, because the app's largest heading
 * (--text-verda-display, 2.75rem) is sized for a dashboard, not a hero.
 */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-verda-mono text-verda-label uppercase tracking-[0.14em] text-verda-ink-3",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Page-level heading. Clamped rather than stepped, so it never wraps awkwardly mid-word. */
export function Display({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "text-balance font-semibold leading-[1.04] tracking-[-0.022em] text-verda-forest-900",
        "text-[clamp(2rem,5.2vw,3.5rem)]",
        className
      )}
    >
      {children}
    </h1>
  );
}

/** Standfirst under a Display. Wider measure than body, lighter colour. */
export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("max-w-[58ch] text-[1.0625rem] leading-[1.55] text-verda-ink-2", className)}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  children,
  className,
}: {
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      {eyebrow ? <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow> : null}
      <h2 className="text-balance text-[clamp(1.375rem,2.6vw,1.875rem)] font-semibold leading-[1.2] tracking-[-0.018em] text-verda-forest-900">
        {children}
      </h2>
    </div>
  );
}

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-[66ch] space-y-4 text-verda-body text-verda-ink-2", className)}>
      {children}
    </div>
  );
}

/** Vertical rhythm between page sections. One place to change it. */
export function Section({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 border-t border-verda-line-subtle py-14 tablet:py-20",
        bleed && "border-t-0",
        className
      )}
    >
      {children}
    </section>
  );
}

const TIER_CLASS: Record<ClaimTier, string> = {
  shipping: "border-verda-ok/40 bg-verda-ok/8 text-verda-ok",
  building: "border-verda-warn/40 bg-verda-warn/8 text-verda-warn",
  direction: "border-verda-info/40 bg-verda-info/8 text-verda-info",
};

/**
 * Marks which tense a claim is in. Narrative §0 separates them
 * deliberately; this is that separation made visible rather than left
 * to the reader to infer from verb tense.
 */
export function TierBadge({ tier, className }: { tier: ClaimTier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-verda-sm border px-2 py-0.5",
        "font-verda-mono text-verda-label uppercase tracking-[0.08em]",
        TIER_CLASS[tier],
        className
      )}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

/**
 * A limit stated immediately beside the claim it bounds.
 *
 * The alternative — collecting these into a "what we're honest about"
 * block at the foot of the page — reads as a disclaimer. Beside the
 * claim, the same sentence reads as confidence, which is the whole
 * argument of narrative §6.
 */
export function LimitMark({ limit, className }: { limit: Limit; className?: string }) {
  return (
    <aside
      className={cn(
        "mt-5 max-w-[60ch] rounded-r-verda-sm border-l-2 border-verda-warn bg-verda-sage-wash px-4 py-3",
        className
      )}
    >
      <p className="font-verda-mono text-verda-label uppercase tracking-[0.1em] text-verda-warn">
        {limit.heading}
      </p>
      <p className="mt-1 text-verda-caption leading-[1.6] text-verda-ink-2">{limit.body}</p>
    </aside>
  );
}

/** Flat bordered surface. Same rules as ui/Panel: no shadow, no lift. */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  return (
    <Tag className={cn("rounded-verda-md border border-verda-line bg-verda-surface p-5", className)}>
      {children}
    </Tag>
  );
}

/** Label/value list used for spec-style content. */
export function SpecList({
  items,
  className,
}: {
  items: readonly { label: string; detail: string }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-px overflow-hidden rounded-verda-md border border-verda-line bg-verda-line", className)}>
      {items.map((item) => (
        <div key={item.label} className="bg-verda-surface px-4 py-3.5">
          <dt className="text-verda-h3 font-semibold text-verda-ink">{item.label}</dt>
          <dd className="mt-0.5 text-verda-caption text-verda-ink-3">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
