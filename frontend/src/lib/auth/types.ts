export interface AuthUser {
  id: number;
  email: string;
  isActive: boolean;
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
  logout(): Promise<void>;
  /** The currently authenticated session, or null if there isn't one — asks the backend, never trusts local state. */
  getSession(): Promise<AuthSession | null>;
}
