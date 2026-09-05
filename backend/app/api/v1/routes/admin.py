"""Admin-only account management: list pending sign-ups, approve them
into a role, or disable an existing account.

Every route here requires require_role(UserRole.ADMIN) — a non-admin
(VIEWER or OPERATOR) gets the identical 403 any other role-gated route
would give them (see app.api.v1.routes.auth.require_role); there is no
separate, weaker check anywhere in this module. A caller who is not
authenticated at all gets require_role's own 401 first, before ever
reaching an admin-specific rejection.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.routes.auth import require_role
from app.database.session import get_db
from app.models.user import User, UserRole
from app.schema.auth import AdminUserListResponse, AdminUserResponse, ApproveUserRequest
from app.services import auth_service

router = APIRouter(prefix="/admin", tags=["admin"])

_USER_NOT_FOUND = "User not found"
_CANNOT_REMOVE_LAST_ADMIN = "Cannot disable the only remaining admin account"

# Only "pending" is implemented. Rejecting anything else with a clear
# 422 is deliberate: this task's scope is the pending-approval queue
# specifically, not a general user-listing/search API — see the
# module docstring and auth_service.list_pending_users. Extending this
# to a broader listing later is a small, additive change to this one
# function, not a redesign.
_UNSUPPORTED_STATUS_FILTER = "Only status=pending is supported"


def _as_admin_response(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        role=user.role,
        created_at=user.created_at,
        approved_at=user.approved_at,
    )


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    status: str = "pending",
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """GET /api/v1/admin/users?status=pending — accounts awaiting
    review, oldest first. See auth_service.list_pending_users for
    exactly what "pending" means (never approved, not merely inactive).
    """
    if status != "pending":
        raise HTTPException(status_code=422, detail=_UNSUPPORTED_STATUS_FILTER)

    users = auth_service.list_pending_users(db)
    return AdminUserListResponse(users=[_as_admin_response(u) for u in users])


@router.post("/users/{user_id}/approve", response_model=AdminUserResponse)
def approve_user(
    user_id: int,
    payload: ApproveUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Activates an account and assigns it VIEWER or OPERATOR (never
    ADMIN — see ApproveUserRequest's own docstring for why that is
    enforced at the schema level, before this function ever runs).

    Reachable only by an existing ADMIN (require_role above) — this is
    also what "do not allow a non-admin to approve themselves" reduces
    to: a non-admin cannot reach this function at all, so there is
    nothing further to check about whose account is being approved.
    """
    try:
        user = auth_service.approve_user(db, user_id, UserRole(payload.role))
    except auth_service.UserNotFoundError:
        raise HTTPException(status_code=404, detail=_USER_NOT_FOUND)

    return _as_admin_response(user)


@router.post("/users/{user_id}/disable", response_model=AdminUserResponse)
def disable_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Deactivates any account, including the caller's own — with one
    guard: refuses (409) if this would leave zero active ADMIN accounts
    (auth_service.disable_user / CannotRemoveLastAdminError). There is
    no other recovery path back into the admin API once that happens.
    """
    try:
        user = auth_service.disable_user(db, user_id)
    except auth_service.UserNotFoundError:
        raise HTTPException(status_code=404, detail=_USER_NOT_FOUND)
    except auth_service.CannotRemoveLastAdminError:
        raise HTTPException(status_code=409, detail=_CANNOT_REMOVE_LAST_ADMIN)

    return _as_admin_response(user)
