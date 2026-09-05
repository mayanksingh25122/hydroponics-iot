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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
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

# The single home for VERDA's password floor. Previously lived in
# scripts/create_admin.py, which now imports it from here — every path
# that can create an account (the operator bootstrap script and
# POST /api/v1/auth/register) must enforce the same minimum, and two
# copies of the number is exactly how that stops being true.
#
# Reasoning is unchanged from where it was first written: 12 is a plain,
# documented minimum for a team with no MFA yet, not an elaborate policy
# (no forced symbols, digits, or rotation). It is deliberately higher
# than app.schema.auth.LoginRequest's min_length=1, which must stay
# permissive so login keeps accepting whatever password an account was
# already created with.
MIN_PASSWORD_LENGTH = 12


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


class EmailAlreadyRegisteredError(Exception):
    """create_user was asked to create an account for an email that is
    already taken.

    Deliberately NOT modelled on InvalidCredentialsError's
    anti-enumeration design: registration cannot both refuse a
    duplicate and stay silent about why, so this is a distinct,
    reportable condition. The route layer maps it to a 409 with a
    message that does disclose the email is in use — see that route's
    comment for the tradeoff.
    """


class UserNotFoundError(Exception):
    """No User row matches the given id.

    Raised by approve_user/disable_user — both take a user_id from an
    admin-only route's URL path, and "no such user" must be reported as
    a clean, catchable failure rather than an unhandled None attribute
    access.
    """

    def __init__(self, user_id: int):
        self.user_id = user_id
        super().__init__(f"Unknown user id: {user_id}")


class CannotRemoveLastAdminError(Exception):
    """disable_user refused: this account is the only remaining active
    ADMIN, and disabling it would leave zero accounts able to approve,
    disable, or administer anyone — including re-enabling this one.
    There is deliberately no recovery path from that state other than
    scripts/create_admin.py (direct database access), so this service
    never allows it to be reached through the API.
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
# Email normalization
# =============================================================================


def normalize_email(email: str) -> str:
    """The one canonical form an email takes before it touches the
    database, on any path — registration, the operator bootstrap
    script, or a login lookup.

    Exactly the transformation scripts/create_admin.py has always
    applied (.strip().lower()), lifted here so registration and login
    cannot drift apart. Without login normalizing too, an account
    registered as "Person@Example.com" would be stored lowercase and
    then fail to authenticate when its owner types it back with the
    same capitals they signed up with — a wrong-password error for a
    correct password.

    Lowercasing the whole address (not just the domain, which the
    RFC-strict reading would allow) matches what every account in this
    database was already created with, so this widens what login
    accepts without invalidating any credential that works today.
    """
    return email.strip().lower()


# =============================================================================
# User creation
# =============================================================================


def create_user(
    db: Session,
    email: str,
    password: str,
    *,
    is_active: bool,
    role: UserRole,
    approved_at: datetime | None,
) -> User:
    """Create one account and return it. The single account-creation
    path in the codebase — both POST /api/v1/auth/register and
    scripts/create_admin.py go through here, so an account created
    either way is byte-for-byte equivalent.

    `password` is Argon2id-hashed by hash_password() before it can
    become a SQL bound parameter; the plaintext is never assigned to a
    model attribute, never logged, and never returned.

    `is_active`, `role`, and `approved_at` are all keyword-only with no
    defaults, on purpose. `role` alone is now the thing standing between
    a newly created row and full pump/relay control of real hardware
    (app.api.v1.routes.auth.require_role) — every caller must state all
    three explicitly rather than inherit a default that a later edit
    could quietly flip. Typical call shapes:

        register (self-signup):  is_active=False, role=VIEWER,
                                  approved_at=None   (pending review)
        create_admin.py (bootstrap): is_active=True, role=ADMIN,
                                  approved_at=<now>  (self-approved)

    Raises EmailAlreadyRegisteredError if the address is taken. Two
    independent guards, because the pre-check alone is a race: between
    its SELECT and this INSERT, a concurrent request can claim the same
    address. users.email's UNIQUE index is the authority that actually
    settles it, and the IntegrityError it raises is translated into the
    same exception so callers only ever see one duplicate signal.
    """
    email = normalize_email(email)

    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise EmailAlreadyRegisteredError()

    user = User(
        email=email,
        password_hash=hash_password(password),
        is_active=is_active,
        role=UserRole(role).value,
        approved_at=approved_at,
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        # Lost the race described above. Roll back so the caller's
        # session stays usable, then report it identically to the
        # pre-check's outcome.
        db.rollback()
        raise EmailAlreadyRegisteredError()

    db.refresh(user)
    return user


# =============================================================================
# Account approval / disabling (admin actions)
# =============================================================================


def list_pending_users(db: Session) -> list[User]:
    """Accounts awaiting admin review, oldest first.

    "Pending" is defined narrowly as is_active=False AND
    approved_at IS NULL — never reviewed at all. A DISABLED account
    (approved_at IS NOT NULL, is_active=False) is deliberately excluded:
    it has already been reviewed once, and mixing it back into the same
    queue as a brand-new signup would blur "never looked at" with
    "looked at and turned away", which is exactly the distinction
    approved_at exists to preserve — see User's class docstring.
    """
    return (
        db.query(User)
        .filter(User.is_active == False, User.approved_at.is_(None))  # noqa: E712
        .order_by(User.created_at.asc())
        .all()
    )


def approve_user(db: Session, user_id: int, role: UserRole) -> User:
    """Activates an account and assigns its role. The only place a
    self-registered account can ever become is_active=True — see
    app.api.v1.routes.auth.register, which never sets it itself.

    Works on any account, not only a still-pending one: calling this
    again on an already-approved account simply re-sets its role and
    refreshes approved_at, which is also how a role gets changed after
    the fact (there is no separate "change role" endpoint in this
    minimal design — approve IS the role-assignment action).

    `role` is taken from the caller (the admin route layer), never
    inferred or defaulted — see that route's own restriction to
    VIEWER/OPERATOR only, which happens above this function, not here.
    This function itself does not forbid ADMIN, since scripts/
    create_admin.py has no other way to exist and its bootstrap account
    predates any admin route being reachable at all; the restriction
    belongs to the specific "approve a pending user" API surface, not to
    this lower-level primitive.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise UserNotFoundError(user_id)

    user.is_active = True
    user.role = UserRole(role).value
    user.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user


def disable_user(db: Session, user_id: int) -> User:
    """Deactivates an account: is_active=False. Also stamps approved_at
    if it is still NULL — see below; that is the one field besides
    is_active this function ever touches.

    Existing sessions for this user stop authenticating on their very
    next request with no separate revocation step: get_user_from_session
    re-checks is_active on every call (see that function), so this is
    sufficient by itself — no AuthSession rows need to be found or
    deleted here.

    Refuses to disable the last remaining active ADMIN
    (CannotRemoveLastAdminError). There is no recovery path from zero
    active admins other than direct database access
    (scripts/create_admin.py), so this service never allows the API to
    reach that state.

    PENDING vs DISABLED (see User's class docstring and
    list_pending_users): calling this on a still-PENDING account
    (approved_at IS NULL) is a REJECTION, not a no-op — is_active was
    already False, but approved_at is stamped "now" here specifically
    so the account is marked reviewed and leaves list_pending_users'
    queue, exactly as an approval would, rather than reappearing on
    every future poll as though it were a brand-new signup nobody has
    looked at yet. Calling this on an already-approved account (which
    already has approved_at set) leaves that timestamp exactly as it
    was — this function only ever fills in a missing approved_at, never
    overwrites an existing one, so "when this account was approved" is
    never rewritten into "when it was disabled".
    """
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise UserNotFoundError(user_id)

    if user.role == UserRole.ADMIN.value and user.is_active:
        remaining_admins = (
            db.query(User)
            .filter(
                User.role == UserRole.ADMIN.value,
                User.is_active == True,  # noqa: E712
                User.id != user_id,
            )
            .count()
        )
        if remaining_admins == 0:
            raise CannotRemoveLastAdminError()

    user.is_active = False
    if user.approved_at is None:
        user.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user


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

    The email is put through normalize_email() before the lookup so a
    correct password never reads as wrong purely because the address
    was typed with different capitalization than at sign-up. See that
    function for why this cannot invalidate an existing credential.
    """
    user = db.query(User).filter(User.email == normalize_email(email)).first()

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
