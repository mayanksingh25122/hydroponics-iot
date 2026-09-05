import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, TriangleAlert, UserX } from "lucide-react";

import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { getApiErrorMessage } from "@/services/api";
import { approveUser, disableUser, getPendingUsers } from "@/services/adminService";
import type { AdminUserResponse, ApproveUserRequest } from "@/types/auth";

const PENDING_USERS_QUERY_KEY = ["admin", "users", "pending"];

type ApprovalRole = ApproveUserRequest["role"];

/**
 * /admin/users — the minimum UI this release needs for an admin to
 * turn a self-registered signup into a usable account: the pending
 * queue, a role choice, and Approve/Disable.
 *
 * Every action here is UX convenience only. The backend re-checks
 * ADMIN on every one of these calls (require_role(UserRole.ADMIN) in
 * app/api/v1/routes/admin.py) — this page renders because RequireAdmin
 * already confirmed the signed-in user's role, but that check is not
 * what makes the actions below safe; the API responding 403 to anyone
 * else is what does.
 */
export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Record<number, ApprovalRole>>({});

  const {
    data: pendingUsers,
    isLoading,
    error,
  } = useQuery<AdminUserResponse[], Error>({
    queryKey: PENDING_USERS_QUERY_KEY,
    queryFn: getPendingUsers,
  });

  const approveMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: ApprovalRole }) =>
      approveUser(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_USERS_QUERY_KEY });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (userId: number) => disableUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_USERS_QUERY_KEY });
    },
  });

  function roleFor(userId: number): ApprovalRole {
    return selectedRoles[userId] ?? "viewer";
  }

  return (
    <div className="flex flex-col gap-6 p-6 tablet:p-8">
      <div>
        <h1 className="text-verda-h2 font-semibold text-verda-ink">Pending Accounts</h1>
        <p className="mt-1 text-verda-body text-verda-ink-3">
          Accounts waiting for approval. Approving assigns a role and lets them sign in;
          disabling turns a request away.
        </p>
      </div>

      <Panel>
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-verda-body text-verda-ink-3">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading pending accounts…
          </div>
        ) : error ? (
          <p
            role="alert"
            className="flex items-center gap-2 py-4 text-verda-body text-verda-danger"
          >
            <TriangleAlert size={16} aria-hidden="true" />
            {getApiErrorMessage(error)}
          </p>
        ) : !pendingUsers || pendingUsers.length === 0 ? (
          <p className="py-8 text-center text-verda-body text-verda-ink-3">
            No accounts are waiting for approval.
          </p>
        ) : (
          <div className="flex flex-col">
            {pendingUsers.map((user, index) => {
              const isApproving =
                approveMutation.isPending && approveMutation.variables?.userId === user.id;
              const isDisabling =
                disableMutation.isPending && disableMutation.variables === user.id;
              const rowBusy = isApproving || isDisabling;

              const rowError =
                (approveMutation.isError && approveMutation.variables?.userId === user.id) ||
                (disableMutation.isError && disableMutation.variables === user.id)
                  ? getApiErrorMessage(approveMutation.error ?? disableMutation.error)
                  : null;

              return (
                <div key={user.id}>
                  {index > 0 ? <Divider className="my-4" /> : null}
                  <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-verda-body font-medium text-verda-ink">
                        {user.email}
                      </p>
                      <p className="mt-0.5 text-verda-caption text-verda-ink-3">
                        Requested {new Date(user.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`role-${user.id}`}>
                        Role for {user.email}
                      </label>
                      <select
                        id={`role-${user.id}`}
                        value={roleFor(user.id)}
                        disabled={rowBusy}
                        onChange={(event) =>
                          setSelectedRoles((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as ApprovalRole,
                          }))
                        }
                        className="h-9 rounded-verda-sm border border-verda-line bg-verda-surface px-2.5 text-verda-body text-verda-ink transition-colors duration-(--verda-motion-fast) ease-verda hover:border-verda-line-strong disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="operator">Operator</option>
                      </select>

                      <Button
                        size="sm"
                        disabled={rowBusy}
                        onClick={() =>
                          approveMutation.mutate({ userId: user.id, role: roleFor(user.id) })
                        }
                      >
                        {isApproving ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <ShieldCheck size={14} aria-hidden="true" />
                        )}
                        Approve
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        disabled={rowBusy}
                        onClick={() => disableMutation.mutate(user.id)}
                      >
                        {isDisabling ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <UserX size={14} aria-hidden="true" />
                        )}
                        Disable
                      </Button>
                    </div>
                  </div>

                  {rowError ? (
                    <p role="alert" className="mt-2 text-verda-caption text-verda-danger">
                      {rowError}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
