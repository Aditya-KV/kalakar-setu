"""
Kalakar Setu — Media Pydantic Schemas
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MediaQualityCheck(BaseModel):
    quality_score: float = Field(..., ge=0.0, le=1.0)
    is_blurry: bool
    is_too_dark: bool
    is_overexposed: bool
    quality_issues: list[str] = []


class GalleryVariant(BaseModel):
    key: str
    label: str
    url: str


class MediaResponse(BaseModel):
    id: str
    user_id: str
    draft_id: Optional[str] = None
    original_url: str
    enhanced_url: Optional[str] = None
    bg_removed_url: Optional[str] = None
    aspect_ratio_1x1_url: Optional[str] = None
    aspect_ratio_4x5_url: Optional[str] = None
    gallery: list[GalleryVariant] = []
    is_primary: bool
    quality_score: float
    is_blurry: bool
    is_too_dark: bool
    is_overexposed: bool
    quality_issues: list[str] = []
    enhancement_status: str
    failure_reason: Optional[str] = None
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaEnhanceRequest(BaseModel):
    remove_background: bool = True
    auto_contrast: bool = True
    generate_variants: bool = True
