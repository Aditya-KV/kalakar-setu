"""
Kalakar Setu — Media & AI Studio Routes
Endpoints for photo upload, quality checking, AI enhancement, and variant generation.
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

router = APIRouter(prefix="/media", tags=["AI Photo Studio"])


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
        is_blurry=analysis["is_blurry"],
        is_too_dark=analysis["is_too_dark"],
        is_overexposed=analysis["is_overexposed"],
        quality_issues=analysis["quality_issues"],
        enhancement_status="pending",
    )
    db.add(media)
    await db.flush()

    return media


@router.post("/enhance/{media_id}", response_model=MediaResponse)
async def enhance_product_photo(
    media_id: str,
    body: MediaEnhanceRequest = MediaEnhanceRequest(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers AI background removal, lighting correction, and variant cropping (FR-3.4, FR-3.5, FR-3.6).
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

    try:
        # Load original image bytes — works whether it was saved locally or to Supabase Storage.
        raw_bytes = storage_service.read_file(media.original_url)

        # 1. Lighting & Color Enhancement
        enhanced_bytes = image_service.enhance_photo(raw_bytes)
        media.enhanced_url = image_service.save_image_file(enhanced_bytes, "enhanced")

        # 2. Background Removal & Studio Isolation
        if body.remove_background:
            bg_removed_bytes = image_service.remove_background(enhanced_bytes)
            media.bg_removed_url = image_service.save_image_file(bg_removed_bytes, "bg_removed")
        else:
            media.bg_removed_url = media.enhanced_url

        # 3. Generate E-Commerce Marketplace Variants (1:1 & 4:5)
        if body.generate_variants:
            source_for_variants = bg_removed_bytes if body.remove_background else enhanced_bytes
            var_1x1 = image_service.create_aspect_ratio_variant(source_for_variants, "1:1")
            var_4x5 = image_service.create_aspect_ratio_variant(source_for_variants, "4:5")

            media.aspect_ratio_1x1_url = image_service.save_image_file(var_1x1, "1x1")
            media.aspect_ratio_4x5_url = image_service.save_image_file(var_4x5, "4x5")

        # 4. Multi-shot product gallery: varied crops/backgrounds from this one
        # photo (the local, free stand-in for "multiple angles" — see FR-3.x).
        gallery = [{"key": "enhanced", "label": "Enhanced", "url": media.enhanced_url}]
        if media.aspect_ratio_1x1_url:
            gallery.append({"key": "studio_square", "label": "Studio Square", "url": media.aspect_ratio_1x1_url})
        if media.aspect_ratio_4x5_url:
            gallery.append({"key": "studio_portrait", "label": "Studio Portrait", "url": media.aspect_ratio_4x5_url})
        detail_bytes = image_service.create_detail_crop(enhanced_bytes)
        gallery.append({
            "key": "detail",
            "label": "Detail Shot",
            "url": image_service.save_image_file(detail_bytes, "detail"),
        })
        media.gallery = gallery

        media.enhancement_status = "completed"
    except Exception as e:
        media.enhancement_status = "failed"
        media.failure_reason = str(e)

    await db.flush()
    return media


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
    return media


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
