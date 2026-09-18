#!/usr/bin/env python3
"""Crop the supplied India outline (no slide text) and tint to design-system colours."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import INDIA_MAP, INDIA_MAP_SOURCE, MAN, ROOT

SRC = Path(
    "/Users/mukulkishore/.cursor/projects/Users-mukulkishore-Desktop-Projects-oorjaman-flagship/assets/image-9a09909c-f335-4166-8675-dfc13614797d.png"
)


def main() -> None:
    src = INDIA_MAP_SOURCE if INDIA_MAP_SOURCE.exists() else SRC
    if not src.exists():
        raise FileNotFoundError(src)
    ROOT.joinpath("assets").mkdir(parents=True, exist_ok=True)
    if src != INDIA_MAP_SOURCE:
        shutil.copy(src, INDIA_MAP_SOURCE)

    im = Image.open(src).convert("RGB")
    # Map lives on the left; a white gutter starts ~x=506.
    crop = im.crop((48, 8, 500, 528))
    arr = np.asarray(crop).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    out = np.zeros((crop.height, crop.width, 4), dtype=np.uint8)
    # White slide canvas → transparent
    white = luma >= 250
    # State fill (light grey)
    fill = (luma >= 200) & ~white
    # Borders
    line = ~white & ~fill
    # Slightly stronger than PRIMARY_LIGHT so states read on the product canvas.
    fill_rgb = (186, 220, 206)
    out[fill, :3] = fill_rgb
    out[fill, 3] = 255
    out[line, :3] = MAN
    out[line, 3] = 255
    rgba = Image.fromarray(out, "RGBA")
    # 3× for sharpness when placed ~700px tall
    w, h = rgba.size
    rgba = rgba.resize((w * 3, h * 3), Image.Resampling.LANCZOS)
    rgba = rgba.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    rgba.save(INDIA_MAP)
    print("Wrote", INDIA_MAP, rgba.size)


if __name__ == "__main__":
    main()
