"""Authentication business logic: password hashing, credential checks,
and server-side session lifecycle. No FastAPI, no HTTP, no cookies —
the future route layer calls these functions and maps their exceptions
to responses; this module knows nothing about that mapping.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession
from app.models.user import User
from app.settings import SESSION_TTL_DAYS

# Library defaults (Argon2id, time_cost=3, memory_cost=64 MiB, parallelism=4)
# are used as-is rather than tuned here — the task calling for this module
# was explicit that hashing must go through the library's own secure
# mechanism, not custom parameters chosen without real capacity data for
# the deployment target.
_password_hasher = PasswordHasher()

# Session tokens are 32 bytes of CSPRNG output (secrets.token_urlsafe),
# URL-safe and long enough to be infeasible to guess — not a UUID, not
# anything timestamp- or ID-derived. Only a SHA-256 hash of the token
# (64 hex chars, matching AuthSession.token_hash's column width exactly)
# is ever persisted; the raw token exists only in memory and, later, in
# the caller's cookie.
_TOKEN_BYTES = 32


# =============================================================================
# Exceptions
# =============================================================================
# Each one is a distinct, internal signal for the future route layer to
# catch and translate into a response. None of these messages are meant
# to reach an external client verbatim — in particular, InvalidCredentialsError
# deliberately does not (and must not) reveal whether the email existed.


class InvalidCredentialsError(Exception):
    """Email/password did not authenticate.

    Deliberately covers BOTH "no such user" and "wrong password" as the
    same exception — the future route layer must not be able to tell
    them apart from this alone, so it can never leak which case
    occurred, even by accident. See authenticate_user's docstring for
    how the timing of the two cases is also kept uniform.
    """


class InactiveUserError(Exception):
    """Credentials (or an existing session) were valid, but the account
    has been disabled (User.is_active is False).

    Kept distinct from InvalidCredentialsError/InvalidSessionError for
    the service layer's own internal clarity — the future route layer
    is free to map this to the same generic external failure as any
    other authentication failure; nothing here requires it to differ.
    """


class InvalidSessionError(Exception):
    """No AuthSession row matches the given token's hash.

    Covers a session that never existed, an already-revoked (deleted)
    session, and a malformed/garbage token identically — there is
    nothing to distinguish, by design, since revocation in this schema
    IS row deletion (see AuthSession's own docstring). A caller cannot
    tell "revoked" from "never existed" from this exception alone,
    which is the intended, safe behavior.
    """


class ExpiredSessionError(Exception):
    """A real AuthSession row was found, but its expires_at has passed.

    Distinguished from InvalidSessionError only for the service layer's
    own internal clarity/logging; the future route layer is free to
    treat both identically in its response.
    """


# =============================================================================
# Result types
# =============================================================================


@dataclass(frozen=True)
class CreatedSession:
    """Returned only once, at creation time.

    `token` is the raw, unhashed session token — the only moment it is
    ever available anywhere outside a user's browser. It is never
    logged, never stored, and cannot be recovered from `session` (which
    holds only `token_hash`). The future route layer sets `token` as an
    httpOnly cookie and then discards this object.
    """

    token: str
    session: AuthSession


# =============================================================================
# Password hashing
# =============================================================================


def hash_password(password: str) -> str:
    """Argon2id-hash a plaintext password for storage in User.password_hash.

    Never call this on anything already hashed, and never persist the
    `password` argument itself anywhere.
    """
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored Argon2id hash.

    Uses the library's own verification path (constant-time comparison
    internally) rather than any manual comparison. Returns a plain bool
    — every failure mode the library can raise (mismatch, a corrupted
    hash string, an unsupported hash) is treated identically as "no".
    """
    try:
        _password_hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# A hash of a fixed, non-secret placeholder string — never a real user's
# password. Computed once, lazily, and reused for every login attempt
# against an email that doesn't exist, so authenticate_user always pays
# the cost of one Argon2 verification regardless of whether the user was
# found. Without this, "no such user" would return near-instantly while
# "wrong password for a real user" would take the full hashing time,
# and that timing gap is itself an account-enumeration side channel.
_dummy_hash: str | None = None


def _get_dummy_hash() -> str:
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password(secrets.token_urlsafe(32))
    return _dummy_hash


# =============================================================================
# User authentication
# =============================================================================


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Verify email/password and return the User on success.

    Raises InvalidCredentialsError for both "no such user" and "wrong
    password" — see that exception's docstring. Raises
    InactiveUserError only once credentials are already confirmed
    correct for a real, disabled account.

    Order matters here for timing, not just readability: the password
    hash is verified (against the real hash, or the dummy one if no
    user matched) BEFORE branching on is_active or on whether a user
    was found at all. That keeps the slow step (Argon2 verification)
    on every call, so the fast branching afterward reveals nothing
    through response time — only through the exception raised, which
    the route layer controls.
    """
    user = db.query(User).filter(User.email == email).first()

    hash_to_check = user.password_hash if user is not None else _get_dummy_hash()
    password_ok = verify_password(password, hash_to_check)

    if user is None or not password_ok:
        raise InvalidCredentialsError()

    if not user.is_active:
        raise InactiveUserError()

    return user


# =============================================================================
# Session tokens
# =============================================================================


def generate_session_token() -> str:
    """A cryptographically secure, URL-safe opaque token for a cookie."""
    return secrets.token_urlsafe(_TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """Deterministic SHA-256 hex digest, for storage/lookup only.

    Deterministic (not a salted/slow hash like Argon2) is the correct
    choice here: session tokens already carry 256 bits of their own
    CSPRNG entropy, so they don't need per-record salting the way a
    human-chosen password does — what this hash needs is fast, exact
    equality lookup by an indexed database query, not resistance to
    offline guessing of a token nobody could guess in the first place.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# =============================================================================
# Session lifecycle
# =============================================================================


def create_session(db: Session, user: User) -> CreatedSession:
    """Issue a new session for an already-authenticated user.

    Generates the raw token, stores only its hash, and returns the raw
    token exactly once via CreatedSession — it is not retrievable again
    after this call returns.
    """
    if not user.is_active:
        # Defense in depth: authenticate_user already enforces this
        # before a caller would normally reach here, but create_session
        # must never itself become a way to mint a session for a
        # disabled account.
        raise InactiveUserError()

    token = generate_session_token()
    token_hash = hash_session_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)

    session = AuthSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return CreatedSession(token=token, session=session)


def get_user_from_session(db: Session, token: str) -> User:
    """Validate a raw session token and return its User.

    Hashes the token and looks up AuthSession by that hash — the raw
    token itself is never compared against anything stored, because
    nothing stored is ever a raw token. Rejects a session that doesn't
    exist (InvalidSessionError — this also covers a revoked session,
    since revocation is row deletion), one that has expired
    (ExpiredSessionError), or one whose user has since been deactivated
    (InactiveUserError).
    """
    token_hash = hash_session_token(token)
    session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()

    if session is None:
        raise InvalidSessionError()

    if session.expires_at <= datetime.now(timezone.utc):
        raise ExpiredSessionError()

    # Structurally guaranteed by auth_sessions.user_id's NOT NULL, ON
    # DELETE CASCADE foreign key — a session row cannot outlive its
    # user. Checked anyway rather than trusting that invariant silently.
    user = session.user
    if user is None or not user.is_active:
        raise InactiveUserError()

    return user


def revoke_session(db: Session, token: str) -> None:
    """Log out: delete the session matching this token's hash, if any.

    Idempotent by construction — deleting zero matching rows (an
    already-revoked token, an expired token, or one that never existed)
    is a normal, successful no-op, never an error. The future HTTP
    layer can always clear the browser cookie regardless of what this
    returns.
    """
    token_hash = hash_session_token(token)
    db.query(AuthSession).filter(AuthSession.token_hash == token_hash).delete()
    db.commit()
