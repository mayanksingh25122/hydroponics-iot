import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Gutter and scroll behaviour for every non-homepage marketing page.
 *
 * Also restores scroll position to the top on navigation: react-router
 * does not do this, and landing halfway down a new page is the single
 * most common SPA papercut on a content site.
 */
export function PageShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    // "instant" rather than smooth — a page change is a cut, not a move,
    // and smooth-scrolling a fresh page reads as a glitch.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 tablet:px-6 desktop:px-8">{children}</div>
  );
}
