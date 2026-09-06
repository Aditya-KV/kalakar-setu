"""
Kalakar Setu — Virtual Product Studio: Detail Enhancement, Denoise & Export
Final per-composite passes (conservative denoising, controlled sharpening,
a safety tone pass) plus multi-format encoding — studio JPEGs, a
transparent PNG cutout, and a thumbnail.
"""

import io

import cv2
import numpy as np
from PIL import Image


def estimate_noise(gray: np.ndarray) -> float:
    """Rough noise estimate via a Gaussian-blur residual — used only to
    decide whether denoising is worth doing, not as a quality score."""
    blurred = cv2.GaussianBlur(gray, (0, 0), sigmaX=1.0)
    residual = gray.astype(np.float32) - blurred.astype(np.float32)
    return float(np.std(residual))


def sharpen(rgb: np.ndarray, strength: float = 0.12) -> np.ndarray:
    """Unsharp mask with a radius adapted to resolution — a small, controlled
    amount of sharpening, never strong enough to create edge halos or an
    oversharpened look."""
    h, w = rgb.shape[:2]
    radius = max(1.0, min(w, h) / 1200.0)
    blurred = cv2.GaussianBlur(rgb, (0, 0), sigmaX=radius)
    sharpened = cv2.addWeighted(rgb, 1 + strength, blurred, -strength, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def denoise_if_needed(rgb: np.ndarray, threshold: float = 4.0) -> np.ndarray:
    """Applies light denoising only when the image actually looks noisy —
    skipped entirely on a clean photo so fine handcrafted texture (weave,
    grain, embroidery) is never smeared away for no reason."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    if estimate_noise(gray) < threshold:
        return rgb
    return cv2.fastNlMeansDenoisingColored(rgb, None, h=3, hColor=3, templateWindowSize=7, searchWindowSize=21)


def final_tone_adjustment(rgb: np.ndarray) -> np.ndarray:
    """Conservative safety pass — guards against anything earlier stages
    might have let slip past 0-255, rather than an independent creative
    grade of its own."""
    return np.clip(rgb, 0, 255).astype(np.uint8)


def finalize_composite(rgb: np.ndarray, sharpening_strength: float = 0.12, denoise_enabled: bool = True) -> np.ndarray:
    """Runs the post-composite pass in order: denoise (if needed) -> sharpen -> tone safety clip."""
    result = denoise_if_needed(rgb) if denoise_enabled else rgb
    result = sharpen(result, sharpening_strength)
    return final_tone_adjustment(result)


def encode_jpeg(image: Image.Image, quality: int = 92) -> bytes:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def encode_png(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def make_thumbnail(image: Image.Image, size: tuple[int, int] = (600, 600), pad_color: tuple[int, int, int] = (250, 249, 246)) -> Image.Image:
    """Downscales to fit within `size` and pads to exactly `size` on a
    matching-tone canvas so thumbnails are uniform regardless of the source
    image's aspect ratio."""
    thumb = image.convert("RGB").copy()
    thumb.thumbnail(size, Image.LANCZOS)
    canvas = Image.new("RGB", size, pad_color)
    offset = ((size[0] - thumb.width) // 2, (size[1] - thumb.height) // 2)
    canvas.paste(thumb, offset)
    return canvas
