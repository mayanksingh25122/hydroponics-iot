import { Bell, Menu, User } from "lucide-react";
import type { RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/store/useAuthStore";
import { ROUTE_LABELS } from "./navConfig";

export interface TopbarProps {
  onMenuClick: () => void;
  /** Attached to the hamburger button so AppShell can restore focus to it when the drawer closes. */
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Compact technical topbar: page context (from the actual route),
 * a static system-status placeholder, and notification/account
 * placeholders. System status is NOT live — see the inline note
 * below; a future task wires it to GET /health.
 */
export function Topbar({ onMenuClick, menuButtonRef }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const pageLabel = ROUTE_LABELS[location.pathname] ?? "VERDA";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-verda-line bg-verda-surface px-4 tablet:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="flex h-8 w-8 items-center justify-center rounded-verda-sm text-verda-ink-2 transition-colors duration-(--verda-motion-fast) ease-verda hover:bg-verda-sage-wash tablet:hidden"
        >
          <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-verda-h3 font-semibold text-verda-ink">{pageLabel}</h1>
          <p className="font-verda-mono text-verda-label text-verda-ink-3">DEVICE-01</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/*
          Static placeholder per Task 11 scope — the shell has no data
          source for real backend health yet. Task 16+ (API
          integration) should replace this with GET /health polling
          and the ok/warn/danger tones the Badge component already
          supports.
        */}
        <Badge tone="ok" dot className="hidden tablet:inline-flex">
          System online
        </Badge>

        <button
          type="button"
          aria-label="Notifications (placeholder)"
          disabled
          className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-verda-sm text-verda-ink-3 opacity-50"
        >
          <Bell size={17} strokeWidth={1.75} aria-hidden="true" />
        </button>

        {/*
          This route tree only renders once RequireAuth has confirmed
          a session, so a click here always means "sign out" — there
          is no logged-out state to account for. A fuller account
          menu (profile, settings shortcut) is future scope; today
          the avatar itself is the sign-out control.
        */}
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-verda-line text-verda-ink-2 transition-colors duration-(--verda-motion-fast) ease-verda hover:border-verda-danger/40 hover:text-verda-danger"
        >
          <User size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
