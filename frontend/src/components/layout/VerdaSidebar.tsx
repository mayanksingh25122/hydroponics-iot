import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { VerdaMark } from "@/components/brand/VerdaMark";
import { Badge } from "@/components/ui/Badge";
import { NAV_SECTIONS } from "./navConfig";

export type SidebarMode = "full" | "rail";

export interface VerdaSidebarProps {
  mode?: SidebarMode;
  className?: string;
  /** Called after a nav link is activated — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}

/**
 * VERDA sidebar: grouped nav hierarchy, active-route styling from
 * the actual router location (NavLink), and a status footer. Used
 * in three contexts by AppShell — persistent "full" on desktop,
 * persistent "rail" (icon-only) on tablet, and "full" again inside
 * the mobile drawer.
 */
export function VerdaSidebar({ mode = "full", className, onNavigate }: VerdaSidebarProps) {
  const rail = mode === "rail";

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-verda-line bg-verda-surface",
        rail ? "w-16 items-center px-2 py-5" : "w-60 px-4 py-5",
        className
      )}
    >
      <div className={cn("flex items-center gap-2.5", rail ? "justify-center px-0" : "px-1")}>
        <VerdaMark size={28} />
        {rail ? null : (
          <div className="flex flex-col leading-none">
            <span className="text-verda-caption font-semibold tracking-wide text-verda-forest-800">
              VERDA
            </span>
            <span className="mt-0.5 text-verda-label text-verda-ink-3">Farm systems</span>
          </div>
        )}
      </div>

      <nav
        aria-label="Primary"
        className={cn("mt-7 flex flex-1 flex-col overflow-y-auto", rail ? "gap-4" : "gap-5")}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {rail ? null : (
              <h2 className="mb-1.5 px-2 text-verda-label font-medium uppercase tracking-wider text-verda-ink-3">
                {section.label}
              </h2>
            )}
            <ul className={cn("flex flex-col", rail ? "gap-1" : "gap-0.5")}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const disabled = !item.path;

                if (disabled) {
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        disabled
                        title={rail ? `${item.label} — planned` : undefined}
                        aria-label={`${item.label}, not yet available`}
                        className={cn(
                          "flex w-full cursor-not-allowed items-center gap-2.5 rounded-verda-sm text-verda-body text-verda-ink-3 opacity-50",
                          rail ? "justify-center p-2" : "px-2.5 py-2"
                        )}
                      >
                        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                        {rail ? null : (
                          <span className="flex flex-1 items-center justify-between gap-2">
                            {item.label}
                            <Badge tone="idle" className="px-1.5 py-0 text-[10px]">
                              Soon
                            </Badge>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={item.label}>
                    <NavLink
                      to={item.path as string}
                      end={item.path === "/"}
                      onClick={onNavigate}
                      title={rail ? item.label : undefined}
                      aria-label={rail ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-verda-sm text-verda-body font-medium",
                          "transition-colors duration-(--verda-motion-fast) ease-verda",
                          rail ? "justify-center p-2" : "px-2.5 py-2",
                          isActive
                            ? "bg-verda-sage text-verda-forest-800"
                            : "text-verda-ink-2 hover:bg-verda-sage-wash hover:text-verda-ink"
                        )
                      }
                    >
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                      {rail ? null : item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "mt-4 flex items-center gap-2 rounded-verda-sm border border-verda-line bg-verda-sage-wash",
          rail ? "justify-center p-2" : "px-2.5 py-2"
        )}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="h-2 w-2 rounded-full bg-verda-ok animate-verda-breathe" />
        </span>
        {rail ? null : (
          <span className="font-verda-mono text-verda-label text-verda-ink-3">v0.1 · dev</span>
        )}
      </div>
    </aside>
  );
}
