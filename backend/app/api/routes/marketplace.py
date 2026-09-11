"""
Kalakar Setu — Customer-facing Marketplace Routes
Browsing other sellers' live listings (Customer mode).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.schemas.marketplace import MarketplaceListingResponse
from app.schemas.location import NearbySeller
from app.services import marketplace_service, location_service

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


@router.get("/sellers/nearby", response_model=list[NearbySeller])
async def get_nearby_sellers(
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Sellers currently sharing their live location, for the Discover map.
    Sorted nearest-first when the buyer's own position is given."""
    return await location_service.list_nearby_sellers(db, user_id, lat, lng)


@router.get("/listings", response_model=list[MarketplaceListingResponse])
async def browse_listings(
    search: str | None = Query(None),
    craft_type: str | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Browse other sellers' live listings — the Customer-mode Discover feed."""
    return await marketplace_service.browse_listings(db, user_id, search, craft_type)


@router.get("/listings/{listing_id}", response_model=MarketplaceListingResponse)
async def get_listing_detail(
    listing_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    listing = await marketplace_service.get_listing_detail(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing
