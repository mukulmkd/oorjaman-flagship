"""Shared paths and design-system colour for the vision film."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
WORK = ROOT / "work"
OUTPUT = ROOT / "output"
TIMELINE = json.loads((ROOT / "timeline.json").read_text())
FPS = int(TIMELINE["fps"])
W, H = int(TIMELINE["width"]), int(TIMELINE["height"])
LAYOUT_W, LAYOUT_H = 1920, 1080
SCALE = W / LAYOUT_W

# From design-system / packages/config — light product canvas, not cinematic black
BG = (255, 255, 255)  # surface white
CANVAS = (246, 250, 249)  # colors.background
INK = (15, 41, 56)  # colors.foreground #0f2938
MUTED = (81, 106, 123)  # colors.mutedForeground #516a7b
PRIMARY = (31, 134, 96)  # colors.primary #1f8660
PRIMARY_DARK = (26, 115, 79)  # #1a734f
PRIMARY_LIGHT = (216, 238, 228)  # #d8eee4
OORJA = (84, 144, 72)  # brandColors.oorja
MAN = (28, 66, 118)  # brandColors.man
ACCENT = (159, 201, 60)  # colors.accent
LINE = (197, 217, 212)  # colors.border #c5d9d4
CARD = (255, 255, 255)
ELEVATED = (240, 247, 245)  # #f0f7f5
DANGER = (220, 38, 38)  # colors.error #dc2626
INVERSE = (255, 255, 255)

LOGO = REPO / "design-system" / "assets" / "logo" / "logo-icon-1024.png"
FONTS = ROOT / "assets" / "fonts"
INDIA_MAP = ROOT / "assets" / "india-map.png"
INDIA_MAP_SOURCE = ROOT / "assets" / "india-map-source.png"


def total_duration() -> float:
    last = TIMELINE["scenes"][-1]
    return float(last["start"]) + float(last["duration"])


def scene_by_id(sid: str) -> dict:
    for s in TIMELINE["scenes"]:
        if s["id"] == sid:
            return s
    raise KeyError(sid)


def load_dotenv() -> None:
    """Load scripts/future-film/.env without overriding real environment vars."""
    path = ROOT / ".env"
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "'\"":
            val = val[1:-1]
        if key and key not in os.environ:
            os.environ[key] = val


load_dotenv()
