import { lazy, Suspense, useEffect, useState } from "react";

/**
 * Hosts the vendored React Bits SplashCursor.
 *
 * The wrapper exists to correct three things about the upstream
 * component without forking it, so the vendored file stays
 * byte-identical to the registry and can be re-installed cleanly:
 *
 * 1. It renders a fixed layer at `z-index: 50`. The marketing header is
 *    `z-40`, so upstream would paint its splashes OVER the navigation.
 *    Wrapping it in a container that creates its own stacking context
 *    (`isolation: isolate`) confines that 50 to this layer, and the
 *    layer itself sits below the header.
 *
 * 2. Its canvas is sized `100vw`, which on any page with a visible
 *    scrollbar is wider than the viewport and introduces a horizontal
 *    scroll. `overflow: hidden` on the container clips it.
 *
 * 3. It is a ~1,000-line WebGL2 fluid simulation, so it is lazy-loaded
 *    and skipped entirely for `prefers-reduced-motion` — a continuously
 *    animating cursor trail is exactly what that setting is for.
 */
const SplashCursor = lazy(() => import("@/components/vendor/SplashCursor"));

export interface SplashCursorLayerProps {
  /** Only has any effect because RAINBOW_MODE is forced off below. */
  color?: string;
}

export function SplashCursorLayer({ color = "#55f7bc" }: SplashCursorLayerProps) {
  const [enabled, setEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setEnabled(!event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10,
        isolation: "isolate",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <Suspense fallback={null}>
        {/*
          RAINBOW_MODE must be false for COLOR to do anything at all:
          upstream's generateColor() returns a random hue whenever it is
          on, and it defaults to on. Passing COLOR by itself is silently
          ignored.
        */}
        <SplashCursor RAINBOW_MODE={false} COLOR={color} />
      </Suspense>
    </div>
  );
}
