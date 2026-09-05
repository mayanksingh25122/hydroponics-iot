import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Guards /admin/users. Always nested INSIDE <RequireAuth /> in
 * App.tsx's route tree, never standalone — by the time this renders,
 * status is already "authenticated" (RequireAuth has handled the
 * "unknown"/"unauthenticated" cases), so this only has one more thing
 * to check: role.
 *
 * A non-admin is sent to the dashboard, not to /login — they ARE
 * signed in, just not authorized for this one page. This is UX only:
 * the real boundary is the backend's require_role(ADMIN) on every
 * /api/v1/admin/* route, which this guard cannot bypass or weaken even
 * if it were somehow rendered incorrectly.
 */
export function RequireAdmin() {
  const role = useAuthStore((state) => state.user?.role);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
