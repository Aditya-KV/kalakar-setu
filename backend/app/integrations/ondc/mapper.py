"""
Kalakar Setu model -> ONDC-shaped model.

IMPORTANT — read before trusting this file:
This is a deliberately simplified mapping, matching Milestone 3 of the
prototype plan (see Kalakar_Setu_ONDC_Prototype_Implementation.md ideas).
It is NOT validated against the official ONDC B2B Retail API Contract —
mandatory fields (category/HSN codes, GST breakup, fulfillment types,
tags, location, etc.) are missing or stubbed. Before pointing this at a
real ONDC sandbox, validate the on_search payload this produces in the
ONDC Workbench (https://workbench.ondc.tech/home) against the currently
published contract, and fill in whatever it flags as missing.

We also don't collect several ONDC-mandatory seller fields yet (GSTIN,
PAN, a registered business name distinct from the artisan's own name,
HSN/category codes per product) — those are stubbed with safe
placeholders below and are called out again in ONDC_SETUP.md.
"""

from app.models.user import User
from app.models.listing import Listing


def artisan_to_provider(seller: User) -> dict:
    """One artisan -> one ONDC provider."""
    return {
        "id": seller.id,
        "descriptor": {
            "name": seller.display_name or "Kalakar Artisan",
        },
        # TODO: real registered address once Address is linked to sellers
        # for marketplace purposes, not just delivery addresses.
        "locations": [
            {
                "id": f"{seller.id}-loc-1",
                "gps": None,
                "address": {
                    "state": seller.state_code,
                    "district": seller.district_code,
                },
            }
        ],
    }


def listing_to_item(listing: Listing) -> dict:
    """One Listing -> one ONDC catalogue item."""
    return {
        "id": listing.id,
        "descriptor": {
            "name": listing.title_en,
            "short_desc": listing.description_en[:200],
            "images": [listing.primary_image_url] if listing.primary_image_url else [],
        },
        "price": {
            "currency": "INR",
            "value": str(listing.price),
        },
        "quantity": {
            "available": {"count": str(listing.quantity_available)},
        },
        "category_id": listing.craft_type or "other",
        "provider_id": listing.user_id,
        # TODO: real HSN/GST once collected on the Listing.
        "tags": listing.keywords or [],
    }


def build_on_search(
    incoming_context: dict,
    listings_by_seller: dict[User, list[Listing]],
) -> dict:
    """Build a (simplified) on_search payload grouping items under each
    seller as its own ONDC provider — this is how one Kalakar Setu
    integration exposes every artisan as a distinct seller on ONDC."""
    from app.integrations.ondc.context import build_callback_context

    providers = []
    for seller, listings in listings_by_seller.items():
        provider = artisan_to_provider(seller)
        provider["items"] = [listing_to_item(listing) for listing in listings]
        providers.append(provider)

    return {
        "context": build_callback_context(incoming_context, "on_search"),
        "message": {
            "catalog": {
                "bpp/providers": providers,
            }
        },
    }
