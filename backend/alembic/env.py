import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context

# Make the "app" package importable when Alembic is invoked from backend/
# (alembic.ini's prepend_sys_path = . already covers running from backend/,
# this is a defensive fallback for other invocation locations).
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Reuse the application's single existing configuration/engine source
# instead of introducing a second place that knows about database
# credentials. DATABASE_URL is built from app.settings (root .env, then
# backend/.env override) exactly as the running FastAPI app builds it.
# Importing this module also imports app.models.device and
# app.models.sensor_reading, which registers both tables on Base.metadata.
from app.database.connection import Base, DATABASE_URL, engine  # noqa: E402

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Never store the URL in alembic.ini; set it here from the app's own
# configuration so there is exactly one source of database configuration.
#
# config.set_main_option() writes into Alembic's ConfigParser-backed config,
# which uses BasicInterpolation: any "%" in the value must be escaped as "%%"
# or ConfigParser raises ValueError before this line even returns. A
# URL-encoded password (e.g. containing "%40") triggers this. Escaping here
# only affects what this ConfigParser layer stores internally — ConfigParser
# un-escapes "%%" back to "%" on read, so the real DATABASE_URL value used
# for the actual connection is unchanged.
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Reuse the application's existing engine (app.database.connection.engine)
    # rather than constructing a second one via engine_from_config.
    connectable = engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
