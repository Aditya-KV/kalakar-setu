"""
Kalakar Setu — Delivery Address Service
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.address import Address
from app.schemas.address import AddressCreateRequest, AddressUpdateRequest


async def create_address(db: AsyncSession, user_id: str, body: AddressCreateRequest) -> Address:
    if body.is_default:
        await _clear_default(db, user_id)

    address = Address(user_id=user_id, **body.model_dump())
    db.add(address)
    await db.flush()
    return address


async def list_addresses(db: AsyncSession, user_id: str) -> list[Address]:
    result = await db.execute(
        select(Address).where(Address.user_id == user_id).order_by(Address.is_default.desc(), Address.created_at.desc())
    )
    return list(result.scalars().all())


async def get_address(db: AsyncSession, user_id: str, address_id: str) -> Address | None:
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_address(
    db: AsyncSession, user_id: str, address_id: str, body: AddressUpdateRequest
) -> Address | None:
    address = await get_address(db, user_id, address_id)
    if not address:
        return None

    update_data = body.model_dump(exclude_unset=True)
    if update_data.get("is_default"):
        await _clear_default(db, user_id)

    for field, value in update_data.items():
        setattr(address, field, value)

    await db.flush()
    return address


async def delete_address(db: AsyncSession, user_id: str, address_id: str) -> bool:
    address = await get_address(db, user_id, address_id)
    if not address:
        return False
    await db.delete(address)
    return True


async def _clear_default(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(
        select(Address).where(Address.user_id == user_id, Address.is_default == True)
    )
    for existing in result.scalars().all():
        existing.is_default = False
