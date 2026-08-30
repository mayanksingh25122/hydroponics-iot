import {
  LayoutDashboard,
  Sprout,
  Cpu,
  Activity,
  BarChart3,
  Workflow,
  Sparkles,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  /** Real route path. Undefined = not yet built — rendered disabled, not a dead link. */
  path?: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar hierarchy per the approved blueprint's route tiers. Only
 * Dashboard, Analytics, and Settings have a real route today — the
 * rest are shown (per Task 11's explicit nav spec) but disabled,
 * since building their pages is out of scope for this task.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard }],
  },
  {
    label: "Farm",
    items: [
      { label: "Farms", icon: Sprout },
      { label: "Devices", icon: Cpu },
      { label: "Sensors", icon: Activity },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
      { label: "Automation", icon: Workflow },
      { label: "AI", icon: Sparkles },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", path: "/settings", icon: Settings }],
  },
];

/** Flat lookup for the Topbar's "current page" label. */
export const ROUTE_LABELS: Record<string, string> = NAV_SECTIONS.flatMap((s) => s.items)
  .filter((item): item is NavItem & { path: string } => Boolean(item.path))
  .reduce<Record<string, string>>((acc, item) => {
    acc[item.path] = item.label;
    return acc;
  }, {});
