"""
Kalakar Setu — Order Service
Checkout (cart -> one Order per seller) and order history for both sides
of a transaction — the buyer who placed it and the seller who fulfills it.
"""

from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem
from app.models.listing import Listing
from app.models.address import Address
from app.models.user import User
from app.schemas.order import OrderCreateRequest, OrderResponse, OrderItemResponse


async def create_orders(db: AsyncSession, buyer_user_id: str, body: OrderCreateRequest) -> list[Order]:
    address = await db.get(Address, body.delivery_address_id)
    if not address or address.user_id != buyer_user_id:
        raise HTTPException(status_code=404, detail="Delivery address not found")

    address_snapshot = {
        "recipient_name": address.recipient_name,
        "phone_number": address.phone_number,
        "line1": address.line1,
        "line2": address.line2,
        "city": address.city,
        "state_code": address.state_code,
        "pincode": address.pincode,
    }

    # Fetch and validate every listing up front, grouped by seller.
    items_by_seller: dict[str, list[tuple[Listing, int]]] = defaultdict(list)
    for item in body.items:
        listing = await db.get(Listing, item.listing_id)
        if not listing or listing.status != "live":
            raise HTTPException(status_code=404, detail=f"Listing {item.listing_id} is not available")
        if listing.user_id == buyer_user_id:
            raise HTTPException(status_code=400, detail="You cannot buy your own listing")
        if listing.quantity_available < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Only {listing.quantity_available} left of '{listing.title_en}'",
            )
        items_by_seller[listing.user_id].append((listing, item.quantity))

    created_orders: list[Order] = []
    for seller_user_id, listing_qty_pairs in items_by_seller.items():
        total_price = sum(listing.price * qty for listing, qty in listing_qty_pairs)
        order = Order(
            buyer_user_id=buyer_user_id,
            seller_user_id=seller_user_id,
            delivery_address=address_snapshot,
            payment_method=body.payment_method,
            payment_status="pending",
            fulfillment_status=1,
            total_price=total_price,
        )
        db.add(order)
        await db.flush()

        for listing, qty in listing_qty_pairs:
            db.add(OrderItem(
                order_id=order.id,
                listing_id=listing.id,
                title_en=listing.title_en,
                title_hi=listing.title_hi,
                title_mr=listing.title_mr,
                image_url=listing.primary_image_url,
                unit_price=listing.price,
                quantity=qty,
            ))
            listing.quantity_available -= qty

        created_orders.append(order)

    await db.flush()
    # Re-fetch with items eagerly loaded for the response.
    for order in created_orders:
        await db.refresh(order, attribute_names=["items"])

    return created_orders


async def list_buying_orders(db: AsyncSession, buyer_user_id: str) -> list[tuple[Order, User]]:
    result = await db.execute(
        select(Order, User)
        .join(User, Order.seller_user_id == User.id)
        .options(selectinload(Order.items))
        .where(Order.buyer_user_id == buyer_user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.all())


async def list_selling_orders(db: AsyncSession, seller_user_id: str) -> list[tuple[Order, User]]:
    result = await db.execute(
        select(Order, User)
        .join(User, Order.seller_user_id == User.id)
        .options(selectinload(Order.items))
        .where(Order.seller_user_id == seller_user_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.all())


async def update_fulfillment_status(
    db: AsyncSession, seller_user_id: str, order_id: str, fulfillment_status: int
) -> Order | None:
    order = await db.get(Order, order_id, options=[selectinload(Order.items)])
    if not order or order.seller_user_id != seller_user_id:
        return None
    order.fulfillment_status = fulfillment_status
    if fulfillment_status == 4 and order.payment_method == "cod":
        order.payment_status = "paid"
    await db.flush()
    return order


def to_response(order: Order, seller: User) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        seller_id=order.seller_user_id,
        seller_name=seller.display_name or "Kalakar Artisan",
        buyer_id=order.buyer_user_id,
        delivery_address=order.delivery_address,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        fulfillment_status=order.fulfillment_status,
        total_price=order.total_price,
        items=[
            OrderItemResponse(
                id=item.id,
                listing_id=item.listing_id,
                title={"en": item.title_en, "hi": item.title_hi, "mr": item.title_mr},
                image_url=item.image_url,
                unit_price=item.unit_price,
                quantity=item.quantity,
            )
            for item in order.items
        ],
        created_at=order.created_at,
    )
