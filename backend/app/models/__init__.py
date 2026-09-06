"""
Import all models so Alembic and Base.metadata.create_all() can discover them.
"""

from app.models.user import User
from app.models.otp import OTPVerification
from app.models.consent import ConsentRecord
from app.models.reference import CraftType, State, District, SupportedLanguage
from app.models.media import ProductImage
from app.models.listing import Listing
from app.models.address import Address
from app.models.order import Order, OrderItem
from app.models.marketplace_listing import MarketplaceListing
from app.models.integration_event import IntegrationEvent

__all__ = [
    "User",
    "OTPVerification",
    "ConsentRecord",
    "CraftType",
    "State",
    "District",
    "SupportedLanguage",
    "ProductImage",
    "Listing",
    "Address",
    "Order",
    "OrderItem",
    "MarketplaceListing",
    "IntegrationEvent",
]
