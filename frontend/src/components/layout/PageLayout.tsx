import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar, type SidebarItem } from "./Sidebar";

const navItems: SidebarItem[] = [
  { key: "/", label: "Dashboard", icon: "🌱" },
  { key: "/analytics", label: "Analytics", icon: "📈" },
  { key: "/settings", label: "Settings", icon: "⚙" },
];

/**
 * Shared shell for authenticated routes: sidebar + dark-forest background.
 * Wrap Dashboard / Analytics / Settings routes in this via App.tsx.
 * Login and NotFound render standalone, without the sidebar.
 */
export default function PageLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="canopy-app-bg flex min-h-screen">
      <Sidebar items={navItems} activeKey={location.pathname} onSelect={(key) => navigate(key)} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
