"""Build contact sheets for visually reviewing all local product thumbnails."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "assets" / "images" / "products"


def wrapped_lines(
    draw: ImageDraw.ImageDraw,
    label: str,
    font: ImageFont.ImageFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in label.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    records = json.loads((IMAGE_DIR / "sources.json").read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    title_font = ImageFont.load_default(size=20)
    label_font = ImageFont.load_default(size=12)

    for page in range(5):
        sheet = Image.new("RGB", (1400, 980), "#eeeae2")
        draw = ImageDraw.Draw(sheet)
        start = page * 20 + 1
        draw.text(
            (24, 14),
            f"Pore product catalog thumbnails {start} to {start + 19}",
            fill="#29271f",
            font=title_font,
        )
        for local_index, record in enumerate(records[page * 20 : (page + 1) * 20]):
            column = local_index % 5
            row = local_index // 5
            x = 24 + column * 274
            y = 54 + row * 230
            image = Image.open(IMAGE_DIR / record["file"]).convert("RGB")
            image.thumbnail((168, 168), Image.Resampling.LANCZOS)
            draw.rounded_rectangle(
                (x, y, x + 250, y + 210),
                radius=14,
                fill="#ffffff",
                outline="#d9d2c5",
            )
            sheet.paste(image, (x + 41, y + 8))
            index = page * 20 + local_index + 1
            label = f'{index}. {record["brand"]} {record["name"]}'
            for line_index, line in enumerate(
                wrapped_lines(draw, label, label_font, 226)[:2]
            ):
                draw.text(
                    (x + 12, y + 178 + line_index * 14),
                    line,
                    fill="#29271f",
                    font=label_font,
                )
        sheet.save(args.output / f"catalog-{page + 1}.jpg", quality=92)

    print(f"Generated 5 contact sheets from {len(records)} product images")


if __name__ == "__main__":
    main()
