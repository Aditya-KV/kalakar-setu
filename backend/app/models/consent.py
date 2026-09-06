"""
Kalakar Setu — Consent Record Model
Tracks user consent for privacy policy and data collection (FR-1.8).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )
    policy_version: Mapped[str] = mapped_column(String(20), nullable=False)
    consent_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "privacy", "data_collection", "voice_data"
    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
