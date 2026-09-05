"""add user role and approved_at

Revision ID: 76b2e3f1efb6
Revises: d79a21f03fa0
Create Date: 2026-09-05 00:00:00.000000

Introduces VERDA's minimal RBAC model (see app.models.user.UserRole):
users.role (VIEWER / OPERATOR / ADMIN, a plain VARCHAR — deliberately
NOT a Postgres ENUM type, matching this project's existing convention
of validating fixed string values in Python/Pydantic rather than at the
database type level) and users.approved_at (nullable timestamp, marking
whether an account has ever been reviewed by an admin).

Why this migration exists: prior to this change, is_active was the
ONLY authorization signal in the schema, and every account that could
log in had identical, unscoped access — including control of a live
230V circulation pump (app.routers.device.set_pump /
set_pump_mode). Public self-registration (POST /api/v1/auth/register)
makes that no longer acceptable: a newly approved self-registered
account must default to read-only (VIEWER), not full hardware control.

BACKFILL POLICY — read this before ever running this against a new
environment:
Every row that exists before this migration runs predates the public
registration endpoint on this branch and was therefore created solely
by scripts/create_admin.py (the only account-creation path that
existed at the time), which always sets is_active=True. This was
verified directly against the production database before writing this
migration (2026-09-05): exactly one such account existed
(is_active=true), and zero accounts existed with is_active=false. The
UPDATE below promotes every is_active=true row to ADMIN accordingly —
it is not a guess, and it is scoped to is_active=true specifically so
it can never promote an inactive/pending row should one somehow exist
in some other environment. Any row NOT matched by this WHERE clause
keeps the column's default (VIEWER) rather than being touched.

If you are running this against an environment where that assumption
does not hold (e.g. a fork with different history), STOP and verify
account provenance before upgrading — do not assume this backfill
policy is correct for a database that hasn't been checked.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '76b2e3f1efb6'
down_revision: Union[str, Sequence[str], None] = 'd79a21f03fa0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default='viewer' here exists ONLY to satisfy the NOT NULL
    # constraint for this ALTER against a table that may already have
    # rows — it is not meant to describe what any existing account's
    # role should be. That is decided explicitly by the UPDATE below,
    # then the server_default is dropped so it can never silently apply
    # to a future row again (app.models.user.User.role's own
    # Python-side default, and auth_service.create_user's keyword-only
    # role parameter, are what govern new rows from here on).
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='viewer'),
    )
    op.add_column(
        'users',
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
    )

    # See the module docstring's BACKFILL POLICY section — verified
    # against production immediately before writing this migration.
    op.execute(
        "UPDATE users SET role = 'admin', approved_at = created_at WHERE is_active = true"
    )

    op.alter_column('users', 'role', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'approved_at')
    op.drop_column('users', 'role')
