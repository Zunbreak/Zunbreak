"""Flatten hero artwork, signal field and typography into one high-res PNG."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "assets" / "zunbreak-hero-art.png"
OUT = ROOT / "assets" / "zunbreak-hero.png"
FONTS = Path(r"C:\Windows\Fonts")

SCALE = 3
W, H = 1200 * SCALE, 400 * SCALE
GRADIENT_WIDTH = 820 * SCALE


def gradient_alpha(t: float) -> int:
    if t <= 0.42:
        opacity = 0.95 + (0.6 - 0.95) * (t / 0.42)
    elif t <= 0.68:
        opacity = 0.6 + (0.0 - 0.6) * ((t - 0.42) / (0.26))
    else:
        opacity = 0.0
    return max(0, min(255, round(opacity * 255)))


def draw_spaced(draw: ImageDraw.ImageDraw, xy, text, font, fill, spacing):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=font) + spacing


def quadratic_points(p0, p1, p2, steps=48):
    points = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
        y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
        points.append((x, y))
    return points


def main():
    canvas = Image.open(ART).convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)

    mask_row = Image.new("L", (GRADIENT_WIDTH, 1))
    mask_row.putdata([gradient_alpha(x / (GRADIENT_WIDTH - 1)) for x in range(GRADIENT_WIDTH)])
    gradient_mask = mask_row.resize((GRADIENT_WIDTH, H), Image.Resampling.BILINEAR)
    shade = Image.new("RGBA", (GRADIENT_WIDTH, H), (5, 7, 10, 255))
    shade.putalpha(gradient_mask)
    canvas.alpha_composite(shade, (0, 0))

    mono = ImageFont.truetype(str(FONTS / "consola.ttf"), 11 * SCALE)
    mono_sm = ImageFont.truetype(str(FONTS / "consola.ttf"), 9 * SCALE)
    mono_sub = ImageFont.truetype(str(FONTS / "consola.ttf"), 12 * SCALE)
    display = ImageFont.truetype(str(FONTS / "ARIALNB.TTF"), 70 * SCALE)

    text_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)
    shadow_draw = ImageDraw.Draw(shadow_layer)

    draw_spaced(text_draw, (58 * SCALE, 55 * SCALE), "> SIGNAL FIELD ENGAGED", mono, (231, 173, 37, 255), 3 * SCALE)
    for y, label in ((79, "> FREQUENCY 44.1 THZ"), (101, "> ORIGIN UNKNOWN"), (123, "> INTENT BUILD WEIRD THINGS")):
        draw_spaced(text_draw, (58 * SCALE, y * SCALE), label, mono_sm, (129, 112, 68, 255), 3 * SCALE)

    title = "ZUNBREAK"
    title_spacing = 11 * SCALE
    draw_spaced(shadow_draw, (54 * SCALE, (225 + 2) * SCALE), title, display, (0, 0, 0, 200), title_spacing)
    draw_spaced(text_draw, (54 * SCALE, 225 * SCALE), title, display, (244, 241, 233, 255), title_spacing)

    subtitle = "CREATIVE TECHNOLOGY / DIGITAL PRODUCTS / STRANGE INTERNET MACHINERY"
    draw_spaced(shadow_draw, (59 * SCALE, (260 + 2) * SCALE), subtitle, mono_sub, (0, 0, 0, 160), 2.4 * SCALE)
    draw_spaced(text_draw, (59 * SCALE, 260 * SCALE), subtitle, mono_sub, (226, 170, 36, 255), 2.4 * SCALE)

    draw_spaced(text_draw, (59 * SCALE, 360 * SCALE), "[ SIGNAL / 01 ]", mono_sm, (119, 104, 63, 255), 3 * SCALE)

    blurred = shadow_layer.filter(ImageFilter.GaussianBlur(radius=4 * SCALE / 2))
    canvas.alpha_composite(blurred)
    canvas.alpha_composite(text_layer)

    rounded = Image.new("L", (W, H), 0)
    ImageDraw.Draw(rounded).rounded_rectangle(
        (1 * SCALE, 1 * SCALE, W - 1 * SCALE - 1, H - 1 * SCALE - 1),
        radius=18 * SCALE,
        fill=255,
    )
    canvas.putalpha(rounded)

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (1 * SCALE, 1 * SCALE, W - 1 * SCALE - 1, H - 1 * SCALE - 1),
        radius=18 * SCALE,
        outline=(52, 58, 67, 255),
        width=2 * SCALE,
    )
    gold = quadratic_points(
        (2 * SCALE, 22 * SCALE),
        (2 * SCALE, 2 * SCALE),
        (22 * SCALE, 2 * SCALE),
    ) + [(1166 * SCALE, 2 * SCALE)]
    draw.line(gold, fill=(225, 165, 26, 191), width=2 * SCALE, joint="curve")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({canvas.size[0]}x{canvas.size[1]})")


if __name__ == "__main__":
    main()
