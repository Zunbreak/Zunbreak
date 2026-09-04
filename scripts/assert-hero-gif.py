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
    if re.search(r'src=["\']\./assets/zunbreak-activity\.svg["\']', readme):
        fail("README still shows the activity dashboard; it should not be on the profile.")

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
    delay_ms = image.info.get("duration") or 80
    seconds = frames * delay_ms / 1000
    if seconds < 18:
        fail(
            f"Hero GIF is {seconds:.1f}s; expected a ~20s slow loop so the restart is not obvious."
        )
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

    def frame(index: int):
        image.seek(index)
        return image.convert("RGB")

    def mean_abs_diff(first, second, box):
        a = first.crop(box)
        b = second.crop(box)
        pixels_a, pixels_b = a.load(), b.load()
        width_, height_ = a.size
        total = 0
        for y in range(height_):
            for x in range(width_):
                ca, cb = pixels_a[x, y], pixels_b[x, y]
                total += abs(ca[0] - cb[0]) + abs(ca[1] - cb[1]) + abs(ca[2] - cb[2])
        return total / (width_ * height_ * 3)

    signal = (360, 180, 840, 360)
    step = mean_abs_diff(frame(0), frame(1), signal)
    seam = mean_abs_diff(frame(frames - 1), frame(0), signal)
    ratio = seam / max(step, 1e-6)
    if ratio > 1.45:
        fail(
            f"GIF loop seam is visible in the signal field "
            f"(last-to-first {seam:.3f} vs frame step {step:.3f}, ratio {ratio:.2f})."
        )

    print(
        f"OK: README uses lab GIF ({width}x{height}, {frames} frames); "
        f"right-side gold {gold_ratio:.4f}; loop seam ratio {ratio:.2f}."
    )


if __name__ == "__main__":
    main()
