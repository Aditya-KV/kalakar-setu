"""
Kalakar Setu — Marketplace Listing Sync Model
Tracks the link between one of our own Listings and its representation on
an external marketplace (ONDC today; GeM or others could reuse this same
table later — see app/integrations/<marketplace>/). A Listing itself never
needs to know it's synced anywhere; this table is purely bookkeeping for
the sync status, so one product can be connected to multiple marketplaces
without duplicating anything on the Listing row itself.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    listing_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("listings.id"), index=True, nullable=False
    )
    marketplace: Mapped[str] = mapped_column(String(30), default="ONDC")

    # IDs as known to the external marketplace — set once first synced.
    external_provider_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    external_item_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE, ERROR, PAUSED
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
