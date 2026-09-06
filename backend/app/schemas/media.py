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


class QualitySummary(BaseModel):
    brightness: Optional[float] = None
    blur_score: Optional[float] = None
    warning: Optional[str] = None


class ProcessingSummary(BaseModel):
    background_removed: bool = False
    white_balance_applied: bool = False
    lighting_corrected: bool = False
    shadow_added: bool = False


class MediaResponse(BaseModel):
    id: str
    user_id: str
    draft_id: Optional[str] = None
    original_url: str
    enhanced_url: Optional[str] = None
    bg_removed_url: Optional[str] = None
    aspect_ratio_1x1_url: Optional[str] = None
    aspect_ratio_4x5_url: Optional[str] = None
    transparent_url: Optional[str] = None
    # Virtual Product Studio aliases — same underlying assets as the fields
    # above, named to match the studio pipeline's own vocabulary. Kept
    # alongside the older field names for frontend backward compatibility.
    studio_url: Optional[str] = None
    studio_square_url: Optional[str] = None
    studio_portrait_url: Optional[str] = None
    gallery: list[GalleryVariant] = []
    is_primary: bool
    quality_score: float
    is_blurry: bool
    is_too_dark: bool
    is_overexposed: bool
    quality_issues: list[str] = []
    quality: Optional[QualitySummary] = None
    processing: Optional[ProcessingSummary] = None
    enhancement_status: str
    failure_reason: Optional[str] = None
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MediaEnhanceRequest(BaseModel):
    # remove_background/auto_contrast/generate_variants are kept for
    # frontend backward compatibility with the pre-Studio contract.
    # remove_background=False skips the studio pipeline entirely (returns
    # the original, quality-analyzed only). auto_contrast=False still runs
    # segmentation/crop/canvas/shadow but skips white balance, exposure
    # correction, subject enhancement, and studio light simulation.
    remove_background: bool = True
    auto_contrast: bool = True
    generate_variants: bool = True
    background: str = "WARM_WHITE"  # WHITE | WARM_WHITE | SOFT_OFF_WHITE
