"""
Kalakar Setu — User Model
Primary artisan/seller account.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Integer, DateTime, JSON
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
