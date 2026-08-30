import { create } from "zustand";
import { authProvider } from "@/lib/auth/authProvider";
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
    await authProvider.logout();
    set({ status: "unauthenticated", user: null });
  },
}));
