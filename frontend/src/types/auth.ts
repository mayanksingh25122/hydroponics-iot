export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * POST /api/v1/auth/register (app/schema/auth.py::RegisterRequest).
 *
 * Identical in shape to LoginRequest, and deliberately kept as its own
 * type rather than aliased: the two carry different guarantees. A
 * login password is whatever the account already has, while this one
 * must clear the backend's MIN_PASSWORD_LENGTH.
 *
 * There is no confirmPassword field. Confirmation is a typo guard for
 * the person typing and is checked in Signup.tsx's zod schema — the
 * backend has no such field, and sending the secret twice would only
 * widen where it can be logged.
 */
export interface RegisterRequest {
  email: string;
  password: string;
}

/**
 * VERDA's three-role authorization model (app/models/user.py::UserRole).
 * VIEWER < OPERATOR < ADMIN, each a strict superset of the one before —
 * see that Python enum's own docstring for what each level can do.
 *
 * This value is UX only on the frontend (hide/disable controls, route
 * guards) — it enforces nothing by itself. The real boundary is the
 * backend's require_role dependency; every route this type gates is
 * re-checked there regardless of what this app renders.
 */
export type UserRole = "viewer" | "operator" | "admin";

/**
 * POST /api/v1/auth/login, POST /api/v1/auth/register, and
 * GET /api/v1/auth/me all return this shape
 * (app/schema/auth.py::CurrentUserResponse). Deliberately mirrors the
 * backend's field names verbatim, including is_active — the actual
 * session token never appears in this or any other response body; it
 * exists only in the httpOnly verda_session cookie.
 */
export interface CurrentUserResponse {
  id: number;
  email: string;
  is_active: boolean;
  role: UserRole;
}

/**
 * One account as an admin sees it (app/schema/auth.py::AdminUserResponse)
 * — a separate, wider shape than CurrentUserResponse: an admin
 * reviewing accounts needs created_at/approved_at, which a user's own
 * view of themselves has no reason to carry.
 */
export interface AdminUserResponse {
  id: number;
  email: string;
  is_active: boolean;
  role: UserRole;
  created_at: string;
  approved_at: string | null;
}

/** GET /api/v1/admin/users?status=pending (app/schema/auth.py::AdminUserListResponse). */
export interface AdminUserListResponse {
  users: AdminUserResponse[];
}

/**
 * POST /api/v1/admin/users/{id}/approve
 * (app/schema/auth.py::ApproveUserRequest).
 *
 * role is deliberately restricted to viewer/operator, matching the
 * backend's own Literal — there is no way to grant ADMIN through this
 * endpoint or this UI; the type system enforces that as much as the
 * backend does, so a typo here fails at compile time rather than as a
 * runtime 422.
 */
export interface ApproveUserRequest {
  role: Extract<UserRole, "viewer" | "operator">;
}
