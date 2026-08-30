import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { PageContainer } from "@/components/ui/PageContainer";
import { Topbar } from "./Topbar";
import { VerdaSidebar } from "./VerdaSidebar";

/**
 * Root shell for every authenticated-style route (currently
 * Dashboard, Analytics, Settings — Login and NotFound render
 * standalone, same as before). Replaces PageLayout.
 *
 * Responsive behavior:
 *  - >=1024px (laptop:) — persistent full sidebar with labels
 *  - 768-1023px (tablet:) — persistent icon-only rail
 *  - <768px — sidebar hidden; hamburger in Topbar opens a drawer
 *
 * Page content itself is unchanged in this task — Dashboard.tsx
 * still renders its own inline header, so it will visually stack
 * with this Topbar until a later task migrates page content to the
 * new shell. This is a deliberate, temporary interim state.
 */
export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  function openMobileNav() {
    setMobileNavOpen(true);
  }

  function handleDrawerClose() {
    setMobileNavOpen(false);
    // Return focus to the trigger that opened the drawer — every
    // close path (Escape, backdrop click, nav-link activation) goes
    // through this one function so focus restoration is consistent.
    menuButtonRef.current?.focus();
  }

  // Escape closes the drawer; lock body scroll while it's open.
  useEffect(() => {
    if (!mobileNavOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleDrawerClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    // Move focus into the drawer for keyboard users.
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-verda-canvas">
      <VerdaSidebar mode="full" className="hidden laptop:flex" />
      <VerdaSidebar mode="rail" className="hidden tablet:flex laptop:hidden" />

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 tablet:hidden" role="presentation">
          <div
            className="absolute inset-0 bg-verda-forest-900/40 animate-in fade-in duration-(--verda-motion-base)"
            onClick={handleDrawerClose}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative h-full animate-in slide-in-from-left-8 fade-in duration-(--verda-motion-slow) ease-verda"
          >
            <VerdaSidebar mode="full" onNavigate={handleDrawerClose} className="shadow-verda-2" />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={openMobileNav} menuButtonRef={menuButtonRef} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <PageContainer>
            <Outlet />
          </PageContainer>
        </main>
      </div>
    </div>
  );
}
