"""
Kalakar Setu — Reference Data Routes
Public endpoints for crafts, locations, and languages.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.reference import (
    CraftTypeResponse,
    StateResponse,
    DistrictResponse,
    LanguageResponse,
    ClusterResponse,
    ClusterDetailResponse,
)
from app.services import reference_service, cluster_service

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


@router.get("/clusters", response_model=list[ClusterResponse])
async def get_clusters(
    state_code: str | None = Query(None, description="Filter by state code"),
    db: AsyncSession = Depends(get_db),
):
    """Get active craft clusters, optionally filtered by state code."""
    return await cluster_service.get_clusters(db, state_code)


@router.get("/clusters/{cluster_id}", response_model=ClusterDetailResponse)
async def get_cluster_detail(cluster_id: str, db: AsyncSession = Depends(get_db)):
    """Get a craft cluster with its current member sellers."""
    cluster = await cluster_service.get_cluster(db, cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    members = await cluster_service.get_cluster_members(db, cluster_id)
    return ClusterDetailResponse(
        id=cluster.id,
        name=cluster.name,
        craft_type=cluster.craft_type,
        state_code=cluster.state_code,
        story=cluster.story,
        member_craft_names=cluster.member_craft_names,
        members=members,
    )
