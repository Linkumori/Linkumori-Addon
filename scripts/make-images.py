#!/usr/bin/env python3
"""Renders the share card (assets/og-image.png) and PNG icons from assets/logo.svg.

Needs Pillow and rsvg-convert, and uses Helvetica Neue and Menlo from macOS:

    python3 scripts/make-images.py
"""

import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

WHITE = (255, 255, 255)
BG_ALT = (245, 245, 247)
TEXT = (29, 29, 31)
TEXT_2 = (97, 97, 102)
LINE = (232, 232, 237)
STRIKE = (196, 0, 26)
STRIKE_WASH = (255, 241, 242)
BRAND = (37, 99, 235)  # the logo's blue, #2563eb

HELVETICA = "/System/Library/Fonts/HelveticaNeue.ttc"
MENLO = "/System/Library/Fonts/Menlo.ttc"


def sans(size, bold=False, medium=False):
    return ImageFont.truetype(HELVETICA, size, index=1 if bold else 10 if medium else 0)


def logo_png(size):
    png = subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(ASSETS / "logo.svg")],
        check=True, capture_output=True,
    ).stdout
    return Image.open(io.BytesIO(png)).convert("RGBA")


def sparkle(d, cx, top, size, fill):
    """The four-point star from the logo, `size` pixels tall, centred on cx."""
    pts = [(11, 0), (14, 8), (22, 11), (14, 14), (11, 22), (8, 14), (0, 11), (8, 8)]
    k = size / 22
    d.polygon([(cx - size / 2 + x * k, top + y * k) for x, y in pts], fill=fill)


def centered(d, y, text, font, fill, w):
    tw = d.textlength(text, font=font)
    d.text(((w - tw) / 2, y), text, font=font, fill=fill)


def og_image():
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(img)

    mark = logo_png(64)
    name = sans(30, bold=True)
    nw = 64 + 14 + d.textlength("Linkumori", font=name)
    x0 = (w - nw) / 2
    img.paste(mark, (round(x0), 52), mark)
    d.text((x0 + 78, 66), "Linkumori", font=name, fill=TEXT)

    big = sans(92, bold=True)
    centered(d, 150, "Links, without", big, TEXT, w)

    # Second line in the logo's blue, with the logo's sparkle after it.
    line2 = "the tracking."
    tw = d.textlength(line2, font=big)
    spark = 28
    x0 = (w - tw - spark - 4) / 2
    d.text((x0, 252), line2, font=big, fill=BRAND)
    sparkle(d, x0 + tw + 4 + spark / 2, 262, spark, BRAND)

    centered(d, 376, "Tracking parameters removed before the page loads. Nothing collected.", sans(26), TEXT_2, w)

    # Address bar with the tracking part struck out.
    bar_w, bar_h, top = 940, 78, 460
    left = (w - bar_w) // 2
    d.rounded_rectangle([left, top, left + bar_w, top + bar_h], radius=39, fill=BG_ALT, outline=LINE, width=2)
    f = ImageFont.truetype(MENLO, 25)
    parts = (("https://news.example/story/42", False), ("?utm_source=email", True), ("&fbclid=IwAR", True))
    total = sum(d.textlength(t, font=f) for t, _ in parts)
    x, y = left + (bar_w - total) / 2, top + 24
    for text, tracked in parts:
        pw = d.textlength(text, font=f)
        if tracked:
            d.rounded_rectangle([x - 2, y - 5, x + pw + 2, y + 32], radius=6, fill=STRIKE_WASH)
            d.text((x, y), text, font=f, fill=STRIKE)
            d.line([(x, y + 15), (x + pw, y + 15)], fill=STRIKE, width=3)
        else:
            d.text((x, y), text, font=f, fill=TEXT)
        x += pw

    centered(d, 570, "Free and open source  ·  Firefox desktop and Android  ·  CLN 1.0", sans(21, medium=True), TEXT_2, w)
    img.save(ASSETS / "og-image.png", optimize=True)


def icons():
    logo_png(32).save(ASSETS / "icon-32.png", optimize=True)
    # iOS shows transparency as black, so the touch icon gets a white background.
    touch = Image.new("RGBA", (180, 180), WHITE + (255,))
    mark = logo_png(144)
    touch.paste(mark, (18, 18), mark)
    touch.convert("RGB").save(ASSETS / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    og_image()
    icons()
    for name in ("og-image.png", "icon-32.png", "apple-touch-icon.png"):
        print(name, (ASSETS / name).stat().st_size, "bytes")
