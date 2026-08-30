from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class AuthSession(Base):
    """A server-side, revocable login session.

    Named AuthSession rather than Session to avoid colliding with
    sqlalchemy.orm.Session, which routers already import by that name.
    Table is named auth_sessions (not sessions) for the same clarity
    reason, and to stay visually distinct from Supabase's own unrelated
    auth.sessions table already present in this database's auth schema.

    The raw session token is NEVER stored here — only a SHA-256 hash of
    it (token_hash, sized exactly for a 64-character hex digest). Token
    generation and verification belong to a later task's auth service:
        LOGIN   -> generate opaque token -> store its hash here
                   -> send the raw token only as an httpOnly cookie
        REQUEST -> hash the incoming cookie token -> look up by token_hash
        LOGOUT  -> delete the row (revocation is a DELETE, not a flag)
    """

    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True, index=True)

    # ondelete="CASCADE" (+ passive_deletes below) deliberately diverges
    # from sensor_readings.device_id's nullable, non-cascading FK: a
    # session has no meaning without its user, so deleting a user should
    # always remove their sessions too, whether that delete happens
    # through the ORM or a raw SQL statement.
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    token_hash = Column(String(64), unique=True, nullable=False, index=True)

    # No default: the auth service must always compute this explicitly
    # (issued_at + the configured session TTL) at session-creation time.
    expires_at = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="sessions")
