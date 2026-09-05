import type { UserRole } from "@/types/auth";

export interface AuthUser {
  id: number;
  email: string;
  isActive: boolean;
  /**
   * VIEWER / OPERATOR / ADMIN — see types/auth.ts::UserRole. UX only:
   * every route this drives a decision for (hiding pump controls,
   * gating /admin/users) is independently enforced by the backend's
   * require_role dependency, which does not trust or read this value.
   */
  role: UserRole;
}

export interface AuthSession {
  user: AuthUser;
}

/**
 * Boundary between UI code and the concrete backend session mechanism.
 * Page/UI code depends only on this interface. There is exactly one
 * real implementation (authProvider.ts, backend session cookies) —
 * this still exists as a seam rather than being inlined, purely so a
 * future change to the auth mechanism only touches authProvider.ts.
 *
 * No method here ever returns or accepts a raw session token: the
 * token lives solely in the httpOnly verda_session cookie, set and
 * read by the backend. The browser cannot read it and this interface
 * has no way to carry it even if it could.
 */
export interface AuthProvider {
  login(email: string, password: string): Promise<AuthSession>;
  /**
   * Creates an account. Returns an AuthUser, NOT an AuthSession —
   * registering does not sign anyone in, and the backend sets no
   * cookie on this call. The returned user's isActive is false and
   * role is "viewer": a self-registered account waits for an admin's
   * approval (which is what actually assigns viewer or operator)
   * before it can log in at all.
   */
  register(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  /** The currently authenticated session, or null if there isn't one — asks the backend, never trusts local state. */
  getSession(): Promise<AuthSession | null>;
}
