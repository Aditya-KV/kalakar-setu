"""
Kalakar Setu — Virtual Product Studio: Studio Light Simulation
A deterministic, purely luminance-based approximation of a large softbox
positioned above/in front of the product. No pixels are generated or
invented — this only nudges the existing luminance of pixels already
inside the product mask, and is deliberately subtle (see StudioConfig
defaults): the goal is "photographed under good studio lighting," not a
visible lighting-effects filter.
"""

import cv2
import numpy as np


def _light_center(direction: str, w: int, h: int) -> tuple[float, float]:
    if direction == "top-left":
        return (w * 0.35, h * 0.15)
    if direction == "top-right":
        return (w * 0.65, h * 0.15)
    return (w * 0.5, h * 0.12)  # "top" (default)


def apply_studio_light(
    rgb: np.ndarray,
    mask: np.ndarray,
    strength: float = 0.08,
    direction: str = "top",
    fill_strength: float = 0.04,
) -> np.ndarray:
    """
    Builds a large, heavily-blurred elliptical luminance field centered
    above the product (as if lit by a big softbox from `direction`), plus a
    small uniform fill-light term that softens the shadow side. Both are
    added to the L (luminance) channel only, and only within the product
    mask — color (A/B channels) and the studio background are untouched.
    """
    fg = mask > 10
    if fg.sum() < 50:
        return rgb

    h, w = mask.shape

    # The light field is smooth and low-frequency by construction, so it's
    # computed and blurred at a small fixed resolution, then upscaled — a
    # full-resolution mgrid plus a Gaussian kernel scaled to the image size
    # (thousands of pixels wide on a large photo) was the single slowest
    # stage in the whole pipeline for no visible quality difference, since
    # nothing here has high-frequency detail to begin with.
    small_dim = 96
    small_w, small_h = (small_dim, max(1, round(small_dim * h / w))) if w >= h else (max(1, round(small_dim * w / h)), small_dim)

    cx, cy = _light_center(direction, small_w, small_h)
    yy, xx = np.mgrid[0:small_h, 0:small_w].astype(np.float32)

    radius = max(small_w, small_h) * 0.9
    dist = np.sqrt(((xx - cx) / radius) ** 2 + ((yy - cy) / (radius * 1.15)) ** 2)
    light_field_small = np.clip(1.0 - dist, 0.0, 1.0)
    light_field_small = cv2.GaussianBlur(light_field_small, (0, 0), sigmaX=max(small_w, small_h) * 0.18)
    light_field = cv2.resize(light_field_small, (w, h), interpolation=cv2.INTER_LINEAR)

    # Zero-mean so the field only redistributes brightness (brighter near
    # the light, slightly darker away from it) rather than shifting the
    # product's overall exposure — that's correct_exposure's job.
    field_zero_mean = light_field - float(light_field.mean())
    field_range = float(np.abs(field_zero_mean).max()) or 1.0
    field_norm = field_zero_mean / field_range  # roughly [-1, 1]

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[..., 0].astype(np.float32)

    mask_f = mask.astype(np.float32) / 255.0
    delta = (field_norm * strength * 60.0 + fill_strength * 40.0) * mask_f

    L_new = np.clip(L + delta, 0, 255)
    lab_out = lab.copy()
    lab_out[..., 0] = L_new.astype(np.uint8)
    return cv2.cvtColor(lab_out, cv2.COLOR_LAB2RGB)
