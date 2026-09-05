import { api } from "./api";
import type {
  AdminUserListResponse,
  AdminUserResponse,
  ApproveUserRequest,
} from "@/types/auth";

/**
 * GET /api/v1/admin/users?status=pending — accounts awaiting review.
 * Requires an ADMIN session cookie; the backend's require_role
 * dependency is what actually enforces that (see
 * app/api/v1/routes/admin.py) — a non-admin session gets a 403 from
 * the server regardless of what this app renders.
 */
export async function getPendingUsers(): Promise<AdminUserResponse[]> {
  const response = await api.get<AdminUserListResponse>("/api/v1/admin/users", {
    params: { status: "pending" },
  });
  return response.data.users;
}

/**
 * POST /api/v1/admin/users/{id}/approve — activates the account and
 * assigns it `role`. role is typed to viewer/operator only (see
 * ApproveUserRequest) — there is no way to request ADMIN through this
 * call, matching the backend's own restriction.
 */
export async function approveUser(
  userId: number,
  role: ApproveUserRequest["role"]
): Promise<AdminUserResponse> {
  const response = await api.post<AdminUserResponse>(
    `/api/v1/admin/users/${userId}/approve`,
    { role } satisfies ApproveUserRequest
  );
  return response.data;
}

/**
 * POST /api/v1/admin/users/{id}/disable — deactivates the account.
 * Also counts as a review: calling this on a still-pending (never-
 * approved) account stamps approved_at (see
 * app/services/auth_service.py::disable_user), so the row leaves the
 * pending queue immediately, the same way an approval would — this UI
 * never has to poll again to see it disappear.
 */
export async function disableUser(userId: number): Promise<AdminUserResponse> {
  const response = await api.post<AdminUserResponse>(`/api/v1/admin/users/${userId}/disable`);
  return response.data;
}
