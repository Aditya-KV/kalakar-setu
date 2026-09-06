"""
Kalakar Setu — Order Schemas
"""

from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.listing import BilingualText
from app.schemas.address import AddressResponse


class OrderItemCreate(BaseModel):
    listing_id: str
    quantity: int = Field(default=1, ge=1, le=1000)


class OrderCreateRequest(BaseModel):
    items: list[OrderItemCreate] = Field(..., min_length=1)
    delivery_address_id: str
    payment_method: str = "cod"


class FulfillmentUpdateRequest(BaseModel):
    fulfillment_status: int = Field(..., ge=1, le=4)


class OrderItemResponse(BaseModel):
    id: str
    listing_id: str | None
    title: BilingualText
    image_url: str | None
    unit_price: int
    quantity: int


class OrderResponse(BaseModel):
    id: str
    seller_id: str
    seller_name: str
    buyer_id: str
    delivery_address: dict
    payment_method: str
    payment_status: str
    fulfillment_status: int
    total_price: int
    items: list[OrderItemResponse]
    created_at: datetime
