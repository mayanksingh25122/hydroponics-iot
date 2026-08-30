from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schema.auth import CurrentUserResponse, LoginRequest
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
    return CurrentUserResponse(id=user.id, email=user.email, is_active=user.is_active)


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


@router.post("/login", response_model=CurrentUserResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
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
