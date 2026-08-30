import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

export interface RedirectIfAuthenticatedProps {
  children: ReactNode;
}

/**
 * Wraps /login. Already-authenticated visitors are sent to the page
 * they came from (if any) or the dashboard, instead of seeing the
 * sign-in form again.
 */
export function RedirectIfAuthenticated({ children }: RedirectIfAuthenticatedProps) {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "authenticated") {
    const from = (location.state as { from?: Location } | null)?.from;
    return <Navigate to={from?.pathname ?? "/"} replace />;
  }

  return children;
}
