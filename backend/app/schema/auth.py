from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.services.auth_service import MIN_PASSWORD_LENGTH


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class RegisterRequest(BaseModel):
    """Sign-up payload for POST /api/v1/auth/register.

    Unlike LoginRequest, which must stay permissive enough to accept
    whatever password an account already has, this is where a password
    is actually chosen — so MIN_PASSWORD_LENGTH applies here (imported,
    never restated, from the same constant scripts/create_admin.py
    enforces).

    max_length matches LoginRequest's 256. It is a real limit, not
    decoration: Argon2id hashing is deliberately CPU-expensive, so an
    unbounded password field is an unbounded amount of server work per
    unauthenticated request.

    There is no password-confirmation field. Confirmation is a typo
    guard for the person typing, checked in the browser
    (frontend/src/pages/Signup.tsx) — sending the same secret twice
    over the wire would add no security and only widen where it can be
    logged.
    """

    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=256)


class CurrentUserResponse(BaseModel):
    """Only what the frontend needs to know about the signed-in user.

    Deliberately excludes password_hash, every AuthSession field
    (token_hash, expires_at, ...), and the raw session token, which
    never appears in any JSON response — it exists only in the
    httpOnly cookie.

    role is a plain str here (not the UserRole enum) — this schema is
    the JSON boundary, where a str is what actually gets serialized;
    UserRole is a backend-only concern (app.models.user). The frontend
    treats it as UX only (hide/disable controls), never as a security
    boundary — the real enforcement is require_role, server-side.
    """

    id: int
    email: str
    is_active: bool
    role: str


class AdminUserResponse(BaseModel):
    """One account's full state as shown to an admin — deliberately a
    separate schema from CurrentUserResponse rather than reusing it,
    since an admin reviewing accounts needs created_at/approved_at,
    which a user's own view of themselves (/me, /login) has no reason
    to carry.

    Still excludes password_hash and every session-related field, for
    the same reason CurrentUserResponse does.
    """

    id: int
    email: str
    is_active: bool
    role: str
    created_at: datetime
    approved_at: datetime | None


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]


class ApproveUserRequest(BaseModel):
    """Payload for POST /api/v1/admin/users/{id}/approve.

    role is deliberately restricted to viewer/operator — NOT admin.
    Promoting a self-registered signup straight to ADMIN through the
    "approve a pending account" flow is a materially different,
    higher-stakes action than the flow this endpoint exists for, and
    this task's own frontend spec only ever offers VIEWER or OPERATOR
    in the approval UI. There is currently no API path to grant ADMIN;
    scripts/create_admin.py remains the only one, by design.
    """

    role: Literal["viewer", "operator"]
