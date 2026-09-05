"""Create the first VERDA login account.

This is a local operator script, not an HTTP endpoint — it is run manually
by whoever already has the backend/.env database credentials, the same
access level required to run `alembic upgrade head` or
scripts/provision_device.py.

VERDA does now have a public sign-up endpoint (POST /api/v1/auth/register),
but it deliberately cannot replace this script: accounts created through
it are INACTIVE and cannot log in until an operator approves them. This
script remains the only way to create an account that can sign in
immediately, and is still the bootstrap path for the very first one —
there has to be someone able to log in before anyone can approve anybody.

IMPORTANT — this creates a real ADMIN account, not merely an
authenticated one: app.models.user.User has a role column
(app.models.user.UserRole: VIEWER / OPERATOR / ADMIN), and every account
this script creates is role=ADMIN, is_active=True, approved_at=<now>
(self-approved at creation — there is no one else to approve it). This
is deliberate, not a shortcut: an ADMIN can approve/disable other
accounts and assign their roles (POST /api/v1/admin/users/{id}/approve,
.../disable), so this script is VERDA's only bootstrap into that
capability at all — there must be one ADMIN before anyone can be
approved by one. Every account created this way has IDENTICAL,
full ADMIN access to every other one; there is no lesser tier available
through this script (an operator wanting a non-admin account for
themselves should self-register instead and have an existing admin
approve them as VIEWER or OPERATOR).

Reuses the existing auth stack directly rather than reimplementing any
of it:
  - app.services.auth_service.create_user() writes the row — the exact
    same function POST /api/v1/auth/register calls, which in turn uses
    the same Argon2id hash_password() that login verifies against. A
    user created here authenticates identically to one created any
    other way.
  - pydantic.EmailStr for email format validation — the exact same
    mechanism app.schema.auth.LoginRequest already uses, so an email
    this script accepts is guaranteed to also be accepted at login.
  - The existing users.email UNIQUE constraint (from the initial auth
    migration) is the real, final safety net against a duplicate — the
    explicit pre-check below exists to fail with a clear message
    *before* attempting a write, not to replace that constraint.

Never overwrites an existing account: if the email is already taken,
the script exits without touching that row's password or anything else.

Usage (same sys.path pattern alembic/env.py and provision_device.py
already use, so this runs correctly regardless of invocation directory):
    python backend/scripts/create_admin.py --email you@yourcompany.com
    # or, from backend/:
    python -m scripts.create_admin --email you@yourcompany.com

The email above is an EXAMPLE ONLY — replace it with a real address.
Password is never a CLI argument (that would land in shell history and
process listings); it is always read via getpass (hidden input, prompted
twice to catch typos) unless VERDA_ADMIN_PASSWORD is set for a scripted
first run — see _read_password()'s docstring for that tradeoff.
"""

import argparse
import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from pydantic import BaseModel, EmailStr, ValidationError  # noqa: E402

from app.database.connection import SessionLocal  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services.auth_service import (  # noqa: E402
    MIN_PASSWORD_LENGTH,
    EmailAlreadyRegisteredError,
    create_user,
    normalize_email,
)

# MIN_PASSWORD_LENGTH and the reasoning behind the number now live in
# app.services.auth_service, imported above rather than restated here.
# POST /api/v1/auth/register enforces the same floor from that same
# constant, so the two account-creation paths cannot drift apart.


class BootstrapError(Exception):
    """Any operator-facing failure. Message is always safe to print —
    never construct one of these with a password or hash inside it."""


class _EmailCheck(BaseModel):
    # Reuses the exact same EmailStr mechanism app.schema.auth.LoginRequest
    # validates against, instead of a second, possibly-inconsistent check.
    email: EmailStr


def _normalize_and_validate_email(raw_email: str) -> str:
    normalized = raw_email.strip().lower()
    try:
        checked = _EmailCheck(email=normalized)
    except ValidationError as exc:
        raise BootstrapError(f"{normalized!r} is not a valid email address.") from exc
    return checked.email


def _validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise BootstrapError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters "
            f"(got {len(password)})."
        )


def _read_email(cli_email: str | None) -> str:
    if cli_email:
        return _normalize_and_validate_email(cli_email)
    env_email = os.getenv("VERDA_ADMIN_EMAIL")
    if env_email:
        return _normalize_and_validate_email(env_email)
    return _normalize_and_validate_email(input("Email: "))


def _read_password() -> str:
    """Interactive by default: getpass (hidden input) twice, so a typo
    doesn't silently set a password nobody typed on purpose.

    VERDA_ADMIN_PASSWORD is an escape hatch for a genuinely non-interactive
    first run (e.g. a one-off provisioning step in a deploy pipeline) —
    supported because the task calling for this script explicitly asked
    for that alternative to be documented, not because it's preferred.
    It is read once via os.getenv and never printed, logged, or echoed;
    the shell/CI history and process environment that set it are the
    operator's own responsibility to keep private, exactly as with
    BACKEND_API_KEY or DATABASE_PASSWORD already in this repo's .env
    files. There is no confirmation step for this path, since there is
    no second prompt to confirm against.
    """
    env_password = os.getenv("VERDA_ADMIN_PASSWORD")
    if env_password:
        _validate_password(env_password)
        return env_password

    password = getpass.getpass("Password: ")
    _validate_password(password)
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        raise BootstrapError("Passwords did not match. Nothing was created.")
    return password


def create_owner_account(email: str, password: str) -> User:
    """Create one User row, or raise BootstrapError if that email
    already exists. Never overwrites, never deletes, never touches
    sessions.

    The row itself is written by app.services.auth_service.create_user
    — the same function POST /api/v1/auth/register calls — rather than
    by a second copy of "check, hash, insert" living here. That is what
    makes an operator-created account and a self-registered one
    genuinely identical: same normalization, same Argon2id hashing,
    same duplicate handling (pre-check plus the users.email UNIQUE
    constraint), with only is_active/role/approved_at differing.

    is_active=True, role=ADMIN, approved_at=<now> is the one deliberate
    difference, and it is why this script still exists. Self-
    registration through the API creates INACTIVE, VIEWER,
    never-approved accounts precisely because a public endpoint must
    never hand out hardware-capable access on its own — an operator
    running this script, with direct database credentials, is the
    trusted path, and the only path able to approve the untrusted one.
    approved_at is set to "now" here because there is no one else to
    approve this account; it is self-approved at the moment of creation,
    exactly like scripts/provision_device.py bootstraps the first
    device with no external approval step either.
    """
    db = SessionLocal()
    try:
        try:
            return create_user(
                db,
                email,
                password,
                is_active=True,
                role=UserRole.ADMIN,
                approved_at=datetime.now(timezone.utc),
            )
        except EmailAlreadyRegisteredError:
            # Re-read purely to put the existing id in the operator's
            # message; nothing about that row is modified.
            existing = db.query(User).filter(User.email == normalize_email(email)).first()
            existing_id = existing.id if existing is not None else "unknown"
            raise BootstrapError(
                f"A user already exists for {email} (id={existing_id}). "
                "No changes were made — this script never overwrites an "
                "existing account's password or creates a duplicate."
            )
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Create the first VERDA login account (operator-run only — "
            "never exposed over HTTP). Password is always entered via a "
            "hidden prompt, never as a command-line argument. Example: "
            "python -m scripts.create_admin --email you@yourcompany.com "
            "(replace with a real address; this is not a real account)."
        )
    )
    parser.add_argument(
        "--email",
        help="Account email. Prompted interactively if omitted (or set VERDA_ADMIN_EMAIL).",
    )
    args = parser.parse_args()

    try:
        email = _read_email(args.email)
        password = _read_password()
        user = create_owner_account(email, password)
    except BootstrapError as exc:
        print(f"Not created: {exc}")
        return 1

    print(f"User created successfully for {user.email} (id={user.id}).")
    print(
        "This is a full ADMIN account: it can sign in immediately, and "
        "can approve/disable other accounts and assign their roles at "
        "POST /api/v1/admin/users/{id}/approve and .../disable. Every "
        "account created by this script has identical, full ADMIN "
        "access — there is no lesser tier available through this "
        "script."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
