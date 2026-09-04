"""Embed the demon artwork as a data URI so GitHub can render the live SVG."""

from __future__ import annotations

import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "zunbreak-hero.src.svg"
ART = ROOT / "assets" / "zunbreak-hero-art.png"
OUT = ROOT / "assets" / "zunbreak-hero.svg"


def main() -> None:
    uri = "data:image/png;base64," + base64.b64encode(ART.read_bytes()).decode("ascii")
    svg = SRC.read_text(encoding="utf-8")
    svg, count = re.subn(
        r'(href|xlink:href)="zunbreak-hero-art\.png"',
        lambda match: f'{match.group(1)}="{uri}"',
        svg,
    )
    if count < 1 or "data:image/png;base64," not in svg:
        raise SystemExit("embed failed: source SVG has no relative hero art href")
    OUT.write_text(svg, encoding="utf-8", newline="\n")
    print(f"Wrote {OUT.name} ({OUT.stat().st_size} bytes) with {count} embedded hrefs")


if __name__ == "__main__":
    main()
