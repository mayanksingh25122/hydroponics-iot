"""initial schema

Revision ID: d50eab9e24f2
Revises:
Create Date: 2026-08-26 00:00:00.000000

Represents the CURRENT SQLAlchemy schema as of this migration's creation:
app.models.device.Device and app.models.sensor_reading.SensorReading.
No columns, constraints, indexes, or defaults beyond what those two models
already declare are introduced here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d50eab9e24f2"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("device_name", sa.String(length=100), nullable=False),
        sa.Column("device_id", sa.String(length=100), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("wifi_ssid", sa.String(length=100), nullable=True),
        sa.Column("is_online", sa.Boolean(), nullable=True),
    )
    op.create_index(op.f("ix_devices_id"), "devices", ["id"], unique=False)
    op.create_unique_constraint("uq_devices_device_id", "devices", ["device_id"])

    op.create_table(
        "sensor_readings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id"), nullable=True),
        sa.Column("ph", sa.Float(), nullable=True),
        sa.Column("tds", sa.Float(), nullable=True),
        sa.Column("ec", sa.Float(), nullable=True),
        sa.Column("water_temperature", sa.Float(), nullable=True),
        sa.Column("water_level", sa.Float(), nullable=True),
        sa.Column("pump_status", sa.Boolean(), nullable=True),
        sa.Column("buzzer_status", sa.Boolean(), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(op.f("ix_sensor_readings_id"), "sensor_readings", ["id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_sensor_readings_id"), table_name="sensor_readings")
    op.drop_table("sensor_readings")

    op.drop_constraint("uq_devices_device_id", "devices", type_="unique")
    op.drop_index(op.f("ix_devices_id"), table_name="devices")
    op.drop_table("devices")
