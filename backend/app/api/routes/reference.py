"""
Kalakar Setu — Reference Data Routes
Public endpoints for crafts, locations, and languages.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.reference import (
    CraftTypeResponse,
    StateResponse,
    DistrictResponse,
    LanguageResponse,
)
from app.services import reference_service

router = APIRouter(prefix="/reference", tags=["Reference Data"])


@router.get("/languages", response_model=list[LanguageResponse])
async def get_languages(db: AsyncSession = Depends(get_db)):
    """Get all supported interface/voice languages."""
    return await reference_service.get_languages(db)


@router.get("/crafts", response_model=list[CraftTypeResponse])
async def get_crafts(db: AsyncSession = Depends(get_db)):
    """Get all active craft type categories."""
    return await reference_service.get_crafts(db)


@router.get("/states", response_model=list[StateResponse])
async def get_states(db: AsyncSession = Depends(get_db)):
    """Get all Indian states and UTs."""
    return await reference_service.get_states(db)


@router.get("/districts", response_model=list[DistrictResponse])
async def get_districts(
    state_code: str | None = Query(None, description="Filter by state code"),
    db: AsyncSession = Depends(get_db),
):
    """Get districts, optionally filtered by state code."""
    return await reference_service.get_districts(db, state_code)
