"""
Kalakar Setu — Profile Schemas
Pydantic models for profile operations.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProfileResponse(BaseModel):
    id: str
    phone_number: str
    display_name: str | None
    preferred_language: str
    craft_types: list[str]
    state_code: str | None
    district_code: str | None
    onboarding_step: int
    onboarding_completed: bool
    is_active: bool
    gem_seller_id: str | None = None
    ondc_subscriber_id: str | None = None
    is_sharing_location: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    preferred_language: Optional[str] = Field(None, max_length=10)
    craft_types: Optional[list[str]] = None
    state_code: Optional[str] = Field(None, max_length=5)
    district_code: Optional[str] = Field(None, max_length=10)


class OnboardingUpdateRequest(BaseModel):
    step: int = Field(..., ge=0, le=10)
    display_name: Optional[str] = Field(None, max_length=100)
    preferred_language: Optional[str] = Field(None, max_length=10)
    craft_types: Optional[list[str]] = None
    state_code: Optional[str] = Field(None, max_length=5)
    district_code: Optional[str] = Field(None, max_length=10)
    completed: bool = False


class SellerReadinessResponse(BaseModel):
    profile_complete: bool
    has_display_name: bool
    has_craft_type: bool
    has_location: bool
    onboarding_completed: bool
    gem_connected: bool
    ondc_connected: bool
    completion_percentage: int


class DeactivateRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)
