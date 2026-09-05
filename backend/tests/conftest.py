"""Test fixtures for the auth stack.

Nothing here touches a real database. app.settings raises at import time
if the DATABASE_* variables are unset, and app.database.connection builds
a PostgreSQL engine from them, so placeholder values are set below BEFORE
any app module is imported. They are never connected to: SQLAlchemy's
create_engine is lazy, and every test binds its own in-memory SQLite
session through a get_db dependency override instead.

Placeholders are also a deliberate safety measure, not just plumbing.
Setting them here means these tests cannot pick up a developer's real
backend/.env credentials and run against the live Supabase database, no
matter which directory pytest is invoked from.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_HOST", "test-host.invalid")
os.environ.setdefault("DATABASE_PORT", "5432")
os.environ.setdefault("DATABASE_NAME", "test-db")
os.environ.setdefault("DATABASE_USER", "test-user")
os.environ.setdefault("DATABASE_PASSWORD", "test-password")
os.environ.setdefault("BACKEND_API_KEY", "test-api-key")

from datetime import timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import attributes, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database.base import Base  # noqa: E402
from app.database.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.auth_session import AuthSession  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

# Importing app.database.connection (which app.main pulls in) registers
# every model on Base.metadata, so create_all below builds the real
# schema — including the users.email UNIQUE index the duplicate-handling
# tests depend on. SQLite enforces that constraint natively, so the
# race-condition path is exercised for real rather than mocked.


# SQLite has no timezone-aware datetime type: it stores DateTime(timezone=True)
# as a naive string and hands it back naive, so
# auth_service.get_user_from_session's `session.expires_at <= now(utc)`
# comparison raises TypeError under SQLite alone. Production runs on
# PostgreSQL, where TIMESTAMP WITH TIME ZONE round-trips through psycopg2
# as an aware datetime and that comparison is correct.
#
# This listener therefore compensates for the test database, and nothing
# else — the alternative was to weaken real session-expiry code to suit a
# backend production never uses. set_committed_value is used rather than a
# plain assignment so the coercion does not mark the instance dirty and
# provoke a spurious UPDATE on the next flush.
@event.listens_for(AuthSession, "load")
def _sqlite_expires_at_is_utc(target, _context):
    if target.expires_at is not None and target.expires_at.tzinfo is None:
        attributes.set_committed_value(
            target, "expires_at", target.expires_at.replace(tzinfo=timezone.utc)
        )


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """app.rate_limit.limiter is a single module-level instance shared
    by every test in this process (it is imported once, when app.main
    is first imported) — without resetting its in-memory counters
    between tests, a handful of unrelated tests each posting once to
    /register or /login would eventually trip the same real production
    limit (5/hour, 10/minute) and start failing with 429s that have
    nothing to do with what they're actually testing. Runs before every
    test automatically (autouse); tests that specifically exercise
    rate-limiting behavior make their own additional calls within a
    single test to trip it deliberately.
    """
    limiter.reset()
    yield


@pytest.fixture()
def db_session():
    """A fresh, isolated in-memory database per test.

    StaticPool + a single shared connection is required for SQLite
    in-memory: without it each new connection would get its own empty
    database and the tables created here would vanish.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """TestClient wired to the same in-memory database as db_session, so
    a test can assert against rows the API just wrote.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
