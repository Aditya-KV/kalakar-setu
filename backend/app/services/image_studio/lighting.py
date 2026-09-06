"""
Kalakar Setu — Virtual Product Studio: Exposure, White Balance & Subject Enhancement
Deterministic corrections only — no generative color/lighting invention.
Every function computes its statistics from the product's own pixels (via
the alpha mask) so a cluttered or oddly-colored background can't skew the
correction, and every correction is blended against the original by a
configurable strength rather than applied at full force — the goal is
removing obvious phone-camera flaws, never recoloring or "improving" the
product's real appearance.
"""

import cv2
import numpy as np


def _lerp(original: np.ndarray, corrected: np.ndarray, strength: float) -> np.ndarray:
    return original.astype(np.float32) * (1 - strength) + corrected.astype(np.float32) * strength


def correct_white_balance(rgb: np.ndarray, mask: np.ndarray, strength: float = 0.30) -> np.ndarray:
    """
    Removes an obvious phone-camera color cast using a percentile-based
    gray-world method, computed only from the product's own pixels so the
    background can't bias the estimate. Gains are clamped to a narrow range
    so a bad estimate can't noticeably recolor the product — this corrects
    a color cast, it does not repaint the item.
    """
    fg = mask > 127
    if fg.sum() < 50:
        return rgb

    rgb_f = rgb.astype(np.float32)
    # The 90th percentile of each channel (over foreground pixels only)
    # approximates "near-white/near-neutral" without being thrown off by a
    # handful of unusually colored pixels the way a full max() would be.
    percentiles = np.array([np.percentile(rgb_f[..., c][fg], 90) for c in range(3)])
    gray_target = max(float(percentiles.mean()), 1e-3)
    gains = gray_target / np.clip(percentiles, 1e-3, None)
    gains = np.clip(gains, 0.75, 1.35)

    corrected = rgb_f * gains
    corrected = np.clip(corrected, 0, 255)
    return np.clip(_lerp(rgb_f, corrected, strength), 0, 255).astype(np.uint8)


def correct_exposure(rgb: np.ndarray, mask: np.ndarray, strength: float = 0.30) -> np.ndarray:
    """
    Corrects overall exposure entirely via LAB's L (luminance) channel —
    shadow lift / highlight compression through a gamma curve centered on
    the product's own average brightness, conservative CLAHE for local
    contrast, and a gentle S-curve. The A/B (color) channels are never
    touched, so hue and saturation — the product's actual color — are
    preserved exactly.
    """
    fg = mask > 127
    if fg.sum() < 50:
        return rgb

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[..., 0].astype(np.float32)

    mean_l = float(L[fg].mean())
    target_l = 130.0
    gamma = 1.0
    if 1 < mean_l < 254:
        gamma = np.log((target_l + 1e-6) / 255.0) / np.log((mean_l + 1e-6) / 255.0)
        gamma = float(np.clip(gamma, 0.65, 1.5))

    L_norm = np.clip(L, 0, 255) / 255.0
    L_gamma = np.power(L_norm, gamma) * 255.0

    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    L_clahe = clahe.apply(np.clip(L_gamma, 0, 255).astype(np.uint8)).astype(np.float32)

    # Gentle S-curve: nudges midtone contrast without crushing blacks or
    # clipping whites (bounded by construction — x in [0,1] stays in [0,1]).
    x = L_clahe / 255.0
    s_amount = 0.12
    x_curved = x + s_amount * (x - 0.5) * (1 - np.abs(2 * x - 1))
    L_final = np.clip(x_curved, 0, 1) * 255.0

    corrected_L = _lerp(L, L_final, strength)
    lab_out = lab.copy()
    lab_out[..., 0] = np.clip(corrected_L, 0, 255).astype(np.uint8)
    return cv2.cvtColor(lab_out, cv2.COLOR_LAB2RGB)


def enhance_subject(rgb: np.ndarray, mask: np.ndarray, saturation_strength: float = 0.04, contrast_strength: float = 0.10) -> np.ndarray:
    """
    Applies a small, deliberately restrained local-contrast and saturation
    lift — blended in only over the product itself via the (already
    feathered) alpha mask, so the effect never touches the studio
    background it will be composited onto and has no visible seam at the
    product's edge.
    """
    fg_ratio = float((mask > 127).sum()) / mask.size
    if fg_ratio < 0.001:
        return rgb

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[..., 0].astype(np.float32)
    blurred_L = cv2.GaussianBlur(L, (0, 0), sigmaX=2.5)
    detail = L - blurred_L
    # contrast_strength ~0.10 by default -> a mild lift, never an oversharpened look.
    L_contrast = np.clip(L + detail * contrast_strength * 3.0, 0, 255)
    lab_contrast = lab.copy()
    lab_contrast[..., 0] = L_contrast.astype(np.uint8)
    contrast_rgb = cv2.cvtColor(lab_contrast, cv2.COLOR_LAB2RGB)

    hsv = cv2.cvtColor(contrast_rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * (1 + saturation_strength), 0, 255)
    result_rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)

    alpha = (mask.astype(np.float32) / 255.0)[..., None]
    out = rgb.astype(np.float32) * (1 - alpha) + result_rgb.astype(np.float32) * alpha
    return np.clip(out, 0, 255).astype(np.uint8)
