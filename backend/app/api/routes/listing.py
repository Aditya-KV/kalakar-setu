"""
Kalakar Setu — Product Listing Routes
Create, list, view, edit and delete published catalog listings.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.schemas.listing import (
    ListingCreateRequest,
    ListingUpdateRequest,
    ListingResponse,
    ListingStatsResponse,
)
from app.services import listing_service

router = APIRouter(prefix="/listings", tags=["Listings"])


@router.post("", response_model=ListingResponse)
async def create_listing(
    body: ListingCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Publishes a new listing from the Photo Studio + Voice Cataloger + Price flow."""
    listing = await listing_service.create_listing(db, user_id, body)
    return listing_service.to_response(listing)


@router.get("/stats", response_model=ListingStatsResponse)
async def get_listing_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Active/draft/total listing counts, for the dashboard overview card."""
    return await listing_service.get_listing_stats(db, user_id)


@router.get("", response_model=list[ListingResponse])
async def list_listings(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Lists the current user's listings, newest first."""
    listings = await listing_service.list_listings(db, user_id)
    return [listing_service.to_response(l) for l in listings]


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    listing = await listing_service.get_listing(db, user_id, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing_service.to_response(listing)


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: str,
    body: ListingUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    listing = await listing_service.update_listing(db, user_id, listing_id, body)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing_service.to_response(listing)


@router.delete("/{listing_id}")
async def delete_listing(
    listing_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    deleted = await listing_service.delete_listing(db, user_id, listing_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"success": True, "message": "Listing deleted."}
