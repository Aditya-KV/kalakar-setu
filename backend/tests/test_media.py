"""
Kalakar Setu — Media & Image Processing Tests
"""

import pytest
import io
from PIL import Image
from app.services import image_service


@pytest.fixture
def sample_image_bytes() -> bytes:
    """Create a sample 400x400 RGB test image."""
    img = Image.new("RGB", (400, 400), color=(220, 120, 80))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_analyze_image_quality(sample_image_bytes):
    """Test image quality analyzer returns score and diagnostics."""
    analysis = image_service.analyze_image_quality(sample_image_bytes)
    assert "quality_score" in analysis
    assert isinstance(analysis["quality_score"], float)
    assert "is_blurry" in analysis
    assert "is_too_dark" in analysis


def test_enhance_photo(sample_image_bytes):
    """Test auto-contrast & color enhancement pipeline."""
    enhanced = image_service.enhance_photo(sample_image_bytes)
    assert len(enhanced) > 0
    # Verify it opens as valid JPEG
    out_img = Image.open(io.BytesIO(enhanced))
    assert out_img.size == (400, 400)


def test_create_aspect_ratio_variant(sample_image_bytes):
    """Test 1:1 and 4:5 variant creation."""
    var_1x1 = image_service.create_aspect_ratio_variant(sample_image_bytes, "1:1")
    img_1x1 = Image.open(io.BytesIO(var_1x1))
    assert img_1x1.size[0] == img_1x1.size[1]

    var_4x5 = image_service.create_aspect_ratio_variant(sample_image_bytes, "4:5")
    img_4x5 = Image.open(io.BytesIO(var_4x5))
    assert img_4x5.size[1] > img_4x5.size[0]


def test_create_detail_crop(sample_image_bytes):
    """Test the zoomed detail-shot crop preserves the original canvas size."""
    detail = image_service.create_detail_crop(sample_image_bytes)
    out_img = Image.open(io.BytesIO(detail))
    assert out_img.size == (400, 400)


def test_create_detail_crop_actually_zooms_in():
    """Test the detail crop centers on a smaller region than the full photo,
    by checking a distinctive corner marker is cropped out of the result."""
    img = Image.new("RGB", (400, 400), color=(220, 120, 80))
    # Paint a small, distinctly-colored marker in the extreme corner —
    # a true center-zoom crop should not include it.
    for x in range(0, 20):
        for y in range(0, 20):
            img.putpixel((x, y), (0, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    detail = image_service.create_detail_crop(buf.getvalue(), zoom=0.5)
    out_img = Image.open(io.BytesIO(detail)).convert("RGB")
    corner_pixel = out_img.getpixel((2, 2))
    # JPEG re-encoding can shift colors slightly; just confirm it's no longer
    # anywhere near pure green, i.e. the corner marker was cropped away.
    assert corner_pixel[1] < 200 or corner_pixel[0] > 50
