"""
Kalakar Setu — Virtual Product Studio: Contact Shadow
A cutout pasted flat onto a plain background reads as fake. This generates
a soft, low-opacity shadow from the product's own silhouette — compressed
and anchored at its base, not a full floating duplicate — to be composited
onto the canvas *before* the product itself, so it reads as the product
resting on a surface rather than a sticker.
"""

import cv2
import numpy as np
from PIL import Image


def create_contact_shadow(
    mask: np.ndarray,
    canvas_size: tuple[int, int],
    paste_box: tuple[int, int, int, int],
    opacity: float = 0.12,
    blur_radius: int = 30,
    vertical_offset: int = 6,
) -> Image.Image:
    """
    mask: the product's alpha mask, cropped to its own bounding box (not yet
          resized to on-canvas size).
    canvas_size: (width, height) of the target studio canvas.
    paste_box: (x, y, width, height) — where the product will be pasted on
               that canvas (from composition.compute_placement).
    Returns an RGBA image the size of the canvas: a black shadow shape with
    varying alpha, ready to be alpha_composite()'d under the product.
    """
    canvas_w, canvas_h = canvas_size
    paste_x, paste_y, paste_w, paste_h = paste_box
    if paste_w <= 0 or paste_h <= 0:
        return Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    mask_resized = cv2.resize(mask, (paste_w, paste_h), interpolation=cv2.INTER_LINEAR)

    # A real contact shadow hugs the ground near the object's base — use
    # only the bottom slice of the silhouette, squashed into a shorter
    # band, rather than mirroring the whole product shape.
    squash_h = max(1, int(paste_h * 0.35))
    base_slice = mask_resized[max(0, paste_h - squash_h):, :]
    squashed = cv2.resize(base_slice, (paste_w, squash_h), interpolation=cv2.INTER_LINEAR)

    shadow_layer = np.zeros((canvas_h, canvas_w), dtype=np.float32)
    shadow_y = paste_y + paste_h - squash_h + vertical_offset
    shadow_y = max(0, min(shadow_y, canvas_h - squash_h)) if canvas_h > squash_h else 0
    shadow_x_end = min(canvas_w, paste_x + paste_w)
    usable_w = max(0, shadow_x_end - paste_x)

    if usable_w > 0:
        shadow_layer[shadow_y: shadow_y + squash_h, paste_x: shadow_x_end] = (
            squashed[:, :usable_w].astype(np.float32) / 255.0
        )

    # Like the studio-light field, the shadow is smooth/low-frequency by
    # construction — blurring it at a downsampled resolution and scaling
    # back up is visually indistinguishable but meaningfully cheaper than a
    # large-sigma Gaussian kernel run at full canvas resolution.
    blur_sigma = max(4, blur_radius)
    downscale = 4
    small_w, small_h = max(1, canvas_w // downscale), max(1, canvas_h // downscale)
    shadow_small = cv2.resize(shadow_layer, (small_w, small_h), interpolation=cv2.INTER_AREA)
    shadow_small_blurred = cv2.GaussianBlur(shadow_small, (0, 0), sigmaX=blur_sigma / downscale)
    shadow_blurred = cv2.resize(shadow_small_blurred, (canvas_w, canvas_h), interpolation=cv2.INTER_LINEAR)
    shadow_alpha = np.clip(shadow_blurred * opacity * 255.0, 0, 255).astype(np.uint8)

    rgba = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
    rgba[..., 3] = shadow_alpha  # pure black shadow, opacity carried entirely in alpha
    return Image.fromarray(rgba, mode="RGBA")
