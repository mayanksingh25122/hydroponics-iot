export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * POST /api/v1/auth/login and GET /api/v1/auth/me both return this
 * shape (app/schema/auth.py::CurrentUserResponse). Deliberately mirrors
 * the backend's field names verbatim, including is_active — the actual
 * session token never appears in this or any other response body; it
 * exists only in the httpOnly verda_session cookie.
 */
export interface CurrentUserResponse {
  id: number;
  email: string;
  is_active: boolean;
}
