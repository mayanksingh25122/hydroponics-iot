"""Create the first VERDA login account.

This is a local operator script, not an HTTP endpoint — it is run manually
by whoever already has the backend/.env database credentials, the same
access level required to run `alembic upgrade head` or
scripts/provision_device.py. There is no new API surface: VERDA has no
public registration endpoint and none is added by this script.

IMPORTANT — this creates an AUTHENTICATED account, not an "admin" role:
app.models.user.User has no role/permission column, and none is added
here (no schema change). VERDA does not have RBAC yet — every account
created by this script can sign in with identical access to every other
one. This script's job is only to get the first person able to log in at
all; authorization/roles are a separate, not-yet-built concern.

Reuses the existing auth stack directly rather than reimplementing any
of it:
  - app.services.auth_service.hash_password() for Argon2id hashing —
    the exact same function app.api.v1.routes.auth.login() calls, so a
    user created here authenticates identically to one created any other
    way.
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
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from pydantic import BaseModel, EmailStr, ValidationError  # noqa: E402

from app.database.connection import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402

# Deliberately higher than LoginRequest's min_length=1 (schema/auth.py).
# That field is permissive on purpose — login must accept whatever
# password an account was already created with. This script is the
# place a password is actually chosen, so it's the right place to set a
# real floor. 12 is a plain, documented minimum for a small internal
# team with no MFA yet, not an elaborate policy (no forced symbols,
# digits, or rotation).
MIN_PASSWORD_LENGTH = 12


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
    sessions. password is hashed via the real auth service before it
    ever becomes a SQL bound parameter — only the Argon2id output is
    ever sent to the database.
    """
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing is not None:
            raise BootstrapError(
                f"A user already exists for {email} (id={existing.id}). "
                "No changes were made — this script never overwrites an "
                "existing account's password or creates a duplicate."
            )

        user = User(
            email=email,
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
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
        "Note: VERDA has no role/permission system yet — this is the "
        "initial authenticated VERDA account, not an RBAC 'admin' role. "
        "Every account created this way has identical access."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
