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
from app.services import order_service

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
    return order_service.to_response(order, seller)
