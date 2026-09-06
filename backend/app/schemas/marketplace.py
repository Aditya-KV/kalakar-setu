"""
Kalakar Setu — Customer-facing Marketplace Schemas
"""

from datetime import datetime
from pydantic import BaseModel
from app.schemas.listing import BilingualText, ListingAttributes, GalleryVariant


class SellerSummary(BaseModel):
    id: str
    name: str
    district_code: str | None
    state_code: str | None


class MarketplaceListingResponse(BaseModel):
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
    seller: SellerSummary
    created_at: datetime
