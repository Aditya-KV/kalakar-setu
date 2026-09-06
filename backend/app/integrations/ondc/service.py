"""
ONDC search -> on_search processing.

Runs as a FastAPI BackgroundTask after /ondc/search has already ACKed, so
it opens its own DB session rather than reusing the request's (which is
closed by the time a background task runs). Every step is wrapped so a
malformed payload or unreachable buyer never raises past this function —
it always ends by writing an IntegrationEvent, success or not.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, or_

from app.db.session import async_session_factory
from app.core.config import settings
from app.models.user import User
from app.models.listing import Listing
from app.models.marketplace_listing import MarketplaceListing
from app.models.integration_event import IntegrationEvent
from app.integrations.ondc.mapper import build_on_search
from app.integrations.ondc.client import send_on_search

logger = logging.getLogger(__name__)


def _extract_search_query(payload: dict) -> str | None:
    """Defensive extraction — ONDC intent payloads vary in shape and this
    should never be the reason a search fails to process."""
    try:
        return payload["message"]["intent"]["item"]["descriptor"]["name"]
    except (KeyError, TypeError):
        return None


async def _log_event(
    db,
    *,
    action: str,
    direction: str,
    transaction_id: str | None,
    message_id: str | None,
    payload: dict,
    response: dict | None = None,
    http_status: int | None = None,
    success: bool = True,
    error: str | None = None,
) -> None:
    db.add(
        IntegrationEvent(
            marketplace="ONDC",
            action=action,
            direction=direction,
            transaction_id=transaction_id,
            message_id=message_id,
            payload=payload,
            response=response,
            http_status=http_status,
            success=success,
            error=error,
        )
    )
    await db.commit()


async def process_search(payload: dict) -> None:
    context = payload.get("context", {}) or {}
    transaction_id = context.get("transaction_id")
    message_id = context.get("message_id")

    async with async_session_factory() as db:
        # Idempotency: ONDC (and flaky networks generally) can retry a
        # message. Re-sending the same catalogue twice is harmless for
        # search specifically, but this is the same check select/init/
        # confirm will need, so the pattern is established here first.
        if transaction_id and message_id:
            existing = await db.execute(
                select(IntegrationEvent).where(
                    IntegrationEvent.action == "search",
                    IntegrationEvent.transaction_id == transaction_id,
                    IntegrationEvent.message_id == message_id,
                    IntegrationEvent.success.is_(True),
                )
            )
            if existing.scalar_one_or_none():
                logger.info(f"ONDC search {transaction_id}/{message_id} already processed — skipping.")
                return

        try:
            query = _extract_search_query(payload)
            listings_by_seller = await _find_matching_listings(db, query)

            on_search_payload = build_on_search(context, listings_by_seller)
            status_code, response_body = await send_on_search(
                on_search_payload, settings.ONDC_BUYER_CALLBACK_URL
            )

            for seller, listings in listings_by_seller.items():
                for listing in listings:
                    await _mark_synced(db, listing, seller)

            no_buyer_configured = not settings.ONDC_BUYER_CALLBACK_URL
            callback_ok = status_code == 200 or no_buyer_configured

            # Logged separately from the inbound search below — this is the
            # row to check when you want the exact JSON to paste into the
            # ONDC Workbench / log-validation tool.
            await _log_event(
                db,
                action="on_search",
                direction="OUTBOUND",
                transaction_id=transaction_id,
                message_id=on_search_payload.get("context", {}).get("message_id"),
                payload=on_search_payload,
                response=response_body,
                http_status=status_code,
                success=callback_ok,
                error=None if callback_ok else f"on_search callback returned {status_code}",
            )
            await _log_event(
                db,
                action="search",
                direction="INBOUND",
                transaction_id=transaction_id,
                message_id=message_id,
                payload=payload,
                response=response_body,
                http_status=status_code,
                success=callback_ok,
                error=None if callback_ok else f"on_search callback returned {status_code}",
            )
        except Exception as e:  # noqa: BLE001 — this must never bubble up
            logger.exception("ONDC search processing failed")
            await _log_event(
                db,
                action="search",
                direction="INBOUND",
                transaction_id=transaction_id,
                message_id=message_id,
                payload=payload,
                success=False,
                error=str(e),
            )


async def _find_matching_listings(db, query: str | None) -> dict[User, list[Listing]]:
    stmt = (
        select(Listing, User)
        .join(User, Listing.user_id == User.id)
        .where(Listing.status == "live")
        .order_by(Listing.created_at.desc())
    )
    if query:
        like = f"%{query}%"
        stmt = stmt.where(or_(Listing.title_en.ilike(like), Listing.title_hi.ilike(like)))

    result = await db.execute(stmt)
    grouped: dict[User, list[Listing]] = {}
    for listing, seller in result.all():
        grouped.setdefault(seller, []).append(listing)
    return grouped


async def _mark_synced(db, listing: Listing, seller: User) -> None:
    existing = await db.execute(
        select(MarketplaceListing).where(
            MarketplaceListing.listing_id == listing.id,
            MarketplaceListing.marketplace == "ONDC",
        )
    )
    row = existing.scalar_one_or_none()
    if row is None:
        row = MarketplaceListing(listing_id=listing.id, marketplace="ONDC")
        db.add(row)
    row.external_provider_id = seller.id
    row.external_item_id = listing.id
    row.status = "ACTIVE"
    row.last_synced_at = datetime.now(timezone.utc)
    row.last_error = None
