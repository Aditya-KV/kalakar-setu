"""
Kalakar Setu — Profile Routes
Profile view, update, onboarding progress, readiness, consent, and deactivation.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.schemas.profile import (
    ProfileResponse,
    ProfileUpdateRequest,
    OnboardingUpdateRequest,
    SellerReadinessResponse,
    DeactivateRequest,
    PushTokenUpdateRequest,
)
from app.schemas.location import LocationUpdateRequest
from app.services import profile_service, location_service

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's profile."""
    user = await profile_service.get_profile(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return user


@router.put("", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update profile fields."""
    data = body.model_dump(exclude_none=True)
    user = await profile_service.update_profile(db, user_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return user


@router.patch("/location", response_model=ProfileResponse)
async def update_location(
    body: LocationUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Pushes the seller's current device position and online/offline
    sharing state — called periodically by the app while "Share My
    Location" is on."""
    user = await location_service.update_location(
        db, user_id, body.latitude, body.longitude, body.is_sharing_location
    )
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return user


@router.patch("/push-token", response_model=ProfileResponse)
async def update_push_token(
    body: PushTokenUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Registers (or, with push_token: null, clears) this device's Expo
    push token — called on login and whenever the token refreshes."""
    user = await profile_service.update_push_token(db, user_id, body.push_token)
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return user


@router.put("/onboarding", response_model=ProfileResponse)
async def update_onboarding(
    body: OnboardingUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update onboarding progress. Saves step number and any associated profile data."""
    data = body.model_dump(exclude_none=True)
    user = await profile_service.update_onboarding(db, user_id, data)
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return user


@router.get("/readiness", response_model=SellerReadinessResponse)
async def get_readiness(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get seller readiness checklist showing profile/marketplace completion."""
    result = await profile_service.get_seller_readiness(db, user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


class ConsentRequest(BaseModel):
    consent_type: str  # "privacy", "data_collection", "voice_data"
    policy_version: str


@router.post("/consent")
async def record_consent(
    body: ConsentRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Record user consent for privacy policy or data collection."""
    ip = request.client.host if request.client else None
    record = await profile_service.record_consent(
        db, user_id, body.consent_type, body.policy_version, ip
    )
    return {"success": True, "consent_id": record.id}


@router.post("/deactivate")
async def deactivate_account(
    body: DeactivateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Request account deactivation. Account is marked inactive."""
    success = await profile_service.request_deactivation(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"success": True, "message": "Account deactivation requested."}
