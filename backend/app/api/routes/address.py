"""
Kalakar Setu — Delivery Address Routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.schemas.address import AddressCreateRequest, AddressUpdateRequest, AddressResponse
from app.services import address_service

router = APIRouter(prefix="/addresses", tags=["Addresses"])


@router.post("", response_model=AddressResponse)
async def create_address(
    body: AddressCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await address_service.create_address(db, user_id, body)


@router.get("", response_model=list[AddressResponse])
async def list_addresses(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await address_service.list_addresses(db, user_id)


@router.patch("/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: str,
    body: AddressUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    address = await address_service.update_address(db, user_id, address_id, body)
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    return address


@router.delete("/{address_id}")
async def delete_address(
    address_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    deleted = await address_service.delete_address(db, user_id, address_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Address not found")
    return {"success": True, "message": "Address deleted."}
