#!/usr/bin/env python3
"""Renders the share card (assets/og-image.png) and PNG icons from assets/logo.svg.

Needs Pillow, fontTools with brotli (to read the site's .woff2 font) and rsvg-convert:

    python3 scripts/make-images.py
"""

import io
import subprocess
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONTS = ASSETS / "fonts"

PAPER = (245, 243, 238)
CARD = (251, 250, 247)
INK = (21, 23, 28)
INK_2 = (61, 66, 77)
INK_3 = (93, 98, 108)
RULE = (217, 213, 202)
GRID = (231, 228, 220)
ACCENT = (31, 79, 209)
STRIKE = (163, 54, 11)
STRIKE_WASH = (251, 229, 216)


def woff2_font(name, size, tmp):
    """Pillow can't read .woff2, so convert the site's font file to .ttf first."""
    out = Path(tmp) / (name + ".ttf")
    if not out.exists():
        font = TTFont(FONTS / (name + ".woff2"))
        font.flavor = None
        font.save(out)
    return ImageFont.truetype(str(out), size)


def logo_png(size):
    png = subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(ASSETS / "logo.svg")],
        check=True, capture_output=True,
    ).stdout
    return Image.open(io.BytesIO(png)).convert("RGBA")


def mono(size):
    for path in ("/System/Library/Fonts/SFNSMono.ttf", "/System/Library/Fonts/Menlo.ttc",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def og_image(tmp):
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(img)

    # Ruled grid, fading out to the left.
    for x in range(0, w, 48):
        fade = min(1, x / w * 1.6)
        c = tuple(round(PAPER[i] + (GRID[i] - PAPER[i]) * fade) for i in range(3))
        d.line([(x, 0), (x, h)], fill=c)
    for y in range(0, h, 48):
        d.line([(int(w * 0.25), y), (w, y)], fill=GRID)

    pad = 80
    img.paste(logo_png(56), (pad, 64), logo_png(56))
    serif = woff2_font("charis-sil-latin-400-normal", 40, tmp)
    d.text((pad + 72, 70), "Linkumori", font=serif, fill=INK)

    d.line([(pad, 176), (pad + 36, 176)], fill=ACCENT, width=2)
    d.text((pad + 50, 166), "URL PRIVACY FOR FIREFOX", font=mono(20), fill=INK_3)

    big = woff2_font("charis-sil-latin-400-normal", 92, tmp)
    big_i = woff2_font("charis-sil-latin-400-italic", 92, tmp)
    d.text((pad - 4, 206), "Links, without", font=big, fill=INK)
    d.text((pad - 4, 304), "the tracking.", font=big_i, fill=ACCENT)

    # URL strip with the tracking parameter struck out.
    top = 456
    d.rounded_rectangle([pad, top, w - pad, top + 92], radius=12, fill=CARD, outline=RULE, width=2)
    f = mono(26)
    x, y = pad + 28, top + 31
    for text, tracked in (("https://news.example/story/42", False), ("?utm_source=email", True),
                          ("&fbclid=IwAR", True)):
        tw = d.textlength(text, font=f)
        if tracked:
            d.rounded_rectangle([x - 2, y - 6, x + tw + 2, y + 32], radius=4, fill=STRIKE_WASH)
            d.text((x, y), text, font=f, fill=STRIKE)
            d.line([(x, y + 15), (x + tw, y + 15)], fill=STRIKE, width=3)
        else:
            d.text((x, y), text, font=f, fill=INK)
        x += tw

    d.text((pad, 578), "Open source · No telemetry · CLN 1.0 rule standard", font=mono(20), fill=INK_2)
    img.save(ASSETS / "og-image.png", optimize=True)


def icons():
    logo_png(32).save(ASSETS / "icon-32.png", optimize=True)
    # iOS shows transparency as black, so the touch icon gets the page background.
    touch = Image.new("RGBA", (180, 180), PAPER + (255,))
    mark = logo_png(144)
    touch.paste(mark, (18, 18), mark)
    touch.convert("RGB").save(ASSETS / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        og_image(tmp)
    icons()
    for name in ("og-image.png", "icon-32.png", "apple-touch-icon.png"):
        print(name, (ASSETS / name).stat().st_size, "bytes")
