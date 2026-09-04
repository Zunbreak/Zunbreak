"""Fail if the profile hero is still an SVG that GitHub cannot resolve."""

from pathlib import Path
import re
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
HERO = ROOT / "assets" / "zunbreak-hero.png"
ART = ROOT / "assets" / "zunbreak-hero-art.png"


def fail(message):
    print(f"FAIL: {message}")
    sys.exit(1)


def main():
    readme = README.read_text(encoding="utf-8")
    if re.search(r'src=["\']\./assets/zunbreak-hero\.svg["\']', readme):
        fail("README still displays the hero as SVG; GitHub cannot load the nested PNG.")
    if not re.search(r'src=["\']\./assets/zunbreak-hero\.png["\']', readme):
        fail("README must display ./assets/zunbreak-hero.png directly.")
    if not re.search(r'src=["\']\./assets/zunbreak-activity\.svg["\']', readme):
        fail("README must keep the activity field as a separate SVG.")

    if not HERO.is_file():
        fail("Flattened hero PNG is missing: assets/zunbreak-hero.png")

    image = Image.open(HERO).convert("RGB")
    width, height = image.size
    if width < 2400 or height < 800:
        fail(f"Hero PNG is {width}x{height}; expected at least 2400x800.")
    ratio = width / height
    if abs(ratio - 3.0) > 0.05:
        fail(f"Hero PNG aspect {ratio:.3f} is not 3:1.")

    art = Image.open(ART).convert("RGB")
    if image.size == art.size:
        fail("Hero PNG is not high-resolution; it matches the 1200x400 source art size.")

    right = image.crop((int(width * 0.72), int(height * 0.08), int(width * 0.98), int(height * 0.92)))
    pixels = right.load()
    gold = 0
    crop_w, crop_h = right.size
    for y in range(crop_h):
        for x in range(crop_w):
            r, g, b = pixels[x, y]
            if r > 140 and g > 90 and b < r * 0.75 and (r + g) > 260:
                gold += 1
    gold_ratio = gold / (crop_w * crop_h)
    if gold_ratio < 0.004:
        fail(
            f"Right side of hero PNG has almost no gold signal ({gold_ratio:.5f}); "
            "the demon/artwork is missing."
        )

    print(
        f"OK: README uses flattened {width}x{height} PNG; "
        f"right-side gold coverage {gold_ratio:.4f}; activity SVG kept separate."
    )


if __name__ == "__main__":
    main()
