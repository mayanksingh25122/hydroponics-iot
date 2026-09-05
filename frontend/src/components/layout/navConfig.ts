import {
  LayoutDashboard,
  Sprout,
  Cpu,
  Activity,
  BarChart3,
  Workflow,
  Sparkles,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  /** Real route path. Undefined = not yet built — rendered disabled, not a dead link. */
  path?: string;
  icon: LucideIcon;
  /**
   * UX-only visibility hint: VerdaSidebar hides this item for anyone
   * whose role isn't "admin". Not a security boundary — the item's
   * own route is separately guarded by RequireAdmin, and its backend
   * calls by require_role(ADMIN); hiding a link here just avoids
   * showing a non-admin a path they can't use.
   */
  adminOnly?: boolean;
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
    items: [
      { label: "Settings", path: "/settings", icon: Settings },
      { label: "Approve Users", path: "/admin/users", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

/** Flat lookup for the Topbar's "current page" label. */
export const ROUTE_LABELS: Record<string, string> = NAV_SECTIONS.flatMap((s) => s.items)
  .filter((item): item is NavItem & { path: string } => Boolean(item.path))
  .reduce<Record<string, string>>((acc, item) => {
    acc[item.path] = item.label;
    return acc;
  }, {});
