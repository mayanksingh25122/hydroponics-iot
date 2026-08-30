"""Single explicit configuration loading point for the backend.

`app.main` and `app.database.connection` read their configuration from this
module. `app.services.device_service` still reads `DEVICE_CONTROL_URLS` via
its own `os.getenv` call, lazily per request, pending a separate change to
the device communication architecture.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# This module lives at backend/app/settings.py. Load both environment files
# explicitly so starting Uvicorn from either the repository root or the
# backend directory produces the same configuration. The backend file is
# loaded last, allowing server-only values to override shared defaults.
BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

# --- Database configuration (required) -------------------------------------
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_NAME = os.getenv("DATABASE_NAME")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")

# --- Backend API key (required) ---------------------------------------------
# Shared secret checked by app.routers.device's require_api_key dependency.
# No default is provided on purpose: an unset key must fail startup, not
# silently leave device-actuation routes unprotected.
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")

# Every setting the backend cannot run without, validated in one pass. Reported
# together rather than one-per-restart: a developer with an empty .env should
# learn the whole list from a single failed start, not discover it one variable
# at a time. Raising conditions are unchanged — any missing value still aborts
# startup, and no setting has gained a default.
_REQUIRED_SETTINGS = {
    "DATABASE_HOST": DATABASE_HOST,
    "DATABASE_PORT": DATABASE_PORT,
    "DATABASE_NAME": DATABASE_NAME,
    "DATABASE_USER": DATABASE_USER,
    "DATABASE_PASSWORD": DATABASE_PASSWORD,
    "BACKEND_API_KEY": BACKEND_API_KEY,
}

missing_settings = [name for name, value in _REQUIRED_SETTINGS.items() if not value]

if missing_settings:
    raise RuntimeError(
        "Missing required configuration: "
        + ", ".join(missing_settings)
        + ". Set these in backend/.env (see backend/.env.example)."
    )

# --- CORS configuration (optional, defaults to local dev origin) -----------
CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")

# --- Device control configuration (optional, parsed lazily by the caller) --
# Kept as a raw string so app.services.device_service can continue parsing
# it lazily, per request, exactly as it does today.
DEVICE_CONTROL_URLS = os.getenv("DEVICE_CONTROL_URLS", "{}")

# --- Session configuration (optional) ---------------------------------------
# How long a login session (app.models.auth_session.AuthSession) stays valid
# before requiring a fresh login. 7 days is the default: long enough that a
# small, trusted internal team isn't re-authenticating daily, short enough
# that a leaked/stolen session token eventually stops working on its own
# even if nobody notices and revokes it. Override with SESSION_TTL_DAYS in
# production if a shorter or longer window is ever needed — no code change
# required.
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "7"))

# --- Session cookie configuration (optional, dev-safe defaults) -------------
# Every default below is chosen to work correctly against a plain-HTTP local
# dev setup (frontend on http://localhost:5173, backend on
# http://localhost:8000 — different origins, same "site") without any .env
# changes, while remaining fully overridable for a real HTTPS deployment.
#
# SESSION_COOKIE_SECURE defaults to false because local dev is plain HTTP —
# a Secure cookie is never sent by the browser over HTTP, so this MUST be
# set to true in production (over HTTPS), or login would appear to work
# but no cookie would ever actually be stored.
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "verda_session")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").strip().lower() == "true"
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower()
SESSION_COOKIE_PATH = os.getenv("SESSION_COOKIE_PATH", "/")

# Deliberately unset (host-only cookie) by default rather than defaulting to
# "localhost" — an explicit Domain=localhost is unnecessary for same-site
# localhost development and only invites cross-port leakage; set
# SESSION_COOKIE_DOMAIN explicitly (e.g. ".verda.io") only once frontend and
# backend share a real parent domain in production.
SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN") or None

_VALID_SAMESITE_VALUES = {"lax", "strict", "none"}
if SESSION_COOKIE_SAMESITE not in _VALID_SAMESITE_VALUES:
    raise RuntimeError(
        "Invalid SESSION_COOKIE_SAMESITE: "
        + repr(SESSION_COOKIE_SAMESITE)
        + ". Must be one of: lax, strict, none."
    )

if SESSION_COOKIE_SAMESITE == "none" and not SESSION_COOKIE_SECURE:
    # Browsers reject SameSite=None cookies that aren't also Secure — this
    # combination would silently fail to set the cookie at all, which is a
    # confusing way to discover a misconfiguration. Fail loudly instead.
    raise RuntimeError(
        "SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true "
        "(browsers reject non-Secure SameSite=None cookies)."
    )
