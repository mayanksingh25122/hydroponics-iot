"""Role-based authorization: who can control hardware, and who can
reach the admin API.

Every test here goes through the real HTTP routes (client fixture) with
a real session cookie — never a direct call to require_role or a
service function standing in for the actual request path — because the
thing under test IS the route-level authorization boundary. No pump or
mode command is ever delivered anywhere: this project's command
architecture only ever writes a queued DeviceCommand row
(app.services.command_service) to an in-memory SQLite database, and the
ESP32 firmware is never invoked, started, or contacted by any test in
this repository.

Runs entirely against in-memory SQLite (see conftest.py).
"""

from datetime import datetime, timezone

from app.models.device import Device
from app.models.user import User, UserRole
from app.services import auth_service

LOGIN_URL = "/api/v1/auth/login"
PUMP_URL = "/api/devices/{device_id}/pump"
PUMP_MODE_URL = "/api/devices/{device_id}/pump/mode"
ADMIN_LIST_URL = "/api/v1/admin/users?status=pending"

VALID_PASSWORD = "correct-horse-battery"


def _create_user(db, email, role, *, is_active=True, password=VALID_PASSWORD):
    return auth_service.create_user(
        db,
        email,
        password,
        is_active=is_active,
        role=role,
        approved_at=datetime.now(timezone.utc) if is_active else None,
    )


def _create_device(db, device_id: int = 1) -> Device:
    device = Device(id=device_id, device_name="Test Device", device_id=f"test-device-{device_id}")
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def _login_as(client, email, password=VALID_PASSWORD):
    response = client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response


# =============================================================================
# Pump control — VIEWER denied, OPERATOR and ADMIN allowed
# =============================================================================


def test_viewer_cannot_turn_on_the_pump(client, db_session):
    _create_device(db_session)
    _create_user(db_session, "viewer@example.com", UserRole.VIEWER)
    _login_as(client, "viewer@example.com")

    response = client.post(PUMP_URL.format(device_id=1), json={"state": True})

    assert response.status_code == 403
    assert response.json()["detail"] == "You do not have permission to perform this action"


def test_viewer_cannot_change_pump_mode(client, db_session):
    _create_device(db_session)
    _create_user(db_session, "viewer@example.com", UserRole.VIEWER)
    _login_as(client, "viewer@example.com")

    response = client.post(PUMP_MODE_URL.format(device_id=1), json={"mode": "manual"})

    assert response.status_code == 403


def test_operator_can_turn_on_the_pump(client, db_session):
    _create_device(db_session)
    _create_user(db_session, "operator@example.com", UserRole.OPERATOR)
    _login_as(client, "operator@example.com")

    response = client.post(PUMP_URL.format(device_id=1), json={"state": True})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["status"] == "queued"


def test_operator_can_change_pump_mode(client, db_session):
    _create_device(db_session)
    _create_user(db_session, "operator@example.com", UserRole.OPERATOR)
    _login_as(client, "operator@example.com")

    response = client.post(PUMP_MODE_URL.format(device_id=1), json={"mode": "manual"})

    assert response.status_code == 200
    assert response.json()["status"] == "queued"


def test_admin_can_turn_on_the_pump(client, db_session):
    """ADMIN implies OPERATOR-level hardware access too — a strict
    superset, per the approved role model (VIEWER < OPERATOR < ADMIN).
    """
    _create_device(db_session)
    _create_user(db_session, "admin@example.com", UserRole.ADMIN)
    _login_as(client, "admin@example.com")

    response = client.post(PUMP_URL.format(device_id=1), json={"state": False})

    assert response.status_code == 200
    assert response.json()["status"] == "queued"


def test_admin_can_change_pump_mode(client, db_session):
    _create_device(db_session)
    _create_user(db_session, "admin@example.com", UserRole.ADMIN)
    _login_as(client, "admin@example.com")

    response = client.post(PUMP_MODE_URL.format(device_id=1), json={"mode": "auto"})

    assert response.status_code == 200


def test_unauthenticated_pump_request_is_401_not_403(client, db_session):
    """No session at all is a different failure than "wrong role" —
    get_current_user's 401 must fire before require_role's 403 ever
    gets a chance to, since require_role depends on get_current_user
    rather than duplicating its check.
    """
    _create_device(db_session)

    response = client.post(PUMP_URL.format(device_id=1), json={"state": True})

    assert response.status_code == 401


# =============================================================================
# Admin API — only ADMIN may reach it
# =============================================================================


def test_viewer_cannot_list_pending_users(client, db_session):
    _create_user(db_session, "viewer@example.com", UserRole.VIEWER)
    _login_as(client, "viewer@example.com")

    response = client.get(ADMIN_LIST_URL)

    assert response.status_code == 403


def test_operator_cannot_list_pending_users(client, db_session):
    _create_user(db_session, "operator@example.com", UserRole.OPERATOR)
    _login_as(client, "operator@example.com")

    response = client.get(ADMIN_LIST_URL)

    assert response.status_code == 403


def test_admin_can_list_pending_users(client, db_session):
    _create_user(db_session, "admin@example.com", UserRole.ADMIN)
    _login_as(client, "admin@example.com")

    response = client.get(ADMIN_LIST_URL)

    assert response.status_code == 200
    assert response.json() == {"users": []}


def test_viewer_cannot_approve_a_user(client, db_session):
    _create_user(db_session, "viewer@example.com", UserRole.VIEWER)
    pending = _create_user(
        db_session, "pending@example.com", UserRole.VIEWER, is_active=False
    )
    _login_as(client, "viewer@example.com")

    response = client.post(
        f"/api/v1/admin/users/{pending.id}/approve", json={"role": "viewer"}
    )

    assert response.status_code == 403


def test_operator_cannot_approve_a_user(client, db_session):
    _create_user(db_session, "operator@example.com", UserRole.OPERATOR)
    pending = _create_user(
        db_session, "pending@example.com", UserRole.VIEWER, is_active=False
    )
    _login_as(client, "operator@example.com")

    response = client.post(
        f"/api/v1/admin/users/{pending.id}/approve", json={"role": "operator"}
    )

    assert response.status_code == 403


def test_viewer_cannot_disable_a_user(client, db_session):
    _create_user(db_session, "viewer@example.com", UserRole.VIEWER)
    other = _create_user(db_session, "someone@example.com", UserRole.OPERATOR)
    _login_as(client, "viewer@example.com")

    response = client.post(f"/api/v1/admin/users/{other.id}/disable")

    assert response.status_code == 403


def test_operator_cannot_disable_a_user(client, db_session):
    _create_user(db_session, "operator@example.com", UserRole.OPERATOR)
    other = _create_user(db_session, "someone@example.com", UserRole.VIEWER)
    _login_as(client, "operator@example.com")

    response = client.post(f"/api/v1/admin/users/{other.id}/disable")

    assert response.status_code == 403


def test_unauthenticated_admin_request_is_401_not_403(client, db_session):
    response = client.get(ADMIN_LIST_URL)
    assert response.status_code == 401


# =============================================================================
# Admin safety — self-approval, role injection, corrupted role data
# =============================================================================


def test_a_non_admin_cannot_approve_their_own_account(client, db_session):
    """A viewer/operator calling approve on their OWN user id must be
    refused exactly like calling it on anyone else's — require_role(ADMIN)
    gates the whole endpoint before the target user_id is ever looked
    at, so there is no separate "is this the caller's own row" check to
    get wrong. A pending (never-approved) account has no session at all
    to attempt this with in the first place, which is the stronger,
    structural version of the same guarantee.
    """
    operator = _create_user(db_session, "operator@example.com", UserRole.OPERATOR)
    _login_as(client, "operator@example.com")

    response = client.post(
        f"/api/v1/admin/users/{operator.id}/approve", json={"role": "operator"}
    )

    assert response.status_code == 403


def test_an_unrecognized_stored_role_value_fails_closed_not_500(client, db_session):
    """require_role must never let a role value outside VIEWER/OPERATOR/
    ADMIN crash into an unhandled 500 — every write path that can set
    User.role only ever stores a UserRole's .value, so this should be
    unreachable in practice, but a hand-edited or migration-corrupted
    row must still fail CLOSED (403), the same as any other
    insufficient-role case, not open, and not with a stack trace.
    """
    corrupted = _create_user(db_session, "corrupted@example.com", UserRole.VIEWER)
    db_session.query(User).filter(User.id == corrupted.id).update({"role": "superuser"})
    db_session.commit()
    _login_as(client, "corrupted@example.com")

    pump_response = client.post(PUMP_URL.format(device_id=1), json={"state": True})
    admin_response = client.get(ADMIN_LIST_URL)

    assert pump_response.status_code == 403
    assert admin_response.status_code == 403
