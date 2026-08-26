from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus

from app.settings import (
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
)

from app.database.base import Base

# Import models so SQLAlchemy registers them
from app.models.device import Device
from app.models.sensor_reading import SensorReading

missing_settings = [
    name
    for name, value in {
        "DATABASE_HOST": DATABASE_HOST,
        "DATABASE_PORT": DATABASE_PORT,
        "DATABASE_NAME": DATABASE_NAME,
        "DATABASE_USER": DATABASE_USER,
        "DATABASE_PASSWORD": DATABASE_PASSWORD,
    }.items()
    if not value
]

if missing_settings:
    raise RuntimeError(
        "Missing database configuration: " + ", ".join(missing_settings)
    )

# Encode password (handles @, :, /, etc.)
password = quote_plus(DATABASE_PASSWORD)

# Supabase PostgreSQL URL
DATABASE_URL = (
    f"postgresql+psycopg2://"
    f"{DATABASE_USER}:{password}"
    f"@{DATABASE_HOST}:{DATABASE_PORT}"
    f"/{DATABASE_NAME}"
    f"?sslmode=require"
)

print("Connecting to:", DATABASE_HOST)

# Create engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)

# Create session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Create tables (if they don't exist)
Base.metadata.create_all(bind=engine)
