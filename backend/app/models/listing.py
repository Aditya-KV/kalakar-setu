"""
Kalakar Setu — Product Listing Model
The finished, priced catalog listing: the combined output of the Photo
Studio, Voice Cataloger, and Price steps once an artisan publishes.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )
    media_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("product_images.id"), nullable=True
    )

    title_en: Mapped[str] = mapped_column(String(200), nullable=False)
    title_hi: Mapped[str] = mapped_column(String(200), nullable=False)
    title_mr: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str] = mapped_column(String(2000), nullable=False)
    description_hi: Mapped[str] = mapped_column(String(2000), nullable=False)
    description_mr: Mapped[str | None] = mapped_column(Text, nullable=True)

    craft_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    keywords: Mapped[list] = mapped_column(JSON, default=list)

    price: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, default=1)

    primary_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Same {"key","label","url"} shape as ProductImage.gallery, copied in at
    # creation time so a listing keeps its photos even if the source
    # ProductImage row is later deleted.
    gallery: Mapped[list] = mapped_column(JSON, default=list)

    status: Mapped[str] = mapped_column(String(20), default="live")  # live, archived

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
