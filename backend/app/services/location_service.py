"""
Kalakar Setu — Live Location Service
Sellers push their current position while "sharing location" is on; buyers
read it back in two places — a nearby-sellers map on the marketplace, and a
single order's live tracking screen once that order is picked up for
delivery. Both reads apply the same staleness rule so a pin left on from a
killed app doesn't linger forever.
"""

import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.user import User
from app.schemas.location import NearbySeller, OrderTrackingResponse

# A location fix older than this is treated as if the seller stopped
# sharing — covers the app being killed/losing connectivity without an
# explicit "go offline".
LOCATION_STALE_AFTER = timedelta(minutes=10)


def _is_fresh(updated_at: datetime | None) -> bool:
    if not updated_at:
        return False
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - updated_at <= LOCATION_STALE_AFTER


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def update_location(
    db: AsyncSession, user_id: str, latitude: float, longitude: float, is_sharing_location: bool
) -> User | None:
    user = await db.get(User, user_id)
    if not user:
        return None
    user.latitude = latitude
    user.longitude = longitude
    user.is_sharing_location = is_sharing_location
    user.location_updated_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def list_nearby_sellers(
    db: AsyncSession,
    exclude_user_id: str,
    buyer_lat: float | None = None,
    buyer_lng: float | None = None,
) -> list[NearbySeller]:
    result = await db.execute(
        select(User).where(
            User.is_sharing_location.is_(True),
            User.id != exclude_user_id,
            User.latitude.is_not(None),
            User.longitude.is_not(None),
        )
    )
    sellers = [u for u in result.scalars().all() if _is_fresh(u.location_updated_at)]

    out = [
        NearbySeller(
            id=seller.id,
            name=seller.display_name or "Kalakar Artisan",
            craft_types=seller.craft_types or [],
            latitude=seller.latitude,
            longitude=seller.longitude,
            location_updated_at=seller.location_updated_at,
            distance_km=(
                round(_haversine_km(buyer_lat, buyer_lng, seller.latitude, seller.longitude), 1)
                if buyer_lat is not None and buyer_lng is not None
                else None
            ),
        )
        for seller in sellers
    ]
    if buyer_lat is not None and buyer_lng is not None:
        out.sort(key=lambda s: s.distance_km)
    else:
        out.sort(key=lambda s: s.location_updated_at, reverse=True)
    return out


async def get_order_tracking(db: AsyncSession, buyer_user_id: str, order_id: str) -> OrderTrackingResponse | None:
    order = await db.get(Order, order_id)
    if not order or order.buyer_user_id != buyer_user_id:
        return None
    seller = await db.get(User, order.seller_user_id)

    # Only trackable once picked up for delivery (3) and before delivered (4).
    visible = (
        order.fulfillment_status == 3
        and seller is not None
        and seller.is_sharing_location
        and _is_fresh(seller.location_updated_at)
    )

    return OrderTrackingResponse(
        order_id=order.id,
        fulfillment_status=order.fulfillment_status,
        seller_name=(seller.display_name or "Kalakar Artisan") if seller else "Kalakar Artisan",
        latitude=seller.latitude if visible else None,
        longitude=seller.longitude if visible else None,
        location_updated_at=seller.location_updated_at if visible else None,
    )
