import { cn } from "../../lib/utils";

export interface SidebarItem {
  key: string;
  label: string;
  icon: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

/**
 * Premium glass sidebar for the Canopy platform. Fully controlled —
 * PageLayout.tsx owns the nav items, the active route key (from
 * useLocation().pathname), and navigation (via useNavigate()).
 */
export function Sidebar({ items, activeKey, onSelect, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-screen w-64 shrink-0 flex-col gap-8 border-r border-emerald-500/10 bg-gradient-to-b from-[#06140B]/90 via-[#071A0F]/90 to-[#04130A]/95 p-6 backdrop-blur-xl",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-400 shadow-[0_0_20px_rgba(34,197,94,0.35)]">
          <span className="text-lg">🌿</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white/92">Canopy</span>
          <span className="text-xs text-emerald-300/60">Hydroponics</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {items.map((item) => {
          const isActive = activeKey === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                  : "text-white/56 hover:bg-white/[0.04] hover:text-white/90"
              )}
            >
              {/* Active indicator bar */}
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-emerald-400 to-lime-400 transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <span
                className={cn(
                  "text-lg leading-none transition-transform duration-300 group-hover:scale-110",
                  isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                )}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/10 bg-white/[0.02] px-3.5 py-3 text-xs text-white/40">
        <span className="relative flex h-2 w-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping" />
        </span>
        <span>System Online</span>
      </div>
    </aside>
  );
}