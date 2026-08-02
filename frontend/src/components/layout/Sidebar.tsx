import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
export interface SidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

/**
 * Left nav rail. Active item gets a soft emerald glow rather than a flat
 * fill, in keeping with the glass-and-light visual language.
 */
export function Sidebar({ items, activeKey, onSelect, className }: SidebarProps) {
  return (
    <nav
      className={cn(
        "flex h-full w-60 flex-col gap-1 border-r border-white/10 bg-white/[0.03] p-4 backdrop-blur-glass",
        className
      )}
    >
      <div className="mb-4 flex items-center gap-2 px-2 text-lg font-semibold text-white/92">
        <span>🌱</span>
        <span>Canopy</span>
      </div>

      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={cn(
              "flex items-center gap-3 rounded-canopy-sm px-3 py-2.5 text-sm transition-all duration-200 ease-canopy",
              active
                ? "bg-canopy-primary/15 text-white shadow-glow-primary"
                : "text-white/56 hover:bg-white/[0.05] hover:text-white/80"
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
