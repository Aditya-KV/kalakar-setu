"""
Kalakar Setu — Live Location Schemas
"""

from datetime import datetime
from pydantic import BaseModel, Field


class LocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    is_sharing_location: bool


class NearbySeller(BaseModel):
    id: str
    name: str
    craft_types: list[str]
    latitude: float
    longitude: float
    location_updated_at: datetime
    distance_km: float | None = None


class OrderTrackingResponse(BaseModel):
    order_id: str
    fulfillment_status: int
    seller_name: str
    # Null whenever the seller's position isn't currently visible for this
    # order — not yet picked up, already delivered, sharing turned off, or
    # the last fix is too old to trust. fulfillment_status tells the caller
    # which of those applies.
    latitude: float | None
    longitude: float | None
    location_updated_at: datetime | None
