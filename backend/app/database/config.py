import os
from pathlib import Path

from dotenv import load_dotenv


# This module lives at backend/app/database/config.py.  Load both environment
# files explicitly so starting Uvicorn from either the repository root or the
# backend directory produces the same configuration.  The backend file is
# loaded last, allowing server-only values to override shared defaults.
BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_NAME = os.getenv("DATABASE_NAME")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
