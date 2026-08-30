from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class User(Base):
    """A VERDA team member authorized to sign in to the dashboard.

    Controlled access only — there is no public registration. Rows are
    created by an operator-run bootstrap script (a later task), not by
    any API endpoint.
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
