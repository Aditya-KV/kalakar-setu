"""
Kalakar Setu — Product Listing Routes Tests
"""

import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import async_session_factory
from app.models.media import ProductImage


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _auth_headers(ac: AsyncClient) -> dict:
    """Creates a fresh test user on the given client and returns its auth headers."""
    unique_phone = f"98{int(datetime.now(timezone.utc).timestamp() * 1000) % 100_000_000:08d}"
    await ac.post("/api/v1/auth/request-otp", json={"phone_number": unique_phone})
    res = await ac.post(
        "/api/v1/auth/verify-otp",
        json={"phone_number": unique_phone, "otp_code": "123456"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _sample_listing_body(**overrides):
    body = {
        "title": {"en": "Handwoven Cotton Saree", "hi": "हाथ से बुनी सूती साड़ी"},
        "description": {"en": "A beautiful saree.", "hi": "एक सुंदर साड़ी।"},
        "craft_type": "weaving",
        "attributes": {"material": ["Cotton"], "color": ["Red"], "technique": ["Handwoven"]},
        "keywords": ["saree", "cotton"],
        "price": 2500,
        "quantity_available": 3,
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_create_and_list_listing():
    async with _client() as ac:
        headers = await _auth_headers(ac)

        create_res = await ac.post("/api/v1/listings", json=_sample_listing_body(), headers=headers)
        assert create_res.status_code == 200
        created = create_res.json()
        assert created["title"]["en"] == "Handwoven Cotton Saree"
        assert created["price"] == 2500
        assert created["status"] == "live"
        assert created["gallery"] == []  # no media_id given

        list_res = await ac.get("/api/v1/listings", headers=headers)
        assert list_res.status_code == 200
        listings = list_res.json()
        assert len(listings) == 1
        assert listings[0]["id"] == created["id"]


@pytest.mark.asyncio
async def test_get_single_listing_requires_ownership():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        headers2 = await _auth_headers(ac)

        create_res = await ac.post("/api/v1/listings", json=_sample_listing_body(), headers=headers)
        listing_id = create_res.json()["id"]

        own_res = await ac.get(f"/api/v1/listings/{listing_id}", headers=headers)
        assert own_res.status_code == 200

        other_res = await ac.get(f"/api/v1/listings/{listing_id}", headers=headers2)
        assert other_res.status_code == 404


@pytest.mark.asyncio
async def test_update_listing_price_and_title():
    async with _client() as ac:
        headers = await _auth_headers(ac)

        create_res = await ac.post("/api/v1/listings", json=_sample_listing_body(), headers=headers)
        listing_id = create_res.json()["id"]

        patch_res = await ac.patch(
            f"/api/v1/listings/{listing_id}",
            json={"price": 3000, "title": {"en": "Updated Saree", "hi": "अपडेटेड साड़ी"}},
            headers=headers,
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["price"] == 3000
        assert updated["title"]["en"] == "Updated Saree"
        # Untouched fields survive the partial update
        assert updated["description"]["en"] == "A beautiful saree."


@pytest.mark.asyncio
async def test_delete_listing():
    async with _client() as ac:
        headers = await _auth_headers(ac)

        create_res = await ac.post("/api/v1/listings", json=_sample_listing_body(), headers=headers)
        listing_id = create_res.json()["id"]

        delete_res = await ac.delete(f"/api/v1/listings/{listing_id}", headers=headers)
        assert delete_res.status_code == 200

        get_res = await ac.get(f"/api/v1/listings/{listing_id}", headers=headers)
        assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_listing_stats_counts_active_listings():
    async with _client() as ac:
        headers = await _auth_headers(ac)

        stats_before = await ac.get("/api/v1/listings/stats", headers=headers)
        assert stats_before.json()["active_listings"] == 0

        await ac.post("/api/v1/listings", json=_sample_listing_body(), headers=headers)
        await ac.post("/api/v1/listings", json=_sample_listing_body(price=500), headers=headers)

        stats_after = await ac.get("/api/v1/listings/stats", headers=headers)
        data = stats_after.json()
        assert data["active_listings"] == 2
        assert data["total_listings"] == 2


async def _create_product_image(user_id: str, url: str) -> str:
    async with async_session_factory() as session:
        image = ProductImage(user_id=user_id, original_url=url, bg_removed_url=url)
        session.add(image)
        await session.commit()
        return image.id


@pytest.mark.asyncio
async def test_create_listing_with_multiple_photos():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        user_id = (await ac.get("/api/v1/profile", headers=headers)).json()["id"]

        media_id_1 = await _create_product_image(user_id, "/uploads/photo-1.jpg")
        media_id_2 = await _create_product_image(user_id, "/uploads/photo-2.jpg")

        create_res = await ac.post(
            "/api/v1/listings",
            json=_sample_listing_body(media_ids=[media_id_1, media_id_2]),
            headers=headers,
        )
        assert create_res.status_code == 200
        created = create_res.json()
        assert [g["url"] for g in created["gallery"]] == ["/uploads/photo-1.jpg", "/uploads/photo-2.jpg"]
        assert created["primary_image_url"] == "/uploads/photo-1.jpg"


@pytest.mark.asyncio
async def test_create_listing_skips_photos_owned_by_another_user():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        other_headers = await _auth_headers(ac)
        other_user_id = (await ac.get("/api/v1/profile", headers=other_headers)).json()["id"]

        foreign_media_id = await _create_product_image(other_user_id, "/uploads/not-yours.jpg")

        create_res = await ac.post(
            "/api/v1/listings",
            json=_sample_listing_body(media_ids=[foreign_media_id]),
            headers=headers,
        )
        assert create_res.status_code == 200
        created = create_res.json()
        assert created["gallery"] == []
        assert created["primary_image_url"] is None


@pytest.mark.asyncio
async def test_create_listing_rejects_invalid_price():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        res = await ac.post(
            "/api/v1/listings", json=_sample_listing_body(price=0), headers=headers
        )
        assert res.status_code == 422
