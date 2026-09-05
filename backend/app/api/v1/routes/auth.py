from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserRole
from app.rate_limit import limiter
from app.schema.auth import CurrentUserResponse, LoginRequest, RegisterRequest
from app.services import auth_service
from app.settings import (
    SESSION_COOKIE_DOMAIN,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_PATH,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
    SESSION_TTL_DAYS,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60

# One generic message for every login failure — unknown email, wrong
# password, and a disabled account are all indistinguishable from the
# outside (see auth_service.authenticate_user's docstring for why the
# password check runs even when no user was found, keeping response
# time uniform too).
_GENERIC_LOGIN_FAILURE = "Invalid email or password"

# One generic message for every reason a session might not authenticate
# a request — missing cookie, garbage token, revoked, expired, or the
# user having since been deactivated. A public client can never tell
# these apart, on purpose.
_GENERIC_AUTH_FAILURE = "Not authenticated"

# Registration, unlike login, cannot be non-committal about a duplicate:
# a would-be user who is told nothing has no way to learn that the
# address they typed is already theirs, and would be left retrying a
# sign-up that can never succeed. That makes this endpoint an account-
# existence oracle in a way /login deliberately is not — accepted here
# as the standard, unavoidable cost of having a sign-up form at all,
# and worth recording rather than leaving for someone to rediscover.
_EMAIL_ALREADY_REGISTERED = "An account with this email already exists"

# 403 for every role-based rejection — the user IS authenticated
# (require_role runs get_current_user first; this message is only ever
# reached once that has already succeeded), they simply lack the
# required role. Deliberately generic about which role IS required —
# role names are not secret, but there is no reason for this response
# to describe VERDA's authorization model to a caller that just failed
# it.
_INSUFFICIENT_ROLE = "You do not have permission to perform this action"


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=_SESSION_MAX_AGE_SECONDS,
        path=SESSION_COOKIE_PATH,
        domain=SESSION_COOKIE_DOMAIN,
        secure=SESSION_COOKIE_SECURE,
        httponly=True,
        samesite=SESSION_COOKIE_SAMESITE,
    )


def _clear_session_cookie(response: Response) -> None:
    # Attributes must match what set_cookie used (path/domain/samesite/
    # secure) — a browser only clears a cookie whose scoping attributes
    # line up with the one it actually stored.
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path=SESSION_COOKIE_PATH,
        domain=SESSION_COOKIE_DOMAIN,
        secure=SESSION_COOKIE_SECURE,
        httponly=True,
        samesite=SESSION_COOKIE_SAMESITE,
    )


def _as_response(user: User) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id, email=user.email, is_active=user.is_active, role=user.role
    )


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    """Reusable dependency for any human-facing route that requires a
    signed-in user (dashboard/settings/pump-control APIs — a later
    task). Deliberately not applied to ESP32 telemetry ingestion or the
    existing device-status/control routes in this task; those have
    their own, different authentication model (X-API-Key / none).

    Every rejection reason (no cookie, garbage token, expired, revoked,
    inactive user) maps to the identical 401 — see _GENERIC_AUTH_FAILURE.
    """
    if session_token is None:
        raise HTTPException(status_code=401, detail=_GENERIC_AUTH_FAILURE)

    try:
        return auth_service.get_user_from_session(db, session_token)
    except (
        auth_service.InvalidSessionError,
        auth_service.ExpiredSessionError,
        auth_service.InactiveUserError,
    ):
        raise HTTPException(status_code=401, detail=_GENERIC_AUTH_FAILURE)


def require_role(*allowed_roles: UserRole):
    """Dependency FACTORY for routes that need more than "any signed-in
    user" — reuses get_current_user for the actual authentication check
    (never re-implements or replaces it) and adds a role check on top of
    an already-authenticated User.

    Usage — call it, don't reference it bare:
        Depends(require_role(UserRole.OPERATOR, UserRole.ADMIN))
        Depends(require_role(UserRole.ADMIN))

    Every rejection here is 403, not 401 — get_current_user has already
    succeeded by the time this code runs (it is itself a Depends() this
    dependency declares), so the caller IS authenticated; they simply
    lack the required role. Keeping these distinct matters for a client
    trying to tell "log in again" apart from "this account cannot do
    that".

    Fails closed on a role value that isn't one of VIEWER/OPERATOR/ADMIN
    at all: every write path that can ever set User.role
    (auth_service.create_user, auth_service.approve_user) only accepts a
    UserRole and stores its .value, so this should be unreachable in
    practice — but a hand-edited row or a future migration mistake is
    exactly the kind of thing this must not turn into a crash for. An
    unrecognized role is treated as "definitely not in allowed_roles",
    the same 403 as any other insufficient-role case, rather than
    letting UserRole(...) raise ValueError into an unhandled 500.
    """

    def _dependency(user: User = Depends(get_current_user)) -> User:
        try:
            role = UserRole(user.role)
        except ValueError:
            raise HTTPException(status_code=403, detail=_INSUFFICIENT_ROLE)

        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail=_INSUFFICIENT_ROLE)
        return user

    return _dependency


@router.post("/login", response_model=CurrentUserResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    try:
        user = auth_service.authenticate_user(db, payload.email, payload.password)
    except (auth_service.InvalidCredentialsError, auth_service.InactiveUserError):
        # Both map to the same message and status — an inactive account
        # must be exactly as indistinguishable as a wrong password.
        raise HTTPException(status_code=401, detail=_GENERIC_LOGIN_FAILURE)

    created = auth_service.create_session(db, user)
    _set_session_cookie(response, created.token)
    # created.token is used exactly once, right above, and discarded —
    # it is never assigned anywhere else, never logged, and never part
    # of this function's return value.
    return _as_response(user)


@router.post("/register", response_model=CurrentUserResponse, status_code=201)
@limiter.limit("5/hour")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    """Public sign-up. Creates an account; does NOT sign anyone in.

    Note what this function does not take: a Response. That is the
    whole point — no session is created and no verda_session cookie is
    set, so registering cannot itself grant access. The new account
    becomes usable only once its owner logs in through /login like any
    other, which is also the only place a session has ever been minted.

    New accounts are created INACTIVE and VIEWER (never OPERATOR or
    ADMIN) — a public endpoint that produced immediately-usable,
    hardware-capable accounts would hand physical pump/relay control to
    anyone who filled in a form. is_active=False plus role=VIEWER makes
    an admin's deliberate approval (POST /api/v1/admin/users/{id}/approve,
    which is what actually assigns VIEWER or OPERATOR) the real gate.
    approved_at stays None — this account has never been reviewed; see
    auth_service.list_pending_users. An unapproved account hitting
    /login gets the same generic _GENERIC_LOGIN_FAILURE as any other
    failure, unchanged: the login route's anti-enumeration behavior is
    not relaxed to accommodate this.
    """
    try:
        user = auth_service.create_user(
            db,
            payload.email,
            payload.password,
            is_active=False,
            role=UserRole.VIEWER,
            approved_at=None,
        )
    except auth_service.EmailAlreadyRegisteredError:
        raise HTTPException(status_code=409, detail=_EMAIL_ALREADY_REGISTERED)

    # payload.password is never touched again after the line above,
    # where create_user hashes it — it is not logged, not echoed, and
    # _as_response carries only id/email/is_active, never the hash.
    return _as_response(user)


@router.get("/me", response_model=CurrentUserResponse)
def get_me(user: User = Depends(get_current_user)):
    return _as_response(user)


@router.post("/logout")
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
):
    if session_token is not None:
        # revoke_session is a no-op for an already-revoked/expired/
        # unknown token — nothing here needs to branch on that.
        auth_service.revoke_session(db, session_token)

    _clear_session_cookie(response)
    return {"success": True}
