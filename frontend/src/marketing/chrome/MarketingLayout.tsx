import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerdaLockup } from "@/components/brand/VerdaLockup";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Shell for every public page. Nav, footer, and the skip link.
 *
 * This is the ONLY place in src/marketing/ permitted to read auth
 * state, and it reads exactly one thing: whether a session exists, so
 * the nav can say "Dashboard" instead of "Sign in". That single
 * conditional is the entire relationship between the brand layer and
 * the product layer — an existing customer is never made to hunt for
 * the door back into the application.
 */

const NAV = [
  { to: "/tower", label: "Smart tower" },
  { to: "/farms", label: "Commercial farms" },
  { to: "/platform", label: "Platform" },
  { to: "/approach", label: "Approach" },
  { to: "/research", label: "Research" },
];

export default function MarketingLayout() {
  const status = useAuthStore((state) => state.status);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const signedIn = status === "authenticated";
  const appHref = signedIn ? "/app" : "/login";
  const appLabel = signedIn ? "Dashboard" : "Sign in";

  return (
    <div className="flex min-h-screen flex-col bg-verda-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-verda-sm focus:bg-verda-forest-800 focus:px-4 focus:py-2 focus:text-verda-canvas"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-verda-line bg-verda-canvas/92 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-6 px-4 tablet:px-6 desktop:px-8">
          <Link to="/" aria-label="VERDA — home" className="shrink-0">
            <VerdaLockup markSize={24} />
          </Link>

          <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 laptop:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-verda-sm px-3 py-1.5 text-verda-caption font-medium transition-colors duration-(--verda-motion-fast) ease-verda",
                    isActive
                      ? "bg-verda-sage-wash text-verda-forest-800"
                      : "text-verda-ink-2 hover:bg-verda-sage-wash hover:text-verda-ink"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 laptop:ml-0">
            <Link
              to="/contact"
              className="hidden rounded-verda-sm bg-verda-forest-800 px-3.5 py-1.5 text-verda-caption font-medium text-verda-canvas transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-forest-700 tablet:inline-flex"
            >
              Talk to us
            </Link>
            <Link
              to={appHref}
              className="rounded-verda-sm border border-verda-line px-3.5 py-1.5 text-verda-caption font-medium text-verda-ink-2 transition-colors duration-(--verda-motion-fast) ease-verda hover:border-verda-line-strong hover:text-verda-ink"
            >
              {appLabel}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-8 w-8 items-center justify-center rounded-verda-sm text-verda-ink-2 hover:bg-verda-sage-wash laptop:hidden"
            >
              {menuOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            aria-label="Primary, mobile"
            className="border-t border-verda-line bg-verda-canvas px-4 pb-4 pt-2 laptop:hidden"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block rounded-verda-sm px-3 py-2.5 text-verda-body font-medium text-verda-ink-2 hover:bg-verda-sage-wash hover:text-verda-ink"
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/contact"
              onClick={() => setMenuOpen(false)}
              className="mt-2 block rounded-verda-sm bg-verda-forest-800 px-3 py-2.5 text-center text-verda-body font-medium text-verda-canvas"
            >
              Talk to us
            </Link>
          </nav>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-verda-line bg-verda-surface">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-12 tablet:px-6 desktop:px-8">
          <div className="grid gap-10 tablet:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <VerdaLockup markSize={28} tagline />
              <p className="mt-4 max-w-[34ch] text-verda-caption leading-[1.6] text-verda-ink-3">
                Hydroponic systems that run themselves, and everything that keeps them running.
              </p>
            </div>

            <FooterCol
              title="Products"
              links={[
                { to: "/tower", label: "Smart tower" },
                { to: "/farms", label: "Commercial farms" },
                { to: "/platform", label: "Platform" },
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                { to: "/approach", label: "Approach" },
                { to: "/research", label: "Research" },
                { to: "/contact", label: "Contact" },
              ]}
            />
            <FooterCol
              title="Account"
              links={[
                { to: appHref, label: appLabel },
                { to: "/signup", label: "Request access" },
              ]}
            />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-verda-line-subtle pt-6">
            <p className="font-verda-mono text-verda-label text-verda-ink-3">
              © {new Date().getFullYear()} VERDA Agritech
            </p>
            <p className="max-w-[52ch] text-verda-label text-verda-ink-3">
              Claims on this site are marked by tense: running today, being built, or direction. We keep them separate on
              purpose.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <p className="font-verda-mono text-verda-label uppercase tracking-[0.12em] text-verda-ink-3">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.to + link.label}>
            <Link
              to={link.to}
              className="text-verda-caption text-verda-ink-2 transition-colors duration-(--verda-motion-fast) ease-verda hover:text-verda-trace-600"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
