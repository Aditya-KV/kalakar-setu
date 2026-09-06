"""
Kalakar Setu — Virtual Product Studio local test script.

Lets you tune the image pipeline against a real photo without rebuilding
the Android app or going through the API. Run from the backend/ directory:

    python scripts/test_studio_enhancement.py path/to/input.jpg

Produces, under ./output/:
    original.jpg              — normalized working copy (EXIF-corrected)
    mask.png                  — refined alpha mask (grayscale)
    transparent.png           — RGBA cutout, edge-decontaminated
    studio-white.jpg
    studio-warm-white.jpg
    studio-off-white.jpg
"""

import sys
import time
from pathlib import Path

# Allow running as `python scripts/test_studio_enhancement.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image

from app.services.image_studio.pipeline import StudioEnhancementPipeline


PRESET_TO_FILENAME = {
    "WHITE": "studio-white.jpg",
    "WARM_WHITE": "studio-warm-white.jpg",
    "SOFT_OFF_WHITE": "studio-off-white.jpg",
}


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/test_studio_enhancement.py <input_image>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Input file not found: {input_path}")
        sys.exit(1)

    output_dir = Path(__file__).resolve().parent.parent / "output"
    output_dir.mkdir(exist_ok=True)

    print(f"Processing {input_path} ...")
    image_bytes = input_path.read_bytes()

    t0 = time.perf_counter()
    pipeline = StudioEnhancementPipeline()
    result = pipeline.run(image_bytes)
    elapsed = (time.perf_counter() - t0) * 1000

    result.normalized.save(output_dir / "original.jpg", quality=92)
    Image.fromarray(result.mask_refined, mode="L").save(output_dir / "mask.png")
    result.transparent.save(output_dir / "transparent.png")

    for preset_name, image in result.studio_images.items():
        filename = PRESET_TO_FILENAME.get(preset_name, f"studio-{preset_name.lower()}.jpg")
        image.save(output_dir / filename, quality=92)

    print(f"\nDone in {elapsed:.0f}ms. Output written to: {output_dir}")
    print("Stage timings:", {k: f"{v:.0f}ms" for k, v in result.timings_ms.items()})
    if result.warnings:
        print("Warnings:", result.warnings)


if __name__ == "__main__":
    main()
