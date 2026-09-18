#!/usr/bin/env python3
"""SRT from canonical VO (pauses stripped)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUTPUT, TIMELINE


def ts(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def clean(vo: str) -> str:
    parts = re.split(r"\[\[slnc \d+\]\]", vo)
    text = " ".join(p.strip() for p in parts if p.strip())
    return re.sub(r"Oorja\s*Man|Oorjaman|OORJAMAN", "OorjaMan", text, flags=re.I)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    lines = []
    n = 1
    for scene in TIMELINE["scenes"]:
        start = float(scene["start"])
        end = start + float(scene["duration"]) - 0.15
        text = clean(scene["vo"])
        lines.append(str(n))
        lines.append(f"{ts(start + 0.35)} --> {ts(end)}")
        lines.append(text)
        lines.append("")
        n += 1
    path = OUTPUT / "Oorjaman-Future-of-Energy.srt"
    path.write_text("\n".join(lines), encoding="utf-8")
    print("Wrote", path)


if __name__ == "__main__":
    main()
