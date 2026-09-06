"""
Kalakar Setu — ONDC Integration Tests
Milestone 1-3 of the prototype plan: /ondc/search ACKs immediately, then
(as a background task) builds and attempts to send an on_search payload
from real listing data. No sandbox/buyer is configured in tests, so the
callback send itself is expected to be skipped, not fail the request.
"""

import asyncio
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import async_session_factory
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_listing import MarketplaceListing


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _auth_headers(ac: AsyncClient) -> dict:
    unique_phone = f"98{int(datetime.now(timezone.utc).timestamp() * 1000) % 100_000_000:08d}"
    await ac.post("/api/v1/auth/request-otp", json={"phone_number": unique_phone})
    res = await ac.post(
        "/api/v1/auth/verify-otp",
        json={"phone_number": unique_phone, "otp_code": "123456"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _search_payload(transaction_id: str, query: str = "pottery") -> dict:
    return {
        "context": {
            "action": "search",
            "transaction_id": transaction_id,
            "message_id": f"{transaction_id}-msg",
        },
        "message": {"intent": {"item": {"descriptor": {"name": query}}}},
    }


@pytest.mark.asyncio
async def test_ondc_search_returns_ack():
    async with _client() as ac:
        res = await ac.post("/ondc/search", json=_search_payload("TXN-ACK-TEST"))

    assert res.status_code == 200
    assert res.json() == {"message": {"ack": {"status": "ACK"}}}


@pytest.mark.asyncio
async def test_ondc_search_finds_real_listing_and_marks_synced():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        marker = f"UniqueOndcPot{int(datetime.now(timezone.utc).timestamp())}"
        create_res = await ac.post(
            "/api/v1/listings",
            json={
                "title": {"en": f"{marker} Vase", "hi": "मिट्टी का बर्तन"},
                "description": {"en": "A hand-thrown clay vase.", "hi": "हाथ से बना मिट्टी का बर्तन।"},
                "craft_type": "pottery",
                "attributes": {"material": [], "color": [], "technique": []},
                "keywords": [],
                "price": 850,
                "quantity_available": 5,
            },
            headers=headers,
        )
        assert create_res.status_code in (200, 201)
        listing_id = create_res.json()["id"]

        # The test DB file persists across separate pytest runs (not just
        # within one), so this must be unique per run, not a fixed string.
        transaction_id = f"TXN-MATCH-{marker}"
        search_res = await ac.post("/ondc/search", json=_search_payload(transaction_id, marker))
        assert search_res.status_code == 200

        # The background task runs as part of the same ASGI call, but give
        # it a beat in case the event loop hasn't flushed it yet.
        await asyncio.sleep(0.2)

    async with async_session_factory() as db:
        synced = await db.execute(
            select(MarketplaceListing).where(MarketplaceListing.listing_id == listing_id)
        )
        row = synced.scalar_one_or_none()
        assert row is not None
        assert row.marketplace == "ONDC"
        assert row.status == "ACTIVE"

        events = await db.execute(
            select(IntegrationEvent).where(IntegrationEvent.transaction_id == transaction_id)
        )
        all_events = events.scalars().all()
        # One inbound "search" log, one outbound "on_search" log (the exact
        # payload we generated and attempted to send).
        assert {e.action for e in all_events} == {"search", "on_search"}
        assert {e.direction for e in all_events} == {"INBOUND", "OUTBOUND"}


@pytest.mark.asyncio
async def test_ondc_search_never_crashes_on_malformed_payload():
    async with _client() as ac:
        res = await ac.post("/ondc/search", json={"nonsense": True})

    assert res.status_code == 200
    assert res.json() == {"message": {"ack": {"status": "ACK"}}}
