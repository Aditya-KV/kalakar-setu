"""
Kalakar Setu — Delivery Address Schemas
"""

from datetime import datetime
from pydantic import BaseModel, Field


class AddressCreateRequest(BaseModel):
    label: str = Field(default="Home", max_length=30)
    recipient_name: str = Field(..., max_length=100)
    phone_number: str = Field(..., max_length=15)
    line1: str = Field(..., max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(..., max_length=100)
    state_code: str = Field(..., max_length=5)
    pincode: str = Field(..., max_length=10)
    is_default: bool = False


class AddressUpdateRequest(BaseModel):
    label: str | None = Field(default=None, max_length=30)
    recipient_name: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=15)
    line1: str | None = Field(default=None, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state_code: str | None = Field(default=None, max_length=5)
    pincode: str | None = Field(default=None, max_length=10)
    is_default: bool | None = None


class AddressResponse(BaseModel):
    id: str
    label: str
    recipient_name: str
    phone_number: str
    line1: str
    line2: str | None
    city: str
    state_code: str
    pincode: str
    is_default: bool
    created_at: datetime
    model_config = {"from_attributes": True}
