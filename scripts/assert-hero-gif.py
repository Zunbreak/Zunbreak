"""Fail unless the profile hero is the lab-rendered animated GIF."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
GIF = ROOT / "assets" / "zunbreak-hero.gif"
SETTINGS = ROOT / "assets" / "zunbreak-profile-settings.json"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def main() -> None:
    readme = README.read_text(encoding="utf-8")
    if re.search(r'src=["\']\./assets/zunbreak-hero\.svg["\']', readme):
        fail("README still displays the static SVG hero instead of the lab GIF.")
    if not re.search(r'src=["\']\./assets/zunbreak-hero\.gif["\']', readme):
        fail("README must display ./assets/zunbreak-hero.gif.")
    if not re.search(r'src=["\']\./assets/zunbreak-activity\.svg["\']', readme):
        fail("README must keep the activity field as a separate SVG.")

    if not SETTINGS.is_file():
        fail("Lab settings JSON is missing: assets/zunbreak-profile-settings.json")
    payload = json.loads(SETTINGS.read_text(encoding="utf-8"))
    if payload.get("schema") != "zunbreak-profile-lab/v1":
        fail("Settings JSON is not a Zunbreak profile lab export.")
    if payload.get("settings", {}).get("titleText", "").upper() != "ZUNBREAK":
        fail("Lab settings must keep the ZUNBREAK title.")
    if payload.get("settings", {}).get("subtitleText", "").strip():
        fail("Lab settings still have subtitle text; the hero should only say ZUNBREAK.")

    if not GIF.is_file():
        fail("Animated hero GIF is missing: assets/zunbreak-hero.gif")

    image = Image.open(GIF)
    if image.format != "GIF":
        fail(f"Hero file is {image.format}, expected GIF.")
    frames = getattr(image, "n_frames", 1)
    if frames < 20:
        fail(f"Hero GIF has {frames} frames; expected a looping lab animation.")
    width, height = image.size
    if width != 1200 or height != 400:
        fail(f"Hero GIF is {width}x{height}; expected 1200x400.")

    image.seek(0)
    rgb = image.convert("RGB")
    right = rgb.crop((int(width * 0.72), int(height * 0.08), int(width * 0.98), int(height * 0.92)))
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
        fail(f"Hero GIF is missing the daemon/gold signal ({gold_ratio:.5f}).")

    print(
        f"OK: README uses lab GIF ({width}x{height}, {frames} frames); "
        f"right-side gold {gold_ratio:.4f}; activity SVG kept separate."
    )


if __name__ == "__main__":
    main()
