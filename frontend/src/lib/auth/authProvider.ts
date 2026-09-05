import { api } from "@/services/api";
import type { CurrentUserResponse, LoginRequest, RegisterRequest } from "@/types/auth";
import type { AuthProvider, AuthUser } from "./types";

function toAuthUser(response: CurrentUserResponse): AuthUser {
  return {
    id: response.id,
    email: response.email,
    isActive: response.is_active,
    role: response.role,
  };
}

/**
 * Talks to the real backend session-cookie system
 * (app/api/v1/routes/auth.py) — no separate credential store, no
 * tokens handled here. Every method's actual authentication proof is
 * the httpOnly verda_session cookie the browser sends automatically
 * via `api`'s withCredentials: true; nothing in this module ever
 * reads, stores, or forwards that cookie's value itself.
 */
const realProvider: AuthProvider = {
  async login(email, password) {
    const payload: LoginRequest = { email, password };
    const response = await api.post<CurrentUserResponse>("/api/v1/auth/login", payload);
    return { user: toAuthUser(response.data) };
  },

  async register(email, password) {
    const payload: RegisterRequest = { email, password };
    const response = await api.post<CurrentUserResponse>(
      "/api/v1/auth/register",
      payload
    );
    // No session state is touched here, and useAuthStore is never
    // involved: the backend issues no cookie for this call, so the
    // visitor is exactly as unauthenticated after registering as
    // before. The caller sends them to /login.
    return toAuthUser(response.data);
  },

  async logout() {
    // Best-effort: the backend clears the cookie server-side on a
    // successful call. If the request itself never lands (offline,
    // dropped connection), there is no client-side cookie value to
    // clear ourselves — httpOnly means JS can't touch it — so there is
    // nothing more to do here. useAuthStore.logout() clears local
    // state regardless of whether this call succeeds.
    await api.post("/api/v1/auth/logout");
  },

  async getSession() {
    try {
      const response = await api.get<CurrentUserResponse>("/api/v1/auth/me");
      return { user: toAuthUser(response.data) };
    } catch {
      // No cookie, an expired/revoked session, or a network failure —
      // all read as "no session" here. The backend is the sole source
      // of truth for whether a session is valid (Part 5); this
      // function never has a "probably still logged in" answer.
      return null;
    }
  },
};

export const authProvider: AuthProvider = realProvider;
