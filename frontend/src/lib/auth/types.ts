export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthSession {
  user: AuthUser;
}

/**
 * Provider-agnostic boundary. Page/UI code depends only on this
 * interface — never on a specific backend (Supabase, a custom API,
 * etc). Swap the implementation in authProvider.ts when a real
 * provider is wired; nothing importing `authProvider` needs to change.
 */
export interface AuthProvider {
  login(email: string, password: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthUser | null>;
}
