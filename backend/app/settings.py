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

_REQUIRED_DATABASE_SETTINGS = {
    "DATABASE_HOST": DATABASE_HOST,
    "DATABASE_PORT": DATABASE_PORT,
    "DATABASE_NAME": DATABASE_NAME,
    "DATABASE_USER": DATABASE_USER,
    "DATABASE_PASSWORD": DATABASE_PASSWORD,
}

missing_settings = [name for name, value in _REQUIRED_DATABASE_SETTINGS.items() if not value]

if missing_settings:
    raise RuntimeError(
        "Missing database configuration: " + ", ".join(missing_settings)
    )

# --- CORS configuration (optional, defaults to local dev origin) -----------
CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")

# --- Device control configuration (optional, parsed lazily by the caller) --
# Kept as a raw string so app.services.device_service can continue parsing
# it lazily, per request, exactly as it does today.
DEVICE_CONTROL_URLS = os.getenv("DEVICE_CONTROL_URLS", "{}")
