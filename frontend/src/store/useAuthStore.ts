import { create } from "zustand";
import { authProvider } from "@/lib/auth/authProvider";
import { setUnauthorizedHandler } from "@/services/api";
import type { AuthUser } from "@/lib/auth/types";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Set once initialize() has resolved at least once. Guards against re-running it. */
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Minimal session state: unknown (still checking) -> authenticated |
 * unauthenticated. Route guards and the Login page read `status`
 * only — nothing here assumes a specific auth provider.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: "unknown",
  user: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    try {
      const session = await authProvider.getSession();
      set({
        status: session ? "authenticated" : "unauthenticated",
        user: session?.user ?? null,
        initialized: true,
      });
    } catch {
      set({ status: "unauthenticated", user: null, initialized: true });
    }
  },

  login: async (email: string, password: string) => {
    const session = await authProvider.login(email, password);
    set({ status: "authenticated", user: session.user });
  },

  logout: async () => {
    try {
      await authProvider.logout();
    } finally {
      // Always clear local state, even if the network call itself
      // failed — the user asked to log out, and there is no httpOnly
      // cookie value this frontend could inspect or clear on its own
      // to decide otherwise. Worst case, the backend session outlives
      // this tab until its own TTL; the UI never stays stuck showing
      // an authenticated view the user explicitly rejected.
      set({ status: "unauthenticated", user: null });
    }
  },
}));

// A 401 from any protected route while this store still believes the
// user is authenticated means the backend session died elsewhere
// (expired, revoked). Only transition when we actually thought we
// were logged in — a 401 from the login form itself, or from /me
// during the initial (already-unauthenticated) check, is not a
// session going invalid, it's just a normal negative result those
// callers already handle themselves. No navigation happens here;
// RequireAuth's existing redirect fires on its own once `status`
// changes, so there is exactly one redirect, never a loop.
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().status === "authenticated") {
    useAuthStore.setState({ status: "unauthenticated", user: null });
  }
});
