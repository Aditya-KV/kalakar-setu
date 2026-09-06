"""
Kalakar Setu — Virtual Product Studio: Smart Crop & Studio Canvas
Locates the real product within the frame using the refined alpha mask,
then places it — at its original aspect ratio, never stretched — onto a
fresh studio-background canvas with balanced, intentional whitespace.
"""

from PIL import Image
import numpy as np


def calculate_product_bounds(alpha: np.ndarray, threshold: int = 10) -> tuple[int, int, int, int]:
    """Returns the (x, y, width, height) bounding box of non-background
    pixels in the alpha mask. Falls back to the full frame if segmentation
    somehow left nothing above threshold, so callers never crash on it."""
    ys, xs = np.where(alpha > threshold)
    if len(xs) == 0 or len(ys) == 0:
        h, w = alpha.shape
        return (0, 0, w, h)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return (x0, y0, x1 - x0 + 1, y1 - y0 + 1)


def create_studio_canvas(width: int, height: int, bg_rgb: tuple[int, int, int], subtle_gradient: bool = True) -> Image.Image:
    """Creates the studio background. When subtle_gradient is on, adds a
    near-imperceptible vertical luminance falloff (a few levels top-to-
    bottom) reminiscent of photography seamless paper — deliberately far
    too subtle to register as "a gradient" to a viewer."""
    base = np.empty((height, width, 3), dtype=np.float32)
    base[:, :] = bg_rgb
    if subtle_gradient:
        falloff = np.linspace(-2.5, 2.5, height, dtype=np.float32)
        base += falloff[:, None, None]
    base = np.clip(base, 0, 255).astype(np.uint8)
    return Image.fromarray(base, mode="RGB")


def compute_placement(canvas_w: int, canvas_h: int, bounds: tuple[int, int, int, int], subject_coverage: float) -> tuple[int, int, int, int]:
    """Returns (new_width, new_height, paste_x, paste_y) for placing a crop
    of the given bounds, centered, at subject_coverage of the canvas's
    shorter dimension — shared by place_product() and the contact-shadow
    generator so both agree on exactly where the product will land."""
    _, _, bw, bh = bounds
    target_dim = min(canvas_w, canvas_h) * subject_coverage
    scale = target_dim / max(bw, bh)
    new_w, new_h = max(1, round(bw * scale)), max(1, round(bh * scale))
    paste_x = (canvas_w - new_w) // 2
    paste_y = (canvas_h - new_h) // 2
    return new_w, new_h, paste_x, paste_y


def place_product(canvas: Image.Image, cutout_rgba: Image.Image, bounds: tuple[int, int, int, int], subject_coverage: float) -> Image.Image:
    """Crops the cutout to its real bounding box, scales it (preserving
    aspect ratio — never stretched) so its longest side occupies
    subject_coverage of the canvas's shorter dimension, and centers it."""
    x, y, bw, bh = bounds
    product_crop = cutout_rgba.crop((x, y, x + bw, y + bh))

    new_w, new_h, paste_x, paste_y = compute_placement(canvas.width, canvas.height, bounds, subject_coverage)
    resized = product_crop.resize((new_w, new_h), Image.LANCZOS)

    result = canvas.convert("RGBA")
    result.alpha_composite(resized, (paste_x, paste_y))
    return result.convert("RGB")
