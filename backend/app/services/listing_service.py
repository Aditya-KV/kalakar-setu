"""
Kalakar Setu — Product Listing Service
Creates and manages the finished, priced listings that come out of the
Photo Studio -> Voice Cataloger -> Price flow.
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Listing
from app.models.media import ProductImage
from app.schemas.listing import ListingCreateRequest, ListingUpdateRequest, ListingResponse


async def create_listing(db: AsyncSession, user_id: str, body: ListingCreateRequest) -> Listing:
    """Creates a published listing, pulling the photo gallery from the given
    media_id if it belongs to this user. A missing/invalid media_id still
    creates the listing (no photos) rather than failing the whole publish."""
    primary_image_url = None
    gallery: list = []

    if body.media_id:
        media = await db.get(ProductImage, body.media_id)
        if media and media.user_id == user_id:
            gallery = media.gallery or []
            primary_image_url = media.bg_removed_url or media.enhanced_url or media.original_url

    listing = Listing(
        user_id=user_id,
        media_id=body.media_id if gallery else None,
        title_en=body.title.en,
        title_hi=body.title.hi,
        title_mr=body.title.mr,
        description_en=body.description.en,
        description_hi=body.description.hi,
        description_mr=body.description.mr,
        craft_type=body.craft_type,
        attributes=body.attributes.model_dump(),
        keywords=body.keywords,
        price=body.price,
        quantity_available=body.quantity_available,
        primary_image_url=primary_image_url,
        gallery=gallery,
        status="live",
    )
    db.add(listing)
    await db.flush()
    return listing


async def list_listings(db: AsyncSession, user_id: str) -> list[Listing]:
    result = await db.execute(
        select(Listing).where(Listing.user_id == user_id).order_by(Listing.created_at.desc())
    )
    return list(result.scalars().all())


async def get_listing(db: AsyncSession, user_id: str, listing_id: str) -> Listing | None:
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_listing(
    db: AsyncSession, user_id: str, listing_id: str, body: ListingUpdateRequest
) -> Listing | None:
    listing = await get_listing(db, user_id, listing_id)
    if not listing:
        return None

    if body.title is not None:
        listing.title_en = body.title.en
        listing.title_hi = body.title.hi
        if "mr" in body.title.model_fields_set:
            listing.title_mr = body.title.mr
    if body.description is not None:
        listing.description_en = body.description.en
        listing.description_hi = body.description.hi
        if "mr" in body.description.model_fields_set:
            listing.description_mr = body.description.mr
    if body.price is not None:
        listing.price = body.price
    if body.quantity_available is not None:
        listing.quantity_available = body.quantity_available
    if body.status is not None:
        listing.status = body.status

    await db.flush()
    return listing


async def delete_listing(db: AsyncSession, user_id: str, listing_id: str) -> bool:
    listing = await get_listing(db, user_id, listing_id)
    if not listing:
        return False
    await db.delete(listing)
    return True


async def get_listing_stats(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(Listing.status, func.count())
        .where(Listing.user_id == user_id)
        .group_by(Listing.status)
    )
    counts = dict(result.all())
    active = counts.get("live", 0)
    drafts = counts.get("draft", 0)
    return {
        "active_listings": active,
        "draft_listings": drafts,
        "total_listings": sum(counts.values()),
    }


def to_response(listing: Listing) -> ListingResponse:
    return ListingResponse(
        id=listing.id,
        title={"en": listing.title_en, "hi": listing.title_hi, "mr": listing.title_mr},
        description={"en": listing.description_en, "hi": listing.description_hi, "mr": listing.description_mr},
        craft_type=listing.craft_type,
        attributes=listing.attributes or {},
        keywords=listing.keywords or [],
        price=listing.price,
        quantity_available=listing.quantity_available,
        primary_image_url=listing.primary_image_url,
        gallery=listing.gallery or [],
        status=listing.status,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )
