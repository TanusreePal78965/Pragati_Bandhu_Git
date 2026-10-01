"""Build web/public/og-image.png, the 1200x630 link-preview card.

Run from the repo root on macOS: python3 web/scripts/make_og_image.py
Needs Pillow (pip install pillow). Re-run if either app icon changes.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WEB = Path(__file__).resolve().parent.parent
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"

APPS = [
    # icon, name, one-liner, text colour, centre x
    (WEB / "src/assets/icon.png", "ShopAI", "Billing · stock · udhar", "#1a57db", 330),
    (WEB / "src/assets/chukta-icon.png", "Chukta", "Attendance · wages · advances", "#b45309", 870),
]


def rounded_icon(path: Path, size: int, radius: int) -> Image.Image:
    icon = Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    icon.putalpha(mask)
    return icon


def main() -> None:
    card = Image.new("RGB", (1200, 630), "#ffffff")
    draw = ImageDraw.Draw(card)
    title = ImageFont.truetype(BOLD, 64)
    name = ImageFont.truetype(BOLD, 44)
    line = ImageFont.truetype(REGULAR, 30)

    draw.rectangle((0, 0, 1200, 12), fill="#4f46e5")
    draw.text((600, 90), "Pragati Bandhu", font=title, fill="#0f172a", anchor="mm")
    draw.text((600, 150), "Simple apps for small businesses in India", font=line, fill="#64748b", anchor="mm")

    for path, label, sub, color, cx in APPS:
        icon = rounded_icon(path, 200, 44)
        card.paste(icon, (cx - 100, 200), icon)
        draw.text((cx, 450), label, font=name, fill=color, anchor="mm")
        draw.text((cx, 500), sub, font=line, fill="#64748b", anchor="mm")

    draw.text((600, 580), "30-day free trial", font=line, fill="#0f172a", anchor="mm")

    out = WEB / "public/og-image.png"
    card.save(out, optimize=True)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
