"""
Kalakar Setu — Product Image & Media Model
Tracks product photo variants, quality analysis metrics, and AI enhancement status.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )
    draft_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)

    # Media File Paths / URLs
    original_url: Mapped[str] = mapped_column(String(500), nullable=False)
    enhanced_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bg_removed_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    aspect_ratio_1x1_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    aspect_ratio_4x5_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transparent_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Which Virtual Product Studio pipeline stages actually ran/succeeded —
    # persisted so GET /media/{id} can report the same processing summary
    # as the enhance call that produced it, not just at request time.
    processing_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Product gallery: multiple varied shots generated from the one uploaded
    # photo (different crops/backgrounds today; can include real AI-generated
    # angle variants later without another schema change). Each entry is
    # {"key": str, "label": str, "url": str}.
    gallery: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # Primary photo flag
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    # Quality Check Metrics (FR-3.3)
    quality_score: Mapped[float] = mapped_column(Float, default=1.0)
    brightness: Mapped[float | None] = mapped_column(Float, nullable=True)
    blur_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_blurry: Mapped[bool] = mapped_column(Boolean, default=False)
    is_too_dark: Mapped[bool] = mapped_column(Boolean, default=False)
    is_overexposed: Mapped[bool] = mapped_column(Boolean, default=False)
    quality_issues: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    # AI Enhancement Pipeline Metadata (FR-3.10)
    enhancement_status: Mapped[str] = mapped_column(
        String(30), default="pending"  # pending, processing, completed, failed
    )
    failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), default="v1.0-studio")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
