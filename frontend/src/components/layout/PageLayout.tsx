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
      <main className="min-w-0 flex-1 overflow-y-auto">
        <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-emerald-500/10 bg-[#06140B]/95 px-4 py-3 backdrop-blur lg:hidden">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.key)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                location.pathname === item.key ? "bg-emerald-500/15 text-emerald-200" : "text-white/55"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
