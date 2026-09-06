"""
Kalakar Setu — Product Listing Schemas
"""

from datetime import datetime
from pydantic import BaseModel, Field


class BilingualText(BaseModel):
    en: str
    hi: str
    mr: str | None = None


class ListingAttributes(BaseModel):
    material: list[str] = []
    color: list[str] = []
    technique: list[str] = []


class GalleryVariant(BaseModel):
    key: str
    label: str
    url: str


class ListingCreateRequest(BaseModel):
    media_id: str | None = None
    title: BilingualText
    description: BilingualText
    craft_type: str | None = None
    attributes: ListingAttributes = ListingAttributes()
    keywords: list[str] = []
    price: int = Field(..., ge=1, le=10_000_000)
    quantity_available: int = Field(default=1, ge=1, le=100_000)


class ListingUpdateRequest(BaseModel):
    title: BilingualText | None = None
    description: BilingualText | None = None
    price: int | None = Field(default=None, ge=1, le=10_000_000)
    quantity_available: int | None = Field(default=None, ge=1, le=100_000)
    status: str | None = None


class ListingResponse(BaseModel):
    id: str
    title: BilingualText
    description: BilingualText
    craft_type: str | None
    attributes: ListingAttributes
    keywords: list[str]
    price: int
    quantity_available: int
    primary_image_url: str | None
    gallery: list[GalleryVariant]
    status: str
    created_at: datetime
    updated_at: datetime


class ListingStatsResponse(BaseModel):
    active_listings: int
    draft_listings: int
    total_listings: int
