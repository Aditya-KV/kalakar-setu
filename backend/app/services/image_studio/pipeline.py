"""
Kalakar Setu — Virtual Product Studio: Pipeline (Phase 1-5)
Orchestrates: normalize -> segment -> refine mask -> decontaminate edges ->
white balance / exposure / subject enhancement -> studio light -> contact
shadow + composite -> detail enhancement/denoise -> export.

Phase 6 (frontend before/after UI) and Phase 7 (performance tuning) are the
remaining phases — see image_studio/config.py for tunable parameters.
"""

import logging
import time
from dataclasses import dataclass, field
from io import BytesIO

import numpy as np
from PIL import Image, ImageOps

from app.services.image_studio.config import StudioConfig, BACKGROUND_PRESETS, MAX_WORKING_DIMENSION
from app.services.image_studio.segmentation import segment_product
from app.services.image_studio.mask_refinement import refine_alpha_mask, decontaminate_edges
from app.services.image_studio.composition import calculate_product_bounds, create_studio_canvas, place_product, compute_placement
from app.services.image_studio.lighting import correct_white_balance, correct_exposure, enhance_subject
from app.services.image_studio.studio_light import apply_studio_light
from app.services.image_studio.shadow import create_contact_shadow
from app.services.image_studio.export import finalize_composite, make_thumbnail

logger = logging.getLogger(__name__)


@dataclass
class StudioResult:
    normalized: Image.Image           # working-resolution RGB original (EXIF-corrected)
    mask_raw: np.ndarray               # raw rembg alpha mask
    mask_refined: np.ndarray           # cleaned alpha mask
    transparent: Image.Image           # RGBA cutout, edge-decontaminated
    studio_images: dict[str, Image.Image] = field(default_factory=dict)  # preset name -> square (canvas_size) RGB image
    portrait_image: Image.Image | None = None   # portrait (4:5) RGB image, config.background only
    thumbnail: Image.Image | None = None
    timings_ms: dict[str, float] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def load_and_normalize(image_bytes: bytes, max_dimension: int = MAX_WORKING_DIMENSION) -> Image.Image:
    """Decodes an uploaded photo (JPEG/PNG/WEBP), applies EXIF orientation,
    converts to RGB, and downscales if it exceeds max_dimension on its
    longest edge — bounds memory/CPU use for large phone-camera photos
    while keeping enough resolution for a professional export."""
    image = Image.open(BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")

    w, h = image.size
    longest = max(w, h)
    if longest > max_dimension:
        scale = max_dimension / longest
        image = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

    return image


class StudioEnhancementPipeline:
    """Runs the deterministic virtual-studio pipeline on a single photo."""

    def __init__(self, config: StudioConfig | None = None):
        self.config = config or StudioConfig()

    def run(
        self,
        image_bytes: bytes,
        backgrounds: list[str] | None = None,
        apply_lighting: bool = True,
        apply_shadow: bool = True,
        apply_detail: bool = True,
    ) -> StudioResult:
        """Runs the studio pipeline and returns a transparent cutout, one
        composited square image per requested background preset (defaults
        to all three presets), and one portrait composite.

        apply_lighting=False skips white balance / exposure / subject
        enhancement / studio light. apply_shadow=False skips the contact
        shadow. apply_detail=False skips post-composite denoise/sharpen.
        Segmentation, mask refinement, edge decontamination, smart crop,
        and canvas placement always run regardless — those three flags
        exist so a caller can run in a stripped-down "background change and
        masking only" mode (see app/api/routes/media.py) without touching
        any of this module's code, e.g. to cut peak memory on a
        resource-constrained host."""
        backgrounds = backgrounds or list(BACKGROUND_PRESETS.keys())
        timings: dict[str, float] = {}
        warnings: list[str] = []

        t0 = time.perf_counter()
        normalized = load_and_normalize(image_bytes)
        timings["load"] = self._ms(t0)

        t0 = time.perf_counter()
        try:
            mask_raw = segment_product(normalized)
        except Exception as e:
            logger.error(f"[Studio] Segmentation failed: {e}")
            raise
        timings["segmentation"] = self._ms(t0)

        t0 = time.perf_counter()
        mask_refined = refine_alpha_mask(
            mask_raw,
            min_area_ratio=self.config.min_blob_area_ratio,
            feather_radius=self.config.feather_radius_px,
        )
        timings["mask_refinement"] = self._ms(t0)

        coverage_ratio = float((mask_refined > 127).sum()) / mask_refined.size
        if coverage_ratio < 0.02:
            warnings.append("The product takes up very little of the photo — move closer for a better result.")
        elif coverage_ratio > 0.95:
            warnings.append("Almost the entire photo was detected as the product — check the segmentation result.")

        # A single reused name from here on, not a new one per stage — each
        # stage's predecessor array is dropped (and freed immediately by
        # CPython's refcounting) as soon as the next stage's output replaces
        # it, instead of all six full-resolution copies staying alive at
        # once until the function returns. Real memory savings, confirmed
        # necessary after production OOM kills on Railway.
        t0 = time.perf_counter()
        rgb = decontaminate_edges(
            np.array(normalized), mask_refined, band_px=self.config.edge_decontaminate_band_px
        )
        timings["edge_decontamination"] = self._ms(t0)

        if apply_lighting:
            t0 = time.perf_counter()
            rgb = correct_white_balance(rgb, mask_refined, strength=self.config.white_balance_strength)
            rgb = correct_exposure(rgb, mask_refined, strength=self.config.exposure_strength)
            rgb = enhance_subject(
                rgb, mask_refined,
                saturation_strength=self.config.saturation_strength,
                contrast_strength=self.config.contrast_strength,
            )
            timings["lighting"] = self._ms(t0)

            t0 = time.perf_counter()
            rgb = apply_studio_light(
                rgb, mask_refined,
                strength=self.config.studio_light_strength,
                direction=self.config.studio_light_direction,
                fill_strength=self.config.fill_light_strength,
            )
            timings["studio_light"] = self._ms(t0)

        transparent = Image.fromarray(rgb, mode="RGB").convert("RGBA")
        transparent.putalpha(Image.fromarray(mask_refined, mode="L"))
        del rgb

        t0 = time.perf_counter()
        bounds = calculate_product_bounds(mask_refined)
        x, y, bw, bh = bounds
        mask_crop = mask_refined[y:y + bh, x:x + bw]

        studio_images: dict[str, Image.Image] = {}
        for preset_name in backgrounds:
            bg_rgb = BACKGROUND_PRESETS.get(preset_name, BACKGROUND_PRESETS["WARM_WHITE"])
            studio_images[preset_name] = self._composite(
                self.config.canvas_size, self.config.canvas_size, bg_rgb, transparent, bounds, mask_crop,
                apply_shadow=apply_shadow, apply_detail=apply_detail,
            )
        timings["composition"] = self._ms(t0)

        t0 = time.perf_counter()
        portrait_bg = BACKGROUND_PRESETS.get(self.config.background, BACKGROUND_PRESETS["WARM_WHITE"])
        portrait_w, portrait_h = self.config.portrait_size
        portrait_image = self._composite(
            portrait_w, portrait_h, portrait_bg, transparent, bounds, mask_crop,
            apply_shadow=apply_shadow, apply_detail=apply_detail,
        )
        timings["portrait_composition"] = self._ms(t0)

        t0 = time.perf_counter()
        thumbnail = make_thumbnail(
            studio_images.get(self.config.background) or next(iter(studio_images.values())),
            size=self.config.thumbnail_size,
        )
        timings["thumbnail"] = self._ms(t0)

        timings["total"] = sum(timings.values())
        for stage, duration in timings.items():
            logger.info(f"[Studio] {stage}: {duration:.0f}ms")

        return StudioResult(
            normalized=normalized,
            mask_raw=mask_raw,
            mask_refined=mask_refined,
            transparent=transparent,
            studio_images=studio_images,
            portrait_image=portrait_image,
            thumbnail=thumbnail,
            timings_ms=timings,
            warnings=warnings,
        )

    def _composite(
        self,
        canvas_w: int,
        canvas_h: int,
        bg_rgb: tuple[int, int, int],
        transparent: Image.Image,
        bounds: tuple[int, int, int, int],
        mask_crop: np.ndarray,
        apply_shadow: bool = True,
        apply_detail: bool = True,
    ) -> Image.Image:
        """Builds one canvas at the given size/background: studio canvas ->
        (optional) contact shadow -> product placement -> (optional) detail
        enhancement/denoise. Both extras are skippable — each is a real
        memory/CPU cost (shadow: a canvas-sized blurred layer; detail:
        OpenCV denoising, one of the heaviest single steps in the whole
        pipeline) that a resource-constrained host may not be able to
        afford alongside everything else, even though the code itself
        stays intact for when it can."""
        canvas = create_studio_canvas(canvas_w, canvas_h, bg_rgb)

        if apply_shadow:
            new_w, new_h, paste_x, paste_y = compute_placement(canvas_w, canvas_h, bounds, self.config.subject_coverage)
            shadow_layer = create_contact_shadow(
                mask_crop, (canvas_w, canvas_h), (paste_x, paste_y, new_w, new_h),
                opacity=self.config.shadow_opacity, blur_radius=self.config.shadow_blur,
                vertical_offset=self.config.shadow_offset_px,
            )
            canvas = canvas.convert("RGBA")
            canvas.alpha_composite(shadow_layer)
            canvas = canvas.convert("RGB")

        composited = place_product(canvas, transparent, bounds, self.config.subject_coverage)

        if not apply_detail:
            return composited

        finalized_array = finalize_composite(
            np.array(composited), sharpening_strength=self.config.sharpening_strength,
            denoise_enabled=self.config.denoise_if_noisy,
        )
        return Image.fromarray(finalized_array, mode="RGB")

    @staticmethod
    def _ms(t0: float) -> float:
        return (time.perf_counter() - t0) * 1000.0
