"""
Kalakar Setu — Media & Virtual Product Studio Routes
Endpoints for photo upload, quality checking, and the deterministic local
image-processing studio pipeline (background isolation, lighting, contact
shadow, multi-format export). No generative AI / external image API.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.api.deps import get_current_user_id
from app.schemas.media import MediaResponse, MediaEnhanceRequest
from app.models.media import ProductImage
from app.services import image_service, storage_service
from app.services.image_studio.pipeline import StudioEnhancementPipeline
from app.services.image_studio.config import StudioConfig, BACKGROUND_PRESETS
from app.services.image_studio import export as studio_export

router = APIRouter(prefix="/media", tags=["AI Photo Studio"])


def _build_media_response(media: ProductImage) -> dict:
    """Assembles the full MediaResponse payload, including the Virtual
    Product Studio aliases and nested quality/processing summaries, from
    the stored ORM columns — used by every route that returns a MediaResponse
    so GET and the enhance response always agree."""
    processing_meta = media.processing_meta or {}
    quality_issues = media.quality_issues or []
    return {
        "id": media.id,
        "user_id": media.user_id,
        "draft_id": media.draft_id,
        "original_url": media.original_url,
        "enhanced_url": media.enhanced_url,
        "bg_removed_url": media.bg_removed_url,
        "aspect_ratio_1x1_url": media.aspect_ratio_1x1_url,
        "aspect_ratio_4x5_url": media.aspect_ratio_4x5_url,
        "transparent_url": media.transparent_url,
        "studio_url": media.bg_removed_url,
        "studio_square_url": media.aspect_ratio_1x1_url,
        "studio_portrait_url": media.aspect_ratio_4x5_url,
        "gallery": media.gallery or [],
        "is_primary": media.is_primary,
        "quality_score": media.quality_score,
        "is_blurry": media.is_blurry,
        "is_too_dark": media.is_too_dark,
        "is_overexposed": media.is_overexposed,
        "quality_issues": quality_issues,
        "quality": {
            "brightness": media.brightness,
            "blur_score": media.blur_score,
            "warning": quality_issues[0] if quality_issues else None,
        },
        "processing": {
            "background_removed": processing_meta.get("background_removed", False),
            "white_balance_applied": processing_meta.get("white_balance_applied", False),
            "lighting_corrected": processing_meta.get("lighting_corrected", False),
            "shadow_added": processing_meta.get("shadow_added", False),
        },
        "enhancement_status": media.enhancement_status,
        "failure_reason": media.failure_reason,
        "model_version": media.model_version,
        "created_at": media.created_at,
    }


@router.post("/upload", response_model=MediaResponse)
async def upload_product_photo(
    file: UploadFile = File(...),
    draft_id: str | None = Form(None),
    is_primary: bool = Form(False),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a product photo. Runs immediate image quality check for blur & lighting (FR-3.1, FR-3.3).
    """
    # Read file bytes
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Analyze quality
    analysis = image_service.analyze_image_quality(contents)

    # Save original image file
    original_url = image_service.save_image_file(contents, "original")

    # Create ProductImage record
    media = ProductImage(
        user_id=user_id,
        draft_id=draft_id,
        original_url=original_url,
        is_primary=is_primary,
        quality_score=analysis["quality_score"],
        brightness=analysis.get("brightness"),
        blur_score=analysis.get("blur_score"),
        is_blurry=analysis["is_blurry"],
        is_too_dark=analysis["is_too_dark"],
        is_overexposed=analysis["is_overexposed"],
        quality_issues=analysis["quality_issues"],
        enhancement_status="pending",
    )
    db.add(media)
    await db.flush()

    return _build_media_response(media)


@router.post("/enhance/{media_id}", response_model=MediaResponse)
async def enhance_product_photo(
    media_id: str,
    body: MediaEnhanceRequest = MediaEnhanceRequest(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Runs the Virtual Product Studio pipeline: local foreground segmentation,
    mask refinement, edge decontamination, white balance / exposure /
    subject enhancement, studio light simulation, contact shadow, and
    multi-format export (studio square/portrait JPEGs + transparent PNG).
    Entirely deterministic local image processing — no generative AI, no
    external image API (FR-3.4, FR-3.5, FR-3.6).
    """
    result = await db.execute(
        select(ProductImage).where(
            ProductImage.id == media_id, ProductImage.user_id == user_id
        )
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media record not found")

    media.enhancement_status = "processing"
    await db.flush()

    background = body.background if body.background in BACKGROUND_PRESETS else "WARM_WHITE"

    try:
        raw_bytes = storage_service.read_file(media.original_url)

        if not body.remove_background:
            # Legacy no-op path — skip the studio pipeline entirely and
            # just keep the original photo for every variant field.
            media.enhanced_url = media.original_url
            media.bg_removed_url = media.original_url
            media.aspect_ratio_1x1_url = media.original_url
            media.aspect_ratio_4x5_url = media.original_url
            media.transparent_url = None
            media.gallery = [{"key": "original", "label": "Original", "url": media.original_url}]
            media.processing_meta = {
                "background_removed": False, "white_balance_applied": False,
                "lighting_corrected": False, "shadow_added": False,
            }
            media.enhancement_status = "completed"
            await db.flush()
            return _build_media_response(media)

        config = StudioConfig(background=background)
        pipeline = StudioEnhancementPipeline(config=config)
        studio_result = pipeline.run(raw_bytes, backgrounds=[background], apply_lighting=body.auto_contrast)

        square_bytes = studio_export.encode_jpeg(studio_result.studio_images[background], quality=config.jpeg_quality)
        portrait_bytes = studio_export.encode_jpeg(studio_result.portrait_image, quality=config.jpeg_quality)
        transparent_bytes = studio_export.encode_png(studio_result.transparent)

        square_url = storage_service.save_file(square_bytes, "studio_square", content_type="image/jpeg")
        portrait_url = storage_service.save_file(portrait_bytes, "studio_portrait", content_type="image/jpeg")
        transparent_url = storage_service.save_file(transparent_bytes, "transparent", content_type="image/png", extension="png")

        media.enhanced_url = square_url
        media.bg_removed_url = square_url
        media.aspect_ratio_1x1_url = square_url
        media.aspect_ratio_4x5_url = portrait_url
        media.transparent_url = transparent_url
        media.model_version = "v2.0-virtual-studio"

        gallery = [
            {"key": "studio_square", "label": "Studio Square", "url": square_url},
            {"key": "studio_portrait", "label": "Studio Portrait", "url": portrait_url},
            {"key": "transparent", "label": "Transparent Cutout", "url": transparent_url},
        ]
        if studio_result.thumbnail:
            thumbnail_bytes = studio_export.encode_jpeg(studio_result.thumbnail, quality=config.jpeg_quality)
            thumbnail_url = storage_service.save_file(thumbnail_bytes, "thumbnail", content_type="image/jpeg")
            gallery.append({"key": "thumbnail", "label": "Thumbnail", "url": thumbnail_url})
        media.gallery = gallery

        media.processing_meta = {
            "background_removed": True,
            "white_balance_applied": bool(body.auto_contrast),
            "lighting_corrected": bool(body.auto_contrast),
            "shadow_added": True,
        }

        if studio_result.warnings:
            media.quality_issues = list(media.quality_issues or []) + studio_result.warnings

        media.enhancement_status = "completed"
    except Exception as e:
        media.enhancement_status = "failed"
        media.failure_reason = str(e)

    await db.flush()
    return _build_media_response(media)


@router.get("/{media_id}", response_model=MediaResponse)
async def get_media_status(
    media_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get status and variant URLs for a photo."""
    result = await db.execute(
        select(ProductImage).where(
            ProductImage.id == media_id, ProductImage.user_id == user_id
        )
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media record not found")
    return _build_media_response(media)


@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a product photo."""
    result = await db.execute(
        select(ProductImage).where(
            ProductImage.id == media_id, ProductImage.user_id == user_id
        )
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media record not found")

    await db.delete(media)
    return {"success": True, "message": "Media deleted."}
