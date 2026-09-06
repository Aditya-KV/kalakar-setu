"""
Kalakar Setu — Virtual Product Studio Configuration
Tunable parameters for the studio pipeline, kept in one place instead of
scattered magic numbers so the look can be adjusted without touching
pipeline logic. Defaults are intentionally conservative — see the "VERY
IMPORTANT QUALITY RULES" in the product spec: the goal is a faithful studio
photo of the real object, not a generated one.
"""

from dataclasses import dataclass, field

# Background presets — name -> (R, G, B). WARM_WHITE is the default: a true
# #FFFFFF background reads as clinical/harsh next to warm handmade materials
# (wood, clay, jute, brass), while a hair of warmth still photographs as
# "white" to a viewer.
BACKGROUND_PRESETS: dict[str, tuple[int, int, int]] = {
    "WHITE": (255, 255, 255),
    "WARM_WHITE": (250, 249, 246),
    "SOFT_OFF_WHITE": (247, 245, 240),
}

DEFAULT_BACKGROUND = "WARM_WHITE"

# Longest-edge cap for the working copy of the image — large phone photos
# (12-108MP sensors) are downscaled to this before any processing to bound
# memory/CPU use. Lowered from 2400 after a production OOM kill on Railway
# during a real enhance request (segmentation + several full-resolution
# float32 intermediate arrays across white balance/exposure/studio-light
# stages, all alive at once, on a memory-constrained instance) — 1600
# still exceeds the final 1600px canvas size, so it costs no visible
# quality, while cutting peak memory for that phase to roughly 44% of what
# 2400 needed (memory scales with the square of the dimension).
MAX_WORKING_DIMENSION = 1600


@dataclass
class StudioConfig:
    # Canvas
    canvas_size: int = 1600           # square canvas edge length, px
    portrait_size: tuple[int, int] = (1600, 2000)
    subject_coverage: float = 0.76    # product occupies ~76% of the canvas's shorter dimension
    background: str = DEFAULT_BACKGROUND

    # Mask refinement
    min_blob_area_ratio: float = 0.002   # blobs smaller than this fraction of image area are discarded
    feather_radius_px: int = 3
    edge_decontaminate_band_px: int = 6

    # Exposure / white balance / color
    exposure_strength: float = 0.30
    white_balance_strength: float = 0.30
    contrast_strength: float = 0.10
    saturation_strength: float = 0.04

    # Studio light simulation
    studio_light_strength: float = 0.08
    studio_light_direction: str = "top"   # "top" | "top-left" | "top-right"
    fill_light_strength: float = 0.04

    # Contact shadow
    shadow_opacity: float = 0.12
    shadow_blur: int = 30
    shadow_offset_px: int = 6

    # Detail
    sharpening_strength: float = 0.12
    denoise_if_noisy: bool = True

    # Export
    jpeg_quality: int = 92
    thumbnail_size: tuple[int, int] = (600, 600)

    def background_rgb(self) -> tuple[int, int, int]:
        return BACKGROUND_PRESETS.get(self.background, BACKGROUND_PRESETS[DEFAULT_BACKGROUND])
