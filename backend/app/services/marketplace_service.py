"""
Kalakar Setu — Customer-facing Marketplace Service
Read-only browsing of other sellers' live listings.
"""

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Listing
from app.models.user import User
from app.schemas.marketplace import MarketplaceListingResponse, SellerSummary


async def browse_listings(
    db: AsyncSession,
    exclude_user_id: str,
    search: str | None = None,
    craft_type: str | None = None,
) -> list[MarketplaceListingResponse]:
    query = (
        select(Listing, User)
        .join(User, Listing.user_id == User.id)
        .where(Listing.status == "live", Listing.user_id != exclude_user_id)
        .order_by(Listing.created_at.desc())
    )
    if craft_type:
        query = query.where(Listing.craft_type == craft_type)
    if search:
        like = f"%{search}%"
        query = query.where(or_(Listing.title_en.ilike(like), Listing.title_hi.ilike(like), Listing.title_mr.ilike(like)))

    result = await db.execute(query)
    return [_to_response(listing, seller) for listing, seller in result.all()]


async def get_listing_detail(db: AsyncSession, listing_id: str) -> MarketplaceListingResponse | None:
    result = await db.execute(
        select(Listing, User).join(User, Listing.user_id == User.id).where(Listing.id == listing_id)
    )
    row = result.first()
    if not row:
        return None
    return _to_response(*row)


def _to_response(listing: Listing, seller: User) -> MarketplaceListingResponse:
    return MarketplaceListingResponse(
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
        seller=SellerSummary(
            id=seller.id,
            name=seller.display_name or "Kalakar Artisan",
            district_code=seller.district_code,
            state_code=seller.state_code,
        ),
        created_at=listing.created_at,
    )
