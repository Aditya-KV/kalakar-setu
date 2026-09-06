"""
Kalakar Setu — Virtual Product Studio: Foreground Segmentation
Runs rembg fully locally on ONNX Runtime. No network call, no external API.

The ONNX model session is process-wide and created exactly once. rembg's own
`remove()` helper creates a brand new session internally whenever you don't
pass one in — which means reloading the entire model from disk on every
single photo. Under concurrent requests on a memory-constrained host (e.g.
Railway) that's both slow and a real risk of exhausting memory, so this
module caches the session as a singleton instead.
"""

import logging
import threading

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# isnet-general-use tends to produce cleaner edges than the default u2net
# for isolated-object/product photography (vs. u2net's original focus on
# generic salient-object detection) — a better starting point for the mask
# refinement pipeline in mask_refinement.py.
MODEL_NAME = "isnet-general-use"

_session = None
_session_lock = threading.Lock()


def get_session():
    """Returns the cached rembg session for this process, creating it on
    first use. Thread-safe (double-checked locking) so concurrent requests
    arriving during startup don't each trigger their own model load."""
    global _session
    if _session is None:
        with _session_lock:
            if _session is None:
                from rembg import new_session
                logger.info(f"[Studio] Loading segmentation model '{MODEL_NAME}' (first use, cached for process lifetime)...")
                _session = new_session(MODEL_NAME)
                logger.info("[Studio] Segmentation model ready.")
    return _session


def segment_product(image: Image.Image) -> np.ndarray:
    """
    Runs foreground segmentation on an RGB PIL image.
    Returns a uint8 alpha mask (H, W): 0 = background, 255 = foreground.
    Raises RuntimeError if no usable foreground was detected at all, so
    callers can fall back gracefully instead of shipping a blank cutout.
    """
    from rembg import remove

    session = get_session()
    mask_img = remove(image, session=session, only_mask=True)
    mask = np.array(mask_img.convert("L"))

    if mask.max() < 10:
        raise RuntimeError("Segmentation found no usable foreground in this photo.")

    return mask
