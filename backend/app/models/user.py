from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class UserRole(str, Enum):
    """VERDA's three-role authorization model.

    Stored as a plain VARCHAR (User.role below), not a Postgres ENUM —
    matching this project's existing convention of validating a fixed
    set of string values in Python/Pydantic rather than at the database
    type level (see DeviceCommand.command_type / status, and
    PumpModeCommand.mode's Pydantic Literal in app.schema.device). A
    Python str-Enum was chosen over a bare Literal here specifically
    because role is referenced across many files — the model's column
    default, auth_service's role-changing functions, the require_role
    route dependency, and admin schemas — where a shared, importable
    symbol is worth more than the Literal convention's brevity.

    VIEWER   - authenticated dashboard/read access only. Cannot control
               any hardware and cannot manage other users. The safe
               default for a newly self-registered account
               (POST /api/v1/auth/register) — see that route's
               docstring for why an unscoped RBAC-less default would be
               unsafe on a system that can drive a live 230V pump.
    OPERATOR - VIEWER's access, plus may queue pump/pump-mode commands
               (app.routers.device.set_pump / set_pump_mode).
    ADMIN    - OPERATOR's access, plus may list pending accounts,
               approve them (assigning VIEWER or OPERATOR — never ADMIN
               through that endpoint), and disable any account. Never
               self-assignable through any public API — the only path
               that creates one is scripts/create_admin.py, the
               operator-run bootstrap script.
    """

    VIEWER = "viewer"
    OPERATOR = "operator"
    ADMIN = "admin"


class User(Base):
    """A VERDA team member authorized to sign in to the dashboard.

    Two paths create rows here, both through
    app.services.auth_service.create_user():

      - scripts/create_admin.py, the operator-run bootstrap script,
        creates accounts with is_active=True, role=ADMIN.
      - POST /api/v1/auth/register, public sign-up, creates them with
        is_active=False, role=VIEWER, approved_at=None.

    is_active determines whether the account can authenticate AT ALL
    (see auth_service.authenticate_user / get_user_from_session, both
    of which re-check it on every request). It does NOT by itself
    determine what an authenticated user can then do — that is role's
    job, enforced by app.api.v1.routes.auth.require_role, applied to
    every route that can affect physical hardware
    (app.routers.device.set_pump / set_pump_mode).

    approved_at is nullable and distinguishes two states that are both
    is_active=False: PENDING (approved_at IS NULL — never reviewed by
    an admin, e.g. a fresh self-registration) versus DISABLED
    (approved_at IS NOT NULL but the account was later deactivated).
    See auth_service.list_pending_users, which relies on exactly this
    distinction. It is set once, by auth_service.approve_user, and by
    scripts/create_admin.py at bootstrap creation time; disabling an
    account (auth_service.disable_user) does not touch it.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String(255), unique=True, nullable=False, index=True)

    # Argon2id encoded hash (algorithm, cost params, salt, and digest all
    # encoded together as one string) — never a plaintext password.
    # Hashing itself is implemented by a later task; this column only
    # ever stores that output. 255 chars comfortably fits an encoded
    # Argon2id hash at any reasonable cost parameters.
    password_hash = Column(String(255), nullable=False)

    is_active = Column(Boolean, nullable=False, default=True)

    # Python-side default only (matching is_active's own pattern above)
    # — never a migration-level server_default for new rows going
    # forward. app.services.auth_service.create_user's role parameter
    # is keyword-only with no default, so every caller must still state
    # its intent explicitly; this default exists only as a defense-in-
    # depth fallback for any row created outside that path, and is
    # deliberately the least-privileged role.
    role = Column(String(20), nullable=False, default=UserRole.VIEWER.value)

    # NULL = never reviewed by an admin (pending). Non-NULL = reviewed,
    # whether the outcome was approval or disabling — see the class
    # docstring above and auth_service.list_pending_users.
    approved_at = Column(DateTime(timezone=True), nullable=True)

    # Unlike devices/sensor_readings, a user row is meaningless without
    # its identity fields, so these are non-nullable here even though
    # the sibling models use nullable timestamp columns with a server
    # default.
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    sessions = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # No cascade here, unlike sessions: a DeviceCommand is a historical
    # audit record ("this user asked for this"), worth preserving even
    # if the user account is later removed — see DeviceCommand's own
    # docstring. requested_by_user_id has no ON DELETE CASCADE either,
    # so deleting a user with existing command rows is left to the
    # database's default RESTRICT behavior.
    requested_commands = relationship("DeviceCommand", back_populates="requested_by")
