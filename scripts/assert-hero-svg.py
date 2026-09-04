"""Fail unless the profile hero is a self-contained SVG GitHub can actually render."""

from __future__ import annotations

import base64
import re
import sys
from pathlib import Path

from PIL import Image
from io import BytesIO

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
HERO = ROOT / "assets" / "zunbreak-hero.svg"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def main() -> None:
    readme = README.read_text(encoding="utf-8")
    if re.search(r'src=["\']\./assets/zunbreak-hero\.png["\']', readme):
        fail("README still displays a flattened PNG instead of a live SVG.")
    if not re.search(r'src=["\']\./assets/zunbreak-hero\.svg["\']', readme):
        fail("README must display ./assets/zunbreak-hero.svg.")
    if not re.search(r'src=["\']\./assets/zunbreak-activity\.svg["\']', readme):
        fail("README must keep the activity field as a separate SVG.")

    svg = HERO.read_text(encoding="utf-8")
    if re.search(r'(?:href|xlink:href)="zunbreak-hero-art\.png"', svg):
        fail("Hero SVG still uses a relative PNG href that GitHub cannot resolve.")
    match = re.search(r'data:image/png;base64,([A-Za-z0-9+/=\s]+)', svg)
    if not match:
        fail("Hero SVG must embed the demon artwork as a PNG data URI.")
    if "<animate" not in svg:
        fail("Hero SVG has no SMIL animation; it should stay a live vector, not a still.")

    payload = re.sub(r"\s+", "", match.group(1))
    image = Image.open(BytesIO(base64.b64decode(payload))).convert("RGB")
    width, height = image.size
    if width < 1000 or height < 300:
        fail(f"Embedded artwork is {width}x{height}; expected the hero art.")

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
        fail(f"Embedded artwork is missing the demon/gold signal ({gold_ratio:.5f}).")

    print(
        f"OK: README uses self-contained SVG; embedded art {width}x{height}; "
        f"right-side gold {gold_ratio:.4f}; SMIL present."
    )


if __name__ == "__main__":
    main()
