"""Fail unless the profile signal SVG is a self-contained, generated instrument panel."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
SVG = ROOT / "assets" / "profile-signal.svg"
GENERATOR = ROOT / "scripts" / "generate-profile-signal.mjs"
WORKFLOW = ROOT / ".github" / "workflows" / "update-profile-signal.yml"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def main() -> None:
    readme = README.read_text(encoding="utf-8")
    gif = re.search(r'src=["\']\./assets/zunbreak-hero\.gif["\']', readme)
    signal = re.search(r'src=["\']\./assets/profile-signal\.svg["\']', readme)
    if not gif:
        fail("README must keep the existing hero GIF.")
    if not signal:
        fail("README must display ./assets/profile-signal.svg under the hero.")
    if gif.start() > signal.start():
        fail("Profile signal SVG must sit under the hero GIF.")
    if re.search(r'src=["\']\./assets/zunbreak-activity\.svg["\']', readme):
        fail("Old four-card activity SVG must stay off the profile.")

    if not GENERATOR.is_file():
        fail("Missing scripts/generate-profile-signal.mjs")
    source = GENERATOR.read_text(encoding="utf-8")
    if "const CONFIG" not in source:
        fail("Generator must keep editable design values in a CONFIG object.")
    if "calmMax" not in source or "activeMax" not in source:
        fail("CONFIG must expose CALM/ACTIVE/SURGE thresholds.")
    if re.search(r"totalContributions\s*\+\s*restricted", source):
        fail("Do not add restrictedContributionsCount on top of totalContributions.")
    if "PRIVATE PUSH" in source:
        fail("Private activity must not be labeled PRIVATE PUSH.")
    if "PRIVATE SIGNAL" not in source and "PRIVATE ACTIVITY" not in source:
        fail("Private activity must be labeled PRIVATE SIGNAL or PRIVATE ACTIVITY.")

    if not WORKFLOW.is_file():
        fail("Missing .github/workflows/update-profile-signal.yml")
    workflow = WORKFLOW.read_text(encoding="utf-8")
    if "workflow_dispatch" not in workflow or "0 */3 * * *" not in workflow:
        fail("Workflow must support manual runs and a three-hour schedule.")
    if "secrets.GITHUB_TOKEN" not in workflow:
        fail("Workflow must use GITHUB_TOKEN only.")

    if not SVG.is_file():
        fail("Missing assets/profile-signal.svg")
    svg = SVG.read_text(encoding="utf-8")
    if 'viewBox="0 0 1200 190"' not in svg:
        fail("SVG must use viewBox 0 0 1200 190.")
    if "<script" in svg.lower() or "<animate" in svg.lower():
        fail("SVG must not contain JavaScript or animation.")
    for label in ("SIGNAL / 14D", "LATEST SIGNAL", "LAST PUBLIC PUSH", "STATE"):
        if label not in svg:
            fail(f"SVG is missing {label}.")
    if "PRIVATE PUSH" in svg:
        fail("SVG must not say PRIVATE PUSH.")
    if "http" in svg and "xmlns" in svg:
        if re.search(r"href=[\"']https?://", svg):
            fail("SVG must not load external assets.")

    print("OK: profile signal SVG, generator CONFIG, workflow and README placement.")


if __name__ == "__main__":
    main()
