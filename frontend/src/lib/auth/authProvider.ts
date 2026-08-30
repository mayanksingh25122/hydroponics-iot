import type { AuthProvider, AuthSession, AuthUser } from "./types";

/**
 * Thrown by every method below until a real provider is wired.
 * Callers should catch this and show it as an honest auth-failure
 * state — never treat it as a successful sign-in.
 */
export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Authentication provider is not configured yet.");
    this.name = "AuthNotConfiguredError";
  }
}

/**
 * Placeholder implementation. No credential store exists anywhere in
 * this codebase (backend/app/auth is an empty package, no Supabase
 * config is present in the frontend env) — so this provider does not
 * pretend to authenticate anyone. It never returns a session, and it
 * never persists anything.
 *
 * Task 12 scope: build the boundary, not the backend. Replace this
 * file's contents with a real provider (Supabase, a custom API
 * client, etc.) — every consumer imports `authProvider` by name, so
 * nothing outside this file needs to change.
 */
const notConfiguredProvider: AuthProvider = {
  async login(): Promise<AuthSession> {
    throw new AuthNotConfiguredError();
  },
  async logout(): Promise<void> {
    // No session to clear — no-op.
  },
  async getSession(): Promise<AuthSession | null> {
    return null;
  },
  async getCurrentUser(): Promise<AuthUser | null> {
    return null;
  },
};

export const authProvider: AuthProvider = notConfiguredProvider;
