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
    gif = re.search(r'src=["\']\./assets/zunbreak-hero\.gif(?:\?[^"\']*)?["\']', readme)
    signal = re.search(r'src=["\']\./assets/profile-signal\.svg(?:\?[^"\']*)?["\']', readme)
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
    if re.search(r"totalContributions\s*\+\s*restricted", source):
        fail("Do not add restrictedContributionsCount on top of totalContributions.")
    for banned in ("PRIVATE PUSH", "QUIET", "SURGE", "SIGNAL / 14D", "LATEST SIGNAL", "INCLUDES ANONYMISED PRIVATE CONTRIBUTIONS"):
        if banned in source:
            fail(f"Generator still contains removed terminology: {banned}.")
    if '"STATE"' in source or "calmMax" in source:
        fail("Generator must not keep STATE or CALM/ACTIVE/SURGE thresholds.")

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
    if "<script" in svg.lower():
        fail("SVG must not contain JavaScript.")
    if "graphScan" in svg:
        fail("SVG must not include the graph scan.")
    if "C:\\Zunbreak" not in svg or "Knock, knock." not in svg:
        fail("SVG must include the C:\\Zunbreak terminal knock line.")
    for banned in ("Neo", "NEO", "Matrix", "MATRIX", "rabbit", "C:\\Users"):
        if banned in svg:
            fail(f"SVG must stay subtle; found {banned}.")
    if svg.lower().count("<animate") != 1 or 'attributeName="opacity"' not in svg:
        fail("SVG should keep a single blinking terminal cursor.")
    if 'calcMode="discrete"' not in svg:
        fail("Cursor must snap on/off, not fade.")
    for label in (
        "CONTRIBUTIONS · LAST 14 DAYS",
        "LATEST ACTIVITY",
        "LATEST PUBLIC PUSH",
    ):
        if label not in svg:
            fail(f"SVG is missing {label}.")
    if "INCLUDES ANONYMISED PRIVATE CONTRIBUTIONS" in svg:
        fail("SVG must not show the private-contributions footnote.")
    for banned in ("QUIET", "SURGE", "SIGNAL / 14D", "LATEST SIGNAL", "PRIVATE PUSH"):
        if banned in svg:
            fail(f"SVG still contains removed terminology: {banned}.")
    if re.search(r">STATE<", svg):
        fail("SVG must not show a STATE column.")
    if re.search(r"href=[\"']https?://", svg):
        fail("SVG must not load external assets.")

    value_ys = re.findall(
        r'<text x="(?:36|428|828)" y="(\d+(?:\.\d+)?)" fill="#f4f1e9"',
        svg,
    )
    if len(value_ys) != 3:
        fail(f"Expected three metric values, found {len(value_ys)}: {value_ys}")
    if len(set(value_ys)) != 1:
        fail(f"Contribution, latest activity and latest public push must share one baseline y, got {value_ys}")
    value_sizes = re.findall(
        r'<text x="(?:36|428|828)" y="(?:\d+(?:\.\d+)?)" fill="#f4f1e9" font-size="(\d+(?:\.\d+)?)"',
        svg,
    )
    if len(value_sizes) != 3:
        fail(f"Expected three metric font sizes, found {len(value_sizes)}: {value_sizes}")
    if len(set(value_sizes)) != 1:
        fail(f"Metric values must share one font size, got {value_sizes}")
    if "dateY" in source or "dateSize" in source or "publicSize" in source:
        fail("Generator must use one valueY and one valueSize for all three metric values.")
    if source.count("${CONFIG.type.valueY}") < 3:
        fail("All three metric values must use CONFIG.type.valueY.")
    if source.count("${CONFIG.type.valueSize}") < 3:
        fail("All three metric values must use CONFIG.type.valueSize.")

    public = re.search(
        r'<text x="828" y="(?:\d+(?:\.\d+)?)" fill="#f4f1e9" font-size="(\d+(?:\.\d+)?)">(.*?)</text>',
        svg,
    )
    if not public:
        fail("SVG is missing the latest public push value.")
    public_size = float(public.group(1))
    public_text = (
        public.group(2)
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
    )
    public_right = 828 + len(public_text) * public_size * 0.6
    if public_right > 1164:
        fail(
            f"Latest public push must stay inside the panel, {public_text!r} extends to x={public_right:.0f}."
        )

    print("OK: profile signal SVG, generator CONFIG, workflow and README placement.")


if __name__ == "__main__":
    main()
