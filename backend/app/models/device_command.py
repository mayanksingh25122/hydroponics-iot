from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class DeviceCommand(Base):
    """A queued command for the outbound-only ESP32 polling architecture
    (approved design: the backend never calls the device directly — the
    ESP32 polls for pending work on its own outbound HTTPS cycle, applies
    it locally, then reports back what actually happened).

    Lifecycle (status):
        pending      -> created, not yet seen by the device
        delivered    -> the ESP32 polled and received this command
        acknowledged -> the ESP32 reported back what it actually did
        expired      -> sat pending/delivered past expires_at, unclaimed
        superseded   -> a newer command for the same device_id +
                        command_type replaced this one before it reached
                        acknowledged
    (Enforcing these transitions is service-layer logic for a later task;
    this table only stores the field.)

    requested_* vs applied_*: what a user asks for is not necessarily
    what happens — firmware safety logic (applyPumpDecision(), the
    tank-full/sensor-fault override) is authoritative on the device, not
    this table. applied_pump_state / applied_manual_override /
    was_safety_refused exist so that distinction survives the round trip
    instead of the backend ever assuming a request was honored as-is.

    command_type is a plain String, not a database-level enum, matching
    this project's existing convention — nothing in this schema uses a
    Postgres ENUM type (PumpModeCommand's auto/manual is a Pydantic
    Literal, validated at the API boundary, not in the database).
    Likewise requested_pump_state / requested_manual_override are two
    discrete nullable columns (exactly one populated, depending on
    command_type) rather than a JSON payload — this project stores no
    JSON blobs for structured data anywhere else either.

    Neither device_id nor requested_by_user_id declares ON DELETE
    CASCADE (unlike AuthSession.user_id): a command row is a historical
    record of "this user asked for this" and is worth preserving as an
    audit trail even if the device or user is later removed, rather than
    silently disappearing the way a session correctly does. Deleting a
    device or user with existing command rows is left to the database's
    default RESTRICT behavior.
    """

    __tablename__ = "device_commands"

    id = Column(Integer, primary_key=True, index=True)

    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)

    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    command_type = Column(String(20), nullable=False)

    requested_pump_state = Column(Boolean, nullable=True)
    requested_manual_override = Column(Boolean, nullable=True)

    status = Column(String(20), nullable=False, default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # No default: always computed explicitly by the caller at creation
    # time (created_at + a short TTL) — same pattern as
    # AuthSession.expires_at, for the same reason.
    expires_at = Column(DateTime(timezone=True), nullable=False)

    delivered_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    # What the ESP32 actually reports back, once acknowledged. All three
    # stay NULL until then.
    applied_pump_state = Column(Boolean, nullable=True)
    applied_manual_override = Column(Boolean, nullable=True)
    was_safety_refused = Column(Boolean, nullable=True)

    device = relationship("Device", back_populates="commands")
    requested_by = relationship("User", back_populates="requested_commands")
