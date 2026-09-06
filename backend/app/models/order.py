"""
Kalakar Setu — Order Model
A real order placed by a buyer against one seller's listings, grouped the
way Swiggy/Blinkit group a cart into one order per seller. Line items
snapshot title/price/image at purchase time so later edits to a Listing
(or its deletion) never retroactively change a past order's history.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    buyer_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )
    seller_user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True, nullable=False
    )

    # Snapshot of the delivery address at order time (never edited afterward).
    delivery_address: Mapped[dict] = mapped_column(JSON, nullable=False)

    payment_method: Mapped[str] = mapped_column(String(20), default="cod")  # cod, razorpay (future)
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, paid

    # 1: Received, 2: Packed, 3: Picked Up, 4: Delivered — matches the seller
    # Orders tab's existing fulfillment stepper.
    fulfillment_status: Mapped[int] = mapped_column(Integer, default=1)

    total_price: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id"), index=True, nullable=False
    )
    listing_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("listings.id"), nullable=True
    )

    # Snapshotted at purchase time.
    title_en: Mapped[str] = mapped_column(String(200), nullable=False)
    title_hi: Mapped[str] = mapped_column(String(200), nullable=False)
    title_mr: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    order: Mapped["Order"] = relationship(back_populates="items")
