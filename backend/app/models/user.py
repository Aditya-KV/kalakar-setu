"""
Kalakar Setu — User Model
Primary artisan/seller account.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    phone_number: Mapped[str] = mapped_column(
        String(15), unique=True, index=True, nullable=False
    )
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="hi")

    # Craft types stored as JSON array of craft IDs e.g. ["pottery", "weaving"]
    craft_types: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # Location
    state_code: Mapped[str | None] = mapped_column(String(5), nullable=True)
    district_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Live location sharing (Uber-style "online" pin) — foreground-only,
    # pushed by the seller's device while is_sharing_location is on. Buyers
    # see this on the marketplace map and, for an order past "Picked Up",
    # on that order's tracking screen. A stale location_updated_at (see
    # LOCATION_STALE_AFTER in marketplace_service) hides the pin even if
    # is_sharing_location is still true, e.g. the app was killed without
    # toggling off.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_sharing_location: Mapped[bool] = mapped_column(Boolean, default=False)

    # Expo push notification token for this device — overwritten whenever
    # the app registers a fresh one (a user only gets notifications on
    # their most recently active device). Null means notifications are
    # off (permission denied, or never registered).
    push_token: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Onboarding tracking
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Account state
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    deactivation_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Marketplace identifiers (stored only when authorized)
    gem_seller_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ondc_subscriber_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
