"""Flatten hero art onto GitHub README bg with SVG-matched rounded corners (rx=8)."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "assets" / "zunbreak-hero-art.png"
WIDTH = 1200
HEIGHT = 400
GITHUB_BG = (13, 17, 23)
PANEL = {"x": 1, "y": 1, "width": WIDTH - 2, "height": HEIGHT - 2, "radius": 8}
MASK_SCALE = 4


def rounded_mask(size: tuple[int, int], panel: dict[str, int], scale: int) -> Image.Image:
    width, height = size
    mask = Image.new("L", (width * scale, height * scale), 0)
    draw = ImageDraw.Draw(mask)
    x = panel["x"] * scale
    y = panel["y"] * scale
    w = panel["width"] * scale
    h = panel["height"] * scale
    r = panel["radius"] * scale
    draw.rounded_rectangle((x, y, x + w - 1, y + h - 1), radius=r, fill=255)
    return mask.resize(size, Image.Resampling.LANCZOS)


def main() -> int:
    if not ART.is_file():
        print(f"FAIL: missing {ART}", file=sys.stderr)
        return 1

    source = Image.open(ART)
    if source.size != (WIDTH, HEIGHT):
        print(f"FAIL: expected {WIDTH}x{HEIGHT}, got {source.size}", file=sys.stderr)
        return 1

    if source.mode == "RGBA":
        flat = Image.new("RGB", (WIDTH, HEIGHT), GITHUB_BG)
        flat.paste(source, mask=source.split()[3])
        source_rgb = flat
    else:
        source_rgb = source.convert("RGB")

    mask = rounded_mask((WIDTH, HEIGHT), PANEL, MASK_SCALE)
    output = Image.new("RGB", (WIDTH, HEIGHT), GITHUB_BG)
    output.paste(source_rgb, mask=mask)
    output.save(ART)
    print(f"OK: flattened {ART.name} onto GitHub bg with rx={PANEL['radius']} corners.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
