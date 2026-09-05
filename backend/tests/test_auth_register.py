"""Registration behavior for POST /api/v1/auth/register.

Every test here runs against an in-memory SQLite database created fresh
per test (see conftest.py) — no production data is read or written.
"""

import pytest
from sqlalchemy.orm import sessionmaker

from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
from app.services import auth_service

REGISTER_URL = "/api/v1/auth/register"

VALID_PASSWORD = "correct-horse-battery"  # 21 chars, over MIN_PASSWORD_LENGTH


# =============================================================================
# Successful registration
# =============================================================================


def test_register_returns_201_and_a_safe_body(client):
    response = client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    assert response.status_code == 201
    body = response.json()
    # Asserted as an exact key set, so any field added to the response
    # in future — password_hash above all — fails here rather than
    # quietly shipping.
    assert set(body) == {"id", "email", "is_active", "role"}
    assert body["email"] == "grower@example.com"
    assert body["is_active"] is False
    assert body["role"] == "viewer"
    assert VALID_PASSWORD not in response.text


def test_register_persists_the_user(client, db_session):
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    user = db_session.query(User).filter(User.email == "grower@example.com").one()
    assert user.id is not None
    assert user.created_at is not None


def test_register_creates_an_inactive_account(client, db_session):
    """The security decision this endpoint turns on: a self-registered
    account must not be able to log in until an admin approves it.
    """
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    user = db_session.query(User).filter(User.email == "grower@example.com").one()
    assert user.is_active is False


def test_register_creates_a_viewer_pending_admin_review(client, db_session):
    """The RBAC decision this endpoint turns on: even once approved, a
    self-registered account must default to the LEAST-privileged role,
    never OPERATOR or ADMIN — an admin has to deliberately grant more.
    approved_at stays NULL: this account has never been reviewed at
    all (see auth_service.list_pending_users, which keys on exactly
    this).
    """
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    user = db_session.query(User).filter(User.email == "grower@example.com").one()
    assert user.role == UserRole.VIEWER.value
    assert user.approved_at is None


def test_register_does_not_create_a_session_or_set_a_cookie(client, db_session):
    response = client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    assert "set-cookie" not in {key.lower() for key in response.headers}
    assert response.cookies.get("verda_session") is None
    assert db_session.query(AuthSession).count() == 0


# =============================================================================
# Password handling
# =============================================================================


def test_register_stores_an_argon2id_hash_never_the_plaintext(client, db_session):
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    user = db_session.query(User).filter(User.email == "grower@example.com").one()
    assert user.password_hash != VALID_PASSWORD
    assert VALID_PASSWORD not in user.password_hash
    assert user.password_hash.startswith("$argon2id$")
    # The stored hash must be the real thing the login path verifies
    # against, not merely "not the plaintext".
    assert auth_service.verify_password(VALID_PASSWORD, user.password_hash) is True
    assert auth_service.verify_password("wrong-password", user.password_hash) is False


def test_two_accounts_with_the_same_password_get_different_hashes(client, db_session):
    client.post(REGISTER_URL, json={"email": "a@example.com", "password": VALID_PASSWORD})
    client.post(REGISTER_URL, json={"email": "b@example.com", "password": VALID_PASSWORD})

    hashes = {user.password_hash for user in db_session.query(User).all()}
    assert len(hashes) == 2  # per-password salt, not a bare digest


# =============================================================================
# Email normalization
# =============================================================================


def test_register_normalizes_email_case_and_whitespace(client, db_session):
    response = client.post(
        REGISTER_URL,
        json={"email": "  Grower@Example.COM  ", "password": VALID_PASSWORD},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "grower@example.com"
    assert db_session.query(User).filter(User.email == "grower@example.com").count() == 1


def test_case_variant_of_a_registered_email_is_rejected_as_duplicate(client, db_session):
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    response = client.post(
        REGISTER_URL, json={"email": "GROWER@example.com", "password": VALID_PASSWORD}
    )

    assert response.status_code == 409
    assert db_session.query(User).count() == 1


# =============================================================================
# Duplicate handling
# =============================================================================


def test_duplicate_email_returns_409_and_never_overwrites_the_existing_row(
    client, db_session
):
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )
    original_hash = (
        db_session.query(User).filter(User.email == "grower@example.com").one().password_hash
    )

    response = client.post(
        REGISTER_URL,
        json={"email": "grower@example.com", "password": "a-completely-different-one"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists"

    db_session.expire_all()
    survivor = db_session.query(User).filter(User.email == "grower@example.com").one()
    assert survivor.password_hash == original_hash
    assert db_session.query(User).count() == 1


def test_the_unique_constraint_catches_a_duplicate_that_wins_the_race(
    db_session, monkeypatch
):
    """create_user's pre-check is not sufficient on its own: between its
    SELECT and its INSERT, a concurrent request can claim the same
    address. users.email's UNIQUE index is what actually settles it.

    That window is reproduced here rather than described — the conflicting
    row is inserted from a second session, from inside hash_password,
    which create_user calls after its pre-check has already passed and
    before it commits. The assertion is that the resulting IntegrityError
    never escapes as itself; callers see exactly one duplicate signal.
    """
    OtherSession = sessionmaker(bind=db_session.get_bind())
    real_hash_password = auth_service.hash_password

    def hash_password_and_lose_the_race(password: str) -> str:
        monkeypatch.setattr(auth_service, "hash_password", real_hash_password)
        other = OtherSession()
        try:
            other.add(
                User(
                    email="grower@example.com",
                    password_hash="placeholder-not-a-real-hash",
                    is_active=False,
                )
            )
            other.commit()
        finally:
            other.close()
        return real_hash_password(password)

    monkeypatch.setattr(auth_service, "hash_password", hash_password_and_lose_the_race)

    with pytest.raises(auth_service.EmailAlreadyRegisteredError):
        auth_service.create_user(
            db_session,
            "grower@example.com",
            VALID_PASSWORD,
            is_active=False,
            role=UserRole.VIEWER,
            approved_at=None,
        )

    db_session.expire_all()
    assert db_session.query(User).count() == 1


def test_the_request_session_still_works_after_a_duplicate_rejection(client, db_session):
    """A rolled-back failed INSERT must not poison the session for the
    next caller.
    """
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )
    client.post(
        REGISTER_URL, json={"email": "grower@example.com", "password": VALID_PASSWORD}
    )

    response = client.post(
        REGISTER_URL, json={"email": "second@example.com", "password": VALID_PASSWORD}
    )

    assert response.status_code == 201
    assert db_session.query(User).count() == 2


# =============================================================================
# Input validation
# =============================================================================


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"password": VALID_PASSWORD}, id="missing-email"),
        pytest.param({"email": "grower@example.com"}, id="missing-password"),
        pytest.param({}, id="missing-both"),
        pytest.param(
            {"email": "not-an-email", "password": VALID_PASSWORD}, id="malformed-email"
        ),
        pytest.param({"email": "", "password": VALID_PASSWORD}, id="empty-email"),
        pytest.param(
            {"email": "grower@example.com", "password": ""}, id="empty-password"
        ),
        pytest.param(
            {"email": "grower@example.com", "password": "short"}, id="password-too-short"
        ),
        pytest.param(
            {"email": "grower@example.com", "password": "a" * 11},
            id="password-one-below-minimum",
        ),
        pytest.param(
            {"email": "grower@example.com", "password": "a" * 257},
            id="password-over-maximum",
        ),
    ],
)
def test_invalid_input_is_rejected_without_creating_a_user(client, db_session, payload):
    response = client.post(REGISTER_URL, json=payload)

    assert response.status_code == 422
    assert db_session.query(User).count() == 0


def test_password_at_exactly_the_minimum_is_accepted(client):
    response = client.post(
        REGISTER_URL,
        json={
            "email": "grower@example.com",
            "password": "a" * auth_service.MIN_PASSWORD_LENGTH,
        },
    )

    assert response.status_code == 201


def test_a_validation_error_never_echoes_the_password(client):
    response = client.post(
        REGISTER_URL, json={"email": "not-an-email", "password": "hunter2-hunter2"}
    )

    assert response.status_code == 422
    assert "hunter2-hunter2" not in response.text
