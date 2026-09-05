"""The admin approval workflow: list pending accounts, approve them
into a role, disable an account — and the consequences of each on
login and on an already-authenticated session.

Runs entirely against in-memory SQLite (see conftest.py). No pump or
mode command, and no firmware/hardware interaction, appears anywhere
in this file.
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.main import app
from app.models.user import User, UserRole
from app.services import auth_service

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
ADMIN_USERS_URL = "/api/v1/admin/users"

VALID_PASSWORD = "correct-horse-battery"


def _create_admin(db, email="admin@example.com"):
    return auth_service.create_user(
        db,
        email,
        VALID_PASSWORD,
        is_active=True,
        role=UserRole.ADMIN,
        approved_at=datetime.now(timezone.utc),
    )


def _login_as_admin(client, db, email="admin@example.com"):
    _create_admin(db, email)
    response = client.post(LOGIN_URL, json={"email": email, "password": VALID_PASSWORD})
    assert response.status_code == 200, response.text


def _register(client, email="grower@example.com", password=VALID_PASSWORD):
    response = client.post(REGISTER_URL, json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()["id"]


# =============================================================================
# Listing pending users
# =============================================================================


def test_admin_can_list_pending_users(client, db_session):
    _login_as_admin(client, db_session)
    _register(client, "grower1@example.com")
    _register(client, "grower2@example.com")

    response = client.get(f"{ADMIN_USERS_URL}?status=pending")

    assert response.status_code == 200
    emails = {u["email"] for u in response.json()["users"]}
    assert emails == {"grower1@example.com", "grower2@example.com"}


def test_pending_list_excludes_already_approved_and_active_accounts(client, db_session):
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "viewer"})

    response = client.get(f"{ADMIN_USERS_URL}?status=pending")
    assert response.json() == {"users": []}


def test_unsupported_status_filter_is_rejected(client, db_session):
    _login_as_admin(client, db_session)

    response = client.get(f"{ADMIN_USERS_URL}?status=all")

    assert response.status_code == 422


# =============================================================================
# Approving as VIEWER
# =============================================================================


def test_admin_can_approve_a_pending_user_as_viewer(client, db_session):
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    response = client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "viewer"})

    assert response.status_code == 200
    body = response.json()
    assert body["is_active"] is True
    assert body["role"] == "viewer"
    assert body["approved_at"] is not None

    db_session.expire_all()
    user = db_session.query(User).filter(User.id == user_id).one()
    assert user.is_active is True
    assert user.role == "viewer"
    assert user.approved_at is not None


# =============================================================================
# Approving as OPERATOR
# =============================================================================


def test_admin_can_approve_a_pending_user_as_operator(client, db_session):
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    response = client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "operator"})

    assert response.status_code == 200
    assert response.json()["role"] == "operator"


def test_approval_endpoint_refuses_to_grant_admin(client, db_session):
    """ApproveUserRequest only accepts viewer/operator — promoting to
    ADMIN through this endpoint is out of scope by design (see that
    schema's own docstring); scripts/create_admin.py remains the only
    path to an ADMIN account.
    """
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    response = client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "admin"})

    assert response.status_code == 422


# =============================================================================
# Approval -> login actually works
# =============================================================================


def test_an_approved_viewer_can_log_in(client, db_session):
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")
    client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "viewer"})

    # Log out the admin session and try the newly approved account.
    fresh_login = client.post(
        LOGIN_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )
    assert fresh_login.status_code == 200
    assert fresh_login.json()["role"] == "viewer"


def test_an_approved_operator_can_log_in(client, db_session):
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")
    client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "operator"})

    fresh_login = client.post(
        LOGIN_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )
    assert fresh_login.status_code == 200
    assert fresh_login.json()["role"] == "operator"


# =============================================================================
# Disabling
# =============================================================================


def test_admin_can_disable_an_active_user(client, db_session):
    _login_as_admin(client, db_session)
    other = auth_service.create_user(
        db_session,
        "operator@example.com",
        VALID_PASSWORD,
        is_active=True,
        role=UserRole.OPERATOR,
        approved_at=datetime.now(timezone.utc),
    )

    response = client.post(f"{ADMIN_USERS_URL}/{other.id}/disable")

    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_disabled_user_cannot_log_in(client, db_session):
    _login_as_admin(client, db_session)
    other = auth_service.create_user(
        db_session,
        "operator@example.com",
        VALID_PASSWORD,
        is_active=True,
        role=UserRole.OPERATOR,
        approved_at=datetime.now(timezone.utc),
    )
    client.post(f"{ADMIN_USERS_URL}/{other.id}/disable")

    login = client.post(
        LOGIN_URL, json={"email": "operator@example.com", "password": VALID_PASSWORD}
    )

    assert login.status_code == 401
    assert login.json()["detail"] == "Invalid email or password"


def test_disabling_an_active_session_revokes_it_on_the_next_request(client, db_session):
    """The concrete, end-to-end version of "disabling invalidates
    practical access through is_active checks": a user who is already
    logged in, with a live session cookie, loses access on their very
    next request once an admin disables them — with no separate
    session-revocation step, because get_user_from_session re-checks
    is_active on every call.
    """
    _login_as_admin(client, db_session)
    other = auth_service.create_user(
        db_session,
        "operator@example.com",
        VALID_PASSWORD,
        is_active=True,
        role=UserRole.OPERATOR,
        approved_at=datetime.now(timezone.utc),
    )

    # A second, independent client holds the victim's own session —
    # using the SAME client as the admin would overwrite the admin's
    # session cookie with the operator's on login. Both clients share
    # the same app object, and therefore the same get_db override the
    # `client` fixture already installed, so both read/write the same
    # in-memory database.
    victim_client = TestClient(app)
    login = victim_client.post(
        LOGIN_URL, json={"email": "operator@example.com", "password": VALID_PASSWORD}
    )
    assert login.status_code == 200
    assert victim_client.get(ME_URL).status_code == 200

    client.post(f"{ADMIN_USERS_URL}/{other.id}/disable")

    assert victim_client.get(ME_URL).status_code == 401


def test_disabling_a_nonexistent_user_is_404(client, db_session):
    _login_as_admin(client, db_session)

    response = client.post(f"{ADMIN_USERS_URL}/999999/disable")

    assert response.status_code == 404


def test_approving_a_nonexistent_user_is_404(client, db_session):
    _login_as_admin(client, db_session)

    response = client.post(f"{ADMIN_USERS_URL}/999999/approve", json={"role": "viewer"})

    assert response.status_code == 404


# =============================================================================
# PENDING vs DISABLED semantics
#
# The three-state model (see app/models/user.py::User's class
# docstring): PENDING = is_active False AND approved_at NULL (never
# reviewed); DISABLED = is_active False AND approved_at NOT NULL
# (reviewed, then deactivated — whether that review was an approval
# later revoked, or a straight rejection of a pending signup);
# ACTIVE = is_active True. No separate status column — these five
# tests pin down that disable_user and list_pending_users agree on
# exactly this reading of the two existing columns.
# =============================================================================


def test_a_new_signup_appears_in_the_pending_list(client, db_session):
    _login_as_admin(client, db_session)

    user_id = _register(client, "grower@example.com")

    response = client.get(f"{ADMIN_USERS_URL}?status=pending")
    assert [u["id"] for u in response.json()["users"]] == [user_id]


def test_disabling_a_pending_account_removes_it_from_the_pending_list(client, db_session):
    """The fix: rejecting a signup that was never approved must count
    as a review — is_active was already False, but approved_at was
    NULL, and disable_user now fills it in specifically so the account
    stops looking like an unreviewed signup on every future poll.
    """
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    disable_response = client.post(f"{ADMIN_USERS_URL}/{user_id}/disable")
    assert disable_response.status_code == 200
    assert disable_response.json()["is_active"] is False
    assert disable_response.json()["approved_at"] is not None

    pending = client.get(f"{ADMIN_USERS_URL}?status=pending")
    assert pending.json() == {"users": []}

    db_session.expire_all()
    user = db_session.query(User).filter(User.id == user_id).one()
    assert user.is_active is False
    assert user.approved_at is not None


def test_disabling_a_previously_approved_account_does_not_reappear_as_pending(
    client, db_session
):
    """The other half of the fix, stated as its own test so a future
    change to disable_user cannot accidentally satisfy the pending-
    account case while breaking this one: an account that was already
    approved (and so already has approved_at set) must not have that
    timestamp touched or reinterpreted when it is later disabled — it
    is DISABLED, and was never, at any point after approval, PENDING
    again.
    """
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")
    approved = client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "operator"})
    original_approved_at = approved.json()["approved_at"]

    disabled = client.post(f"{ADMIN_USERS_URL}/{user_id}/disable")
    assert disabled.json()["approved_at"] == original_approved_at  # untouched, not re-stamped

    pending = client.get(f"{ADMIN_USERS_URL}?status=pending")
    assert pending.json() == {"users": []}


def test_a_new_signup_can_still_be_approved_normally_after_the_fix(client, db_session):
    """Guards against a regression where fixing the disable path
    accidentally interferes with the ordinary approve path for an
    untouched, still-pending signup.
    """
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    response = client.post(f"{ADMIN_USERS_URL}/{user_id}/approve", json={"role": "viewer"})

    assert response.status_code == 200
    assert response.json()["is_active"] is True
    assert response.json()["role"] == "viewer"

    login = client.post(
        LOGIN_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )
    assert login.status_code == 200


def test_disabling_a_pending_account_twice_is_idempotent(client, db_session):
    """A second disable call on an already-rejected pending account
    must not raise, and must not move its approved_at forward again —
    disable_user only ever fills in a NULL approved_at, never
    overwrites one already set.
    """
    _login_as_admin(client, db_session)
    user_id = _register(client, "grower@example.com")

    first = client.post(f"{ADMIN_USERS_URL}/{user_id}/disable")
    second = client.post(f"{ADMIN_USERS_URL}/{user_id}/disable")

    assert first.status_code == second.status_code == 200
    assert first.json()["approved_at"] == second.json()["approved_at"]


# =============================================================================
# Last-admin protection
# =============================================================================


def test_cannot_disable_the_only_remaining_admin(client, db_session):
    admin = _create_admin(db_session)
    client.post(LOGIN_URL, json={"email": "admin@example.com", "password": VALID_PASSWORD})

    response = client.post(f"{ADMIN_USERS_URL}/{admin.id}/disable")

    assert response.status_code == 409
    db_session.expire_all()
    assert db_session.query(User).filter(User.id == admin.id).one().is_active is True


def test_can_disable_an_admin_when_another_admin_remains_active(client, db_session):
    _login_as_admin(client, db_session, email="admin1@example.com")
    second_admin = _create_admin(db_session, email="admin2@example.com")

    response = client.post(f"{ADMIN_USERS_URL}/{second_admin.id}/disable")

    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_can_disable_an_already_inactive_admin_without_the_last_admin_check(
    client, db_session
):
    """The last-admin guard only applies to an ADMIN that is currently
    active — disabling an already-disabled admin account is a harmless
    no-op, not a path that could ever reduce the active-admin count.
    """
    _login_as_admin(client, db_session, email="admin1@example.com")
    already_disabled_admin = auth_service.create_user(
        db_session,
        "former-admin@example.com",
        VALID_PASSWORD,
        is_active=False,
        role=UserRole.ADMIN,
        approved_at=datetime.now(timezone.utc),
    )

    response = client.post(f"{ADMIN_USERS_URL}/{already_disabled_admin.id}/disable")

    assert response.status_code == 200
