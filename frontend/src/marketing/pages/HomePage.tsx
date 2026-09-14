import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TowerScene } from "@/marketing/scene/TowerScene";
import { observeScrollProgress } from "@/marketing/scene/useScrollStory";
import { ACTS } from "@/marketing/content/acts";
import { LimitMark, TierBadge } from "@/marketing/chrome/primitives";
import { cn } from "@/lib/utils";

/**
 * The cinematic homepage.
 *
 * Structure: a fixed WebGL canvas behind a column of ordinary
 * <section> elements. The canvas is aria-hidden and purely decorative —
 * every word of the narrative is real DOM, in document order, so a
 * screen reader and a crawler both receive the complete story with the
 * 3D removed. That is the same requirement served twice, which is why
 * neither is an afterthought.
 *
 * The acts table in content/acts.ts drives BOTH the copy below and the
 * scene's rotation schedule, so the words and the object cannot drift
 * out of sync.
 */
export default function HomePage() {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => observeScrollProgress(), []);

  return (
    <div className="relative">
      <TowerScene reducedMotion={reducedMotion} />

      <div className="relative z-10">
        {ACTS.map((act, position) => (
          <section
            key={act.id}
            id={act.id}
            aria-labelledby={`${act.id}-heading`}
            className={cn(
              "flex min-h-[100svh] items-center",
              // The opening act sits slightly higher so the tower's cap
              // is not crowded by the sticky header on short viewports.
              position === 0 ? "pt-8 pb-24" : "py-24"
            )}
          >
            <div className="mx-auto w-full max-w-[1240px] px-4 tablet:px-6 desktop:px-8">
              <div
                className={cn(
                  "max-w-[36rem] rounded-verda-md p-5 tablet:p-6",
                  // A token-coloured scrim guarantees the 4.5:1 contrast
                  // floor over a moving render, where the backdrop
                  // behind any given line cannot be known in advance.
                  "bg-verda-canvas/78 backdrop-blur-[3px]",
                  // Later acts sit right of the tower so the object is
                  // never permanently occluded on one side.
                  position >= 4 && "laptop:ml-auto"
                )}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-verda-mono text-verda-label tracking-[0.14em] text-verda-ink-3">
                    {String(act.index).padStart(2, "0")} — {act.name.toUpperCase()}
                  </span>
                  <TierBadge tier={act.tier} />
                </div>

                <h2
                  id={`${act.id}-heading`}
                  className="text-balance text-[clamp(1.5rem,3.4vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-verda-forest-900"
                >
                  {act.headline}
                </h2>

                <div className="mt-4 space-y-3">
                  {act.body.map((paragraph) => (
                    <p key={paragraph} className="text-verda-body leading-[1.6] text-verda-ink-2">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {act.limit ? <LimitMark limit={act.limit} /> : null}

                {act.id === "two-products" ? (
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Link
                      to="/tower"
                      className="rounded-verda-sm bg-verda-forest-800 px-4 py-2 text-verda-caption font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700"
                    >
                      Grow with VERDA
                    </Link>
                    <Link
                      to="/farms"
                      className="rounded-verda-sm border border-verda-line-strong px-4 py-2 text-verda-caption font-medium text-verda-ink transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-sage-wash"
                    >
                      Build with VERDA
                    </Link>
                  </div>
                ) : null}

                {act.id === "destination" ? (
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Link
                      to="/contact"
                      className="rounded-verda-sm bg-verda-forest-800 px-4 py-2 text-verda-caption font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700"
                    >
                      Talk to us
                    </Link>
                    <Link
                      to="/platform"
                      className="rounded-verda-sm border border-verda-line-strong px-4 py-2 text-verda-caption font-medium text-verda-ink transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-sage-wash"
                    >
                      See what runs today
                    </Link>
                  </div>
                ) : null}

                <p className="mt-5 font-verda-mono text-verda-label text-verda-ink-3">
                  Narrative {act.source}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
