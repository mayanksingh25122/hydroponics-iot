import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { VerdaMark } from "@/components/brand/VerdaMark";

/**
 * Guards every route nested under it. `status === "unknown"` covers
 * the brief window while initialize() is checking for an existing
 * session — rendering nothing/redirecting here would flash the login
 * screen on every hard refresh, so it waits instead.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "unknown") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-verda-canvas">
        <div className="flex flex-col items-center gap-3 motion-safe:animate-verda-breathe">
          <VerdaMark size={32} />
          <p className="text-verda-caption text-verda-ink-3">Checking session…</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
