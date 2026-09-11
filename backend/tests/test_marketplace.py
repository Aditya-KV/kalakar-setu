"""
Kalakar Setu — Customer Marketplace, Addresses, and Orders Tests
"""

import pytest
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _auth_headers(ac: AsyncClient) -> dict:
    unique_phone = f"97{int(datetime.now(timezone.utc).timestamp() * 1000) % 100_000_000:08d}"
    await ac.post("/api/v1/auth/request-otp", json={"phone_number": unique_phone})
    res = await ac.post(
        "/api/v1/auth/verify-otp",
        json={"phone_number": unique_phone, "otp_code": "123456"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _listing_body(**overrides):
    body = {
        "title": {"en": "Handwoven Cotton Saree", "hi": "हाथ से बुनी सूती साड़ी"},
        "description": {"en": "A beautiful saree.", "hi": "एक सुंदर साड़ी।"},
        "craft_type": "weaving",
        "attributes": {"material": ["Cotton"], "color": ["Red"], "technique": ["Handwoven"]},
        "keywords": ["saree"],
        "price": 2500,
        "quantity_available": 3,
    }
    body.update(overrides)
    return body


def _address_body(**overrides):
    body = {
        "label": "Home",
        "recipient_name": "Meera Devi",
        "phone_number": "9876500000",
        "line1": "12 MG Road",
        "city": "Jaipur",
        "state_code": "RJ",
        "pincode": "302001",
    }
    body.update(overrides)
    return body


# --- Addresses ---

@pytest.mark.asyncio
async def test_marathi_text_survives_publish_search_edit_and_order_snapshot():
    async with _client() as ac:
        seller = await _auth_headers(ac)
        buyer = await _auth_headers(ac)
        body = _listing_body(
            title={"en": "Clay pot", "hi": "मिट्टी का घड़ा", "mr": "मातीचे मडके"},
            description={"en": "Handmade pot", "hi": "हाथ से बना घड़ा", "mr": "हाताने बनवलेले मडके"},
        )
        created = await ac.post("/api/v1/listings", json=body, headers=seller)
        assert created.status_code == 200
        listing_id = created.json()["id"]
        detail = await ac.get(f"/api/v1/marketplace/listings/{listing_id}", headers=buyer)
        assert detail.json()["description"]["mr"] == body["description"]["mr"]
        results = await ac.get("/api/v1/marketplace/listings", params={"search": "मडके"}, headers=buyer)
        assert listing_id in {item["id"] for item in results.json()}
        # An older client editing English/Hindi must not erase Marathi.
        edited = await ac.patch(f"/api/v1/listings/{listing_id}",
                                json={"title": {"en": "Edited pot", "hi": "घड़ा"}}, headers=seller)
        assert edited.json()["title"]["mr"] == body["title"]["mr"]
        address = await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer)
        order = await ac.post("/api/v1/orders", headers=buyer, json={
            "items": [{"listing_id": listing_id, "quantity": 1}],
            "delivery_address_id": address.json()["id"], "payment_method": "cod",
        })
        assert order.status_code == 200
        assert order.json()[0]["items"][0]["title"]["mr"] == body["title"]["mr"]
        await ac.patch(f"/api/v1/listings/{listing_id}", headers=seller,
                       json={"title": {"en": "New", "hi": "नया", "mr": "नवे"}})
        history = await ac.get("/api/v1/orders/buying", headers=buyer)
        assert history.json()[0]["items"][0]["title"]["mr"] == body["title"]["mr"]

@pytest.mark.asyncio
async def test_create_and_list_addresses():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        create_res = await ac.post("/api/v1/addresses", json=_address_body(), headers=headers)
        assert create_res.status_code == 200

        list_res = await ac.get("/api/v1/addresses", headers=headers)
        assert list_res.status_code == 200
        assert len(list_res.json()) == 1


@pytest.mark.asyncio
async def test_setting_new_default_address_clears_old_default():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        first = await ac.post("/api/v1/addresses", json=_address_body(is_default=True), headers=headers)
        second = await ac.post(
            "/api/v1/addresses", json=_address_body(label="Work", is_default=True), headers=headers
        )
        assert first.status_code == 200 and second.status_code == 200

        listed = (await ac.get("/api/v1/addresses", headers=headers)).json()
        defaults = [a for a in listed if a["is_default"]]
        assert len(defaults) == 1
        assert defaults[0]["label"] == "Work"


# --- Marketplace browsing ---

@pytest.mark.asyncio
async def test_marketplace_excludes_own_listings_and_shows_others():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)

        created = (
            await ac.post("/api/v1/listings", json=_listing_body(), headers=seller_headers)
        ).json()

        # Sellers don't see their own stuff in the buyer feed (other sellers'
        # listings from earlier tests may still legitimately appear, since
        # the test DB persists across the whole suite run).
        seller_view = await ac.get("/api/v1/marketplace/listings", headers=seller_headers)
        assert created["id"] not in {item["id"] for item in seller_view.json()}

        buyer_view = await ac.get("/api/v1/marketplace/listings", headers=buyer_headers)
        matching = [item for item in buyer_view.json() if item["id"] == created["id"]]
        assert len(matching) == 1
        assert matching[0]["seller"]["name"]


@pytest.mark.asyncio
async def test_marketplace_search_filters_by_title():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)
        unique_marker = f"Zx{int(datetime.now(timezone.utc).timestamp() * 1000) % 1_000_000}"
        matching = (
            await ac.post(
                "/api/v1/listings",
                json=_listing_body(
                    title={"en": f"{unique_marker} Vase", "hi": "मिट्टी का बर्तन"}, craft_type="pottery"
                ),
                headers=seller_headers,
            )
        ).json()
        await ac.post("/api/v1/listings", json=_listing_body(), headers=seller_headers)

        res = await ac.get("/api/v1/marketplace/listings", params={"search": unique_marker}, headers=buyer_headers)
        results = res.json()
        assert len(results) == 1
        assert results[0]["id"] == matching["id"]


# --- Checkout / Orders ---

@pytest.mark.asyncio
async def test_checkout_creates_order_and_decrements_inventory():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)

        listing_res = await ac.post(
            "/api/v1/listings", json=_listing_body(quantity_available=5), headers=seller_headers
        )
        listing_id = listing_res.json()["id"]

        addr_res = await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer_headers)
        address_id = addr_res.json()["id"]

        checkout_res = await ac.post(
            "/api/v1/orders",
            json={
                "items": [{"listing_id": listing_id, "quantity": 2}],
                "delivery_address_id": address_id,
                "payment_method": "cod",
            },
            headers=buyer_headers,
        )
        assert checkout_res.status_code == 200
        orders = checkout_res.json()
        assert len(orders) == 1
        assert orders[0]["total_price"] == 5000
        assert orders[0]["items"][0]["quantity"] == 2
        assert orders[0]["fulfillment_status"] == 1
        assert orders[0]["payment_method"] == "cod"

        # Inventory decremented on the seller's own listing view
        listing_after = await ac.get(f"/api/v1/listings/{listing_id}", headers=seller_headers)
        assert listing_after.json()["quantity_available"] == 3


@pytest.mark.asyncio
async def test_checkout_splits_multi_seller_cart_into_separate_orders():
    async with _client() as ac:
        seller1_headers = await _auth_headers(ac)
        seller2_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)

        listing1 = (await ac.post("/api/v1/listings", json=_listing_body(price=1000), headers=seller1_headers)).json()
        listing2 = (await ac.post("/api/v1/listings", json=_listing_body(price=2000), headers=seller2_headers)).json()

        addr_id = (await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer_headers)).json()["id"]

        checkout_res = await ac.post(
            "/api/v1/orders",
            json={
                "items": [
                    {"listing_id": listing1["id"], "quantity": 1},
                    {"listing_id": listing2["id"], "quantity": 1},
                ],
                "delivery_address_id": addr_id,
            },
            headers=buyer_headers,
        )
        orders = checkout_res.json()
        assert len(orders) == 2
        seller_ids = {o["seller_id"] for o in orders}
        assert len(seller_ids) == 2


@pytest.mark.asyncio
async def test_checkout_rejects_buying_own_listing():
    async with _client() as ac:
        headers = await _auth_headers(ac)
        listing_id = (await ac.post("/api/v1/listings", json=_listing_body(), headers=headers)).json()["id"]
        addr_id = (await ac.post("/api/v1/addresses", json=_address_body(), headers=headers)).json()["id"]

        res = await ac.post(
            "/api/v1/orders",
            json={"items": [{"listing_id": listing_id, "quantity": 1}], "delivery_address_id": addr_id},
            headers=headers,
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_checkout_rejects_quantity_exceeding_stock():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)
        listing_id = (
            await ac.post("/api/v1/listings", json=_listing_body(quantity_available=1), headers=seller_headers)
        ).json()["id"]
        addr_id = (await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer_headers)).json()["id"]

        res = await ac.post(
            "/api/v1/orders",
            json={"items": [{"listing_id": listing_id, "quantity": 5}], "delivery_address_id": addr_id},
            headers=buyer_headers,
        )
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_buying_and_selling_order_views_are_scoped_correctly():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)
        listing_id = (await ac.post("/api/v1/listings", json=_listing_body(), headers=seller_headers)).json()["id"]
        addr_id = (await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer_headers)).json()["id"]

        await ac.post(
            "/api/v1/orders",
            json={"items": [{"listing_id": listing_id, "quantity": 1}], "delivery_address_id": addr_id},
            headers=buyer_headers,
        )

        buyer_orders = await ac.get("/api/v1/orders/buying", headers=buyer_headers)
        seller_orders = await ac.get("/api/v1/orders/selling", headers=seller_headers)
        assert len(buyer_orders.json()) == 1
        assert len(seller_orders.json()) == 1

        # Seller shouldn't see this order as something they bought, and vice versa
        assert (await ac.get("/api/v1/orders/selling", headers=buyer_headers)).json() == []
        assert (await ac.get("/api/v1/orders/buying", headers=seller_headers)).json() == []


@pytest.mark.asyncio
async def test_seller_updates_fulfillment_status():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)
        listing_id = (await ac.post("/api/v1/listings", json=_listing_body(), headers=seller_headers)).json()["id"]
        addr_id = (await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer_headers)).json()["id"]
        order_id = (
            await ac.post(
                "/api/v1/orders",
                json={"items": [{"listing_id": listing_id, "quantity": 1}], "delivery_address_id": addr_id},
                headers=buyer_headers,
            )
        ).json()[0]["id"]

        update_res = await ac.patch(
            f"/api/v1/orders/{order_id}/fulfillment", json={"fulfillment_status": 4}, headers=seller_headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["fulfillment_status"] == 4
        assert update_res.json()["payment_status"] == "paid"  # COD marked paid on delivery

        # Buyer cannot update fulfillment on an order they didn't sell
        forbidden_res = await ac.patch(
            f"/api/v1/orders/{order_id}/fulfillment", json={"fulfillment_status": 2}, headers=buyer_headers
        )
        assert forbidden_res.status_code == 404


# --- Live location ---

@pytest.mark.asyncio
async def test_nearby_sellers_only_lists_sellers_currently_sharing_location():
    async with _client() as ac:
        sharing_seller = await _auth_headers(ac)
        quiet_seller = await _auth_headers(ac)
        buyer = await _auth_headers(ac)

        await ac.patch(
            "/api/v1/profile/location",
            json={"latitude": 12.9716, "longitude": 77.5946, "is_sharing_location": True},
            headers=sharing_seller,
        )
        # This seller has a location on file but never turned sharing on.
        await ac.patch(
            "/api/v1/profile/location",
            json={"latitude": 13.0827, "longitude": 80.2707, "is_sharing_location": False},
            headers=quiet_seller,
        )

        nearby_res = await ac.get("/api/v1/marketplace/sellers/nearby", headers=buyer)
        assert nearby_res.status_code == 200
        nearby = nearby_res.json()
        assert len(nearby) == 1
        assert nearby[0]["latitude"] == 12.9716

        # Turning sharing off removes the seller from the list.
        await ac.patch(
            "/api/v1/profile/location",
            json={"latitude": 12.9716, "longitude": 77.5946, "is_sharing_location": False},
            headers=sharing_seller,
        )
        assert (await ac.get("/api/v1/marketplace/sellers/nearby", headers=buyer)).json() == []


@pytest.mark.asyncio
async def test_nearby_sellers_sorted_by_distance_when_buyer_location_given():
    async with _client() as ac:
        near_seller = await _auth_headers(ac)
        far_seller = await _auth_headers(ac)
        buyer = await _auth_headers(ac)

        # Buyer is in Bengaluru; near_seller is a few km away, far_seller is in Delhi.
        await ac.patch(
            "/api/v1/profile/location",
            json={"latitude": 12.98, "longitude": 77.60, "is_sharing_location": True},
            headers=near_seller,
        )
        await ac.patch(
            "/api/v1/profile/location",
            json={"latitude": 28.7041, "longitude": 77.1025, "is_sharing_location": True},
            headers=far_seller,
        )

        nearby = (
            await ac.get(
                "/api/v1/marketplace/sellers/nearby",
                params={"lat": 12.9716, "lng": 77.5946},
                headers=buyer,
            )
        ).json()
        assert len(nearby) == 2
        assert nearby[0]["distance_km"] < nearby[1]["distance_km"]


@pytest.mark.asyncio
async def test_order_tracking_only_visible_once_picked_up_and_sharing():
    async with _client() as ac:
        seller_headers = await _auth_headers(ac)
        buyer_headers = await _auth_headers(ac)
        listing_id = (await ac.post("/api/v1/listings", json=_listing_body(), headers=seller_headers)).json()["id"]
        addr_id = (await ac.post("/api/v1/addresses", json=_address_body(), headers=buyer_headers)).json()["id"]
        order_id = (
            await ac.post(
                "/api/v1/orders",
                json={"items": [{"listing_id": listing_id, "quantity": 1}], "delivery_address_id": addr_id},
                headers=buyer_headers,
            )
        ).json()[0]["id"]

        # Not yet picked up — no position, even though the seller is sharing.
        await ac.patch(
            "/api/v1/profile/location",
            json={"latitude": 12.9716, "longitude": 77.5946, "is_sharing_location": True},
            headers=seller_headers,
        )
        before_pickup = (await ac.get(f"/api/v1/orders/{order_id}/tracking", headers=buyer_headers)).json()
        assert before_pickup["latitude"] is None

        # Picked up — position now visible.
        await ac.patch(
            f"/api/v1/orders/{order_id}/fulfillment", json={"fulfillment_status": 3}, headers=seller_headers
        )
        picked_up = (await ac.get(f"/api/v1/orders/{order_id}/tracking", headers=buyer_headers)).json()
        assert picked_up["latitude"] == 12.9716

        # Delivered — position hidden again.
        await ac.patch(
            f"/api/v1/orders/{order_id}/fulfillment", json={"fulfillment_status": 4}, headers=seller_headers
        )
        delivered = (await ac.get(f"/api/v1/orders/{order_id}/tracking", headers=buyer_headers)).json()
        assert delivered["latitude"] is None

        # Another buyer can't read this order's tracking at all.
        other_buyer = await _auth_headers(ac)
        assert (await ac.get(f"/api/v1/orders/{order_id}/tracking", headers=other_buyer)).status_code == 404
