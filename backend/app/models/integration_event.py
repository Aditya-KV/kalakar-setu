"""
Kalakar Setu — Marketplace Integration Event Log
Every inbound ONDC request and outbound callback gets a row here — the
single place to look when a search/select/confirm doesn't behave as
expected. Also backs idempotency checks (see app/integrations/ondc/service.py):
before acting on a message, we check whether this exact
(transaction_id, message_id, action) has already been processed.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, JSON, Boolean, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class IntegrationEvent(Base):
    __tablename__ = "integration_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    marketplace: Mapped[str] = mapped_column(String(30), default="ONDC")
    action: Mapped[str] = mapped_column(String(30), nullable=False)  # search, on_search, select, ...
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # INBOUND, OUTBOUND

    transaction_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)

    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)

    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
