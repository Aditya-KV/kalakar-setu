"""
Kalakar Setu — Virtual Product Studio: Mask Refinement
Raw rembg output is usually a reasonable silhouette but a mediocre catalog
edge: stray specks, small holes in thin/woven areas, a hard jagged boundary,
and background-color spill bleeding into the object's edge pixels. Every
function here only touches the mask *boundary* — never the whole mask or
the product's interior — so fine craft detail (embroidery, weave, jewellery
chain links) is preserved rather than smoothed away.
"""

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _odd(n: int) -> int:
    n = max(1, int(n))
    return n if n % 2 == 1 else n + 1


def remove_small_blobs(binary: np.ndarray, min_area_ratio: float) -> np.ndarray:
    """Drops disconnected specks smaller than min_area_ratio of the image
    area. Keeps every component above that threshold (not just the single
    largest) — a product can legitimately be two disconnected pieces, e.g.
    a pair of earrings photographed together."""
    h, w = binary.shape
    min_area = max(1, int(h * w * min_area_ratio))

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    cleaned = np.zeros_like(binary)
    for label in range(1, num_labels):  # label 0 is background
        if stats[label, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == label] = 255
    return cleaned


def fill_holes(binary: np.ndarray) -> np.ndarray:
    """Fills small enclosed background holes inside the product silhouette
    (common in woven baskets, chain jewellery, pierced pottery handles)
    using the standard flood-fill-from-border trick."""
    h, w = binary.shape
    flood = binary.copy()
    ff_mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff_mask, (0, 0), 255)
    flood_inv = cv2.bitwise_not(flood)
    return binary | flood_inv


def feather_edges(mask: np.ndarray, radius: int) -> np.ndarray:
    """Softens only the boundary band of the mask (within ~2x radius of the
    silhouette edge) with a Gaussian blur, leaving the interior at full
    opacity and the exterior at zero — avoids both a hard cutout look and
    a whole-mask blur that would fuzz the product itself."""
    binary = (mask > 127).astype(np.uint8) * 255
    blurred = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigmaX=radius)

    dist_fg = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    dist_bg = cv2.distanceTransform(255 - binary, cv2.DIST_L2, 5)
    dist_to_edge = np.minimum(dist_fg, dist_bg)

    band = dist_to_edge <= (radius * 2)
    result = mask.astype(np.float32).copy()
    result[band] = blurred[band]
    return np.clip(result, 0, 255).astype(np.uint8)


def refine_alpha_mask(mask: np.ndarray, min_area_ratio: float = 0.002, feather_radius: int = 3) -> np.ndarray:
    """Full mask-cleanup pass: binarize -> remove specks -> close/open ->
    fill holes -> feather boundary. Returns a refined uint8 alpha mask."""
    h, w = mask.shape
    binary = (mask > 127).astype(np.uint8) * 255

    binary = remove_small_blobs(binary, min_area_ratio)

    kernel_size = _odd(min(h, w) * 0.004)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    binary = fill_holes(binary)

    refined = feather_edges(binary, feather_radius)
    return refined


def decontaminate_edges(rgb: np.ndarray, alpha: np.ndarray, band_px: int = 6) -> np.ndarray:
    """Reduces background-color spill/fringing on semi-transparent boundary
    pixels. Works for an arbitrary original background (not just white) by
    estimating each boundary pixel's "true" foreground color from a local,
    confidence-weighted average of nearby fully-opaque foreground pixels
    only — background-influenced pixels are excluded from that estimate, so
    they can't keep contaminating each other."""
    alpha_f = alpha.astype(np.float32) / 255.0
    core_fg = (alpha_f > 0.92).astype(np.float32)

    if core_fg.sum() < 10:
        # Not enough confidently-foreground pixels to estimate from —
        # skip decontamination rather than risk corrupting real colors.
        return rgb

    sigma = max(3, band_px)
    rgb_f = rgb.astype(np.float32)
    masked_rgb = rgb_f * core_fg[..., None]
    numerator = cv2.GaussianBlur(masked_rgb, (0, 0), sigmaX=sigma)
    denominator = cv2.GaussianBlur(core_fg, (0, 0), sigmaX=sigma)
    fg_estimate = numerator / np.clip(denominator, 1e-4, None)[..., None]

    # A pixel's global core_fg.sum() check above only guards against an
    # image with almost no confident foreground anywhere. A thin structure
    # (e.g. a twisted plastic packet top) can still have essentially zero
    # confident foreground in its own *local* neighborhood even when the
    # image overall has plenty — dividing by that near-zero local
    # denominator produces a meaningless fg_estimate there. Gate the
    # correction on local confidence too, so those pixels are left
    # untouched instead of getting corrupted into a gray smear.
    min_local_confidence = 0.08
    locally_confident = denominator > min_local_confidence

    boundary = (alpha_f > 0.05) & (alpha_f < 0.92) & locally_confident
    correction = np.zeros_like(alpha_f)
    correction[boundary] = (0.92 - alpha_f[boundary]) / 0.92
    correction3 = correction[..., None]

    out = rgb_f * (1 - correction3) + fg_estimate * correction3
    return np.clip(out, 0, 255).astype(np.uint8)
