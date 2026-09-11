"""
Kalakar Setu — Order Routes
Checkout (Customer mode) and order fulfillment (Seller mode).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.models.user import User
from app.schemas.order import OrderCreateRequest, OrderResponse, FulfillmentUpdateRequest
from app.schemas.location import OrderTrackingResponse
from app.services import order_service, location_service, notification_service

FULFILLMENT_LABELS = {1: "Received", 2: "Packed", 3: "Picked Up", 4: "Delivered"}

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=list[OrderResponse])
async def checkout(
    body: OrderCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Places an order — splits a multi-seller cart into one Order per seller."""
    orders = await order_service.create_orders(db, user_id, body)
    responses = []
    for order in orders:
        seller = await db.get(User, order.seller_user_id)
        responses.append(order_service.to_response(order, seller))
        await notification_service.send_push_notification(
            seller.push_token if seller else None,
            title="New order received!",
            body=f"You have a new order worth ₹{order.total_price:,}.",
            data={"type": "order", "order_id": order.id, "role": "seller"},
        )
    return responses


@router.get("/buying", response_model=list[OrderResponse])
async def list_my_purchases(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Orders this user placed as a buyer (Customer mode)."""
    rows = await order_service.list_buying_orders(db, user_id)
    return [order_service.to_response(order, seller) for order, seller in rows]


@router.get("/selling", response_model=list[OrderResponse])
async def list_orders_to_fulfill(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Orders this user needs to fulfill as a seller — powers the Orders tab."""
    rows = await order_service.list_selling_orders(db, user_id)
    return [order_service.to_response(order, seller) for order, seller in rows]


@router.get("/{order_id}/tracking", response_model=OrderTrackingResponse)
async def get_order_tracking(
    order_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Live seller position for one of the buyer's own orders — only
    populated once the seller has marked it 'Picked Up' and is currently
    sharing their location."""
    tracking = await location_service.get_order_tracking(db, user_id, order_id)
    if not tracking:
        raise HTTPException(status_code=404, detail="Order not found")
    return tracking


@router.patch("/{order_id}/fulfillment", response_model=OrderResponse)
async def update_fulfillment(
    order_id: str,
    body: FulfillmentUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.update_fulfillment_status(db, user_id, order_id, body.fulfillment_status)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    seller = await db.get(User, order.seller_user_id)
    buyer = await db.get(User, order.buyer_user_id)
    status_label = FULFILLMENT_LABELS.get(order.fulfillment_status, "updated")
    await notification_service.send_push_notification(
        buyer.push_token if buyer else None,
        title="Order update",
        body=f"Your order is now {status_label}.",
        data={"type": "order", "order_id": order.id, "role": "buyer"},
    )
    return order_service.to_response(order, seller)
