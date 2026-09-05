"""Proof that adding registration did not disturb the live login flow.

This is the regression half of the sign-up change. VERDA is already in
production with people signing in, so the behavior asserted here is not
new behavior being specified — it is existing behavior being pinned down
so a future edit to the auth module has to break a test to break login.

Runs entirely against in-memory SQLite (see conftest.py).
"""

from datetime import datetime, timezone

import pytest

from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
from app.services import auth_service

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
LOGOUT_URL = "/api/v1/auth/logout"

VALID_PASSWORD = "correct-horse-battery"
GENERIC_LOGIN_FAILURE = "Invalid email or password"


def _make_active_user(db, email: str = "operator@example.com", password: str = VALID_PASSWORD):
    """An approved ADMIN account, created exactly the way
    scripts/create_admin.py creates one.
    """
    return auth_service.create_user(
        db,
        email,
        password,
        is_active=True,
        role=UserRole.ADMIN,
        approved_at=datetime.now(timezone.utc),
    )


# =============================================================================
# The existing login flow
# =============================================================================


def test_login_succeeds_and_sets_the_session_cookie(client, db_session):
    _make_active_user(db_session)

    response = client.post(
        LOGIN_URL, json={"email": "operator@example.com", "password": VALID_PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["email"] == "operator@example.com"
    assert client.cookies.get("verda_session") is not None
    assert db_session.query(AuthSession).count() == 1


def test_the_session_token_is_never_stored_or_returned_in_the_clear(client, db_session):
    _make_active_user(db_session)

    response = client.post(
        LOGIN_URL, json={"email": "operator@example.com", "password": VALID_PASSWORD}
    )
    raw_token = client.cookies.get("verda_session")

    assert raw_token not in response.text
    stored = db_session.query(AuthSession).one()
    assert stored.token_hash != raw_token
    assert stored.token_hash == auth_service.hash_session_token(raw_token)


def test_wrong_password_returns_the_generic_401(client, db_session):
    _make_active_user(db_session)

    response = client.post(
        LOGIN_URL, json={"email": "operator@example.com", "password": "wrong-password-here"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_FAILURE
    assert db_session.query(AuthSession).count() == 0


def test_unknown_email_returns_the_same_generic_401(client, db_session):
    _make_active_user(db_session)

    response = client.post(
        LOGIN_URL, json={"email": "nobody@example.com", "password": VALID_PASSWORD}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == GENERIC_LOGIN_FAILURE


def test_me_and_logout_still_work_end_to_end(client, db_session):
    _make_active_user(db_session)
    client.post(LOGIN_URL, json={"email": "operator@example.com", "password": VALID_PASSWORD})

    me = client.get(ME_URL)
    assert me.status_code == 200
    assert me.json()["email"] == "operator@example.com"

    logout = client.post(LOGOUT_URL)
    assert logout.status_code == 200
    assert db_session.query(AuthSession).count() == 0  # revocation is a row delete
    assert client.get(ME_URL).status_code == 401


def test_me_without_a_cookie_is_401(client):
    assert client.get(ME_URL).status_code == 401


# =============================================================================
# Email normalization at login
# =============================================================================


def test_login_accepts_the_email_in_a_different_case_than_it_was_created_with(
    client, db_session
):
    """The reason normalization was added to authenticate_user: a
    correct password must not read as wrong because the address was
    typed with different capitals than at sign-up.
    """
    _make_active_user(db_session, email="operator@example.com")

    response = client.post(
        LOGIN_URL, json={"email": "  Operator@Example.COM  ", "password": VALID_PASSWORD}
    )

    assert response.status_code == 200


def test_normalization_did_not_make_login_accept_a_wrong_password(client, db_session):
    _make_active_user(db_session, email="operator@example.com")

    response = client.post(
        LOGIN_URL, json={"email": "OPERATOR@EXAMPLE.COM", "password": "still-the-wrong-one"}
    )

    assert response.status_code == 401


# =============================================================================
# The approval gate
# =============================================================================


def test_a_freshly_registered_account_cannot_log_in(client, db_session):
    """Registration must not be a way in. The account exists, the
    password is correct, and login still refuses it because an operator
    has not approved it.
    """
    client.post(
        REGISTER_URL, json={"email": "stranger@example.com", "password": VALID_PASSWORD}
    )

    response = client.post(
        LOGIN_URL, json={"email": "stranger@example.com", "password": VALID_PASSWORD}
    )

    assert response.status_code == 401
    assert db_session.query(AuthSession).count() == 0


def test_an_inactive_account_is_indistinguishable_from_a_wrong_password(
    client, db_session
):
    """The approval gate must not become an account-existence oracle at
    login. Both failures are byte-identical.
    """
    client.post(
        REGISTER_URL, json={"email": "stranger@example.com", "password": VALID_PASSWORD}
    )

    pending = client.post(
        LOGIN_URL, json={"email": "stranger@example.com", "password": VALID_PASSWORD}
    )
    unknown = client.post(
        LOGIN_URL, json={"email": "nobody@example.com", "password": VALID_PASSWORD}
    )

    assert pending.status_code == unknown.status_code == 401
    assert pending.json() == unknown.json()


def test_a_registered_account_can_log_in_once_an_admin_approves_it(client, db_session):
    """The full intended lifecycle, end to end: sign up -> row created
    pending/VIEWER -> admin approves (through the real service function,
    not a hand-edited ORM attribute) -> log in -> authenticated session
    -> /me works and reports the assigned role.
    """
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    user = db_session.query(User).filter(User.email == "grower@example.com").one()
    auth_service.approve_user(db_session, user.id, UserRole.OPERATOR)

    login = client.post(
        LOGIN_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )
    assert login.status_code == 200

    me = client.get(ME_URL)
    assert me.status_code == 200
    assert me.json() == {
        "id": user.id,
        "email": "grower@example.com",
        "is_active": True,
        "role": "operator",
    }


# =============================================================================
# The operator bootstrap script
# =============================================================================


def test_create_admin_still_creates_an_active_account(db_session, monkeypatch):
    """scripts/create_admin.py now delegates its row-writing to
    auth_service.create_user. Its externally visible behavior must be
    unchanged: an account that can sign in immediately — and, since
    this task added RBAC, it must specifically be role=ADMIN with
    approved_at set (self-approved at creation), not the VIEWER/pending
    default a self-registered account gets.
    """
    from scripts import create_admin

    monkeypatch.setattr(create_admin, "SessionLocal", lambda: db_session)

    user = create_admin.create_owner_account("owner@example.com", VALID_PASSWORD)

    assert user.is_active is True
    assert user.role == UserRole.ADMIN.value
    assert user.approved_at is not None
    assert user.email == "owner@example.com"
    assert auth_service.verify_password(VALID_PASSWORD, user.password_hash)


def test_create_admin_refuses_a_duplicate_without_overwriting_it(db_session, monkeypatch):
    from scripts import create_admin

    monkeypatch.setattr(create_admin, "SessionLocal", lambda: db_session)

    original = create_admin.create_owner_account("owner@example.com", VALID_PASSWORD)
    original_hash = original.password_hash

    with pytest.raises(create_admin.BootstrapError) as excinfo:
        create_admin.create_owner_account("owner@example.com", "a-different-password")

    assert "already exists" in str(excinfo.value)
    assert VALID_PASSWORD not in str(excinfo.value)
    db_session.expire_all()
    assert db_session.query(User).one().password_hash == original_hash


def test_create_admin_and_register_share_one_password_policy(db_session):
    """Two account-creation paths, one MIN_PASSWORD_LENGTH — asserted so
    the constant cannot be forked back into two copies unnoticed.
    """
    from scripts import create_admin

    assert create_admin.MIN_PASSWORD_LENGTH is auth_service.MIN_PASSWORD_LENGTH

    from app.schema.auth import RegisterRequest

    field = RegisterRequest.model_fields["password"]
    minimums = [c.min_length for c in field.metadata if hasattr(c, "min_length")]
    assert auth_service.MIN_PASSWORD_LENGTH in minimums
