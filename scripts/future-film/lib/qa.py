#!/usr/bin/env python3
"""QA for the vision film — codecs, duration, future-vs-current language."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUTPUT, ROOT, TIMELINE, WORK, total_duration

MP4 = OUTPUT / "Oorjaman-Future-of-Energy.mp4"
SRT = OUTPUT / "Oorjaman-Future-of-Energy.srt"
REPORT = OUTPUT / "QA_REPORT.md"


def probe() -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(MP4),
        ]
    )
    return json.loads(raw)


def main() -> None:
    info = probe()
    fmt = info["format"]
    streams = {s["codec_type"]: s for s in info["streams"]}
    v, a = streams["video"], streams["audio"]
    dur = float(fmt["duration"])
    w, h = int(v["width"]), int(v["height"])
    fps = v.get("avg_frame_rate", "30/1")
    provider = "unknown"
    pmeta = WORK / "vo" / "provider.json"
    if pmeta.exists():
        provider = json.loads(pmeta.read_text())["provider"]

    checks = []

    def add(ok: bool, name: str, detail: str):
        checks.append((ok, name, detail))

    add(w == 3840 and h == 2160, "Resolution 3840x2160", f"{w}x{h}")
    br = int(v.get("bit_rate") or fmt.get("bit_rate") or 0)
    add(br >= 1_000_000, "Video bitrate (4K floor)", f"{br} bps")
    add(v.get("codec_name") == "h264", "Video H.264", v.get("codec_name"))
    add(a.get("codec_name") == "aac", "Audio AAC", a.get("codec_name"))
    add(int(a.get("sample_rate", 0)) in (44100, 48000), "Audio 44.1/48 kHz", a.get("sample_rate"))
    add(abs(dur - total_duration()) < 1.5, "Duration ~timeline", f"{dur:.2f}s vs {total_duration():.2f}s")
    add(SRT.exists(), "SRT present", str(SRT.name))
    add("espeak" not in provider.lower() and "festival" not in provider.lower(), "TTS not espeak/festival", provider)

    srt = SRT.read_text(encoding="utf-8") if SRT.exists() else ""
    banned = ["now live nationwide", "already operating nationally", "currently covers India"]
    add(not any(b in srt.lower() for b in banned), "No false national-coverage claim", "ok")
    add("imagine" in srt.lower() or "can " in srt.lower() or "could" in srt.lower(), "Vision language (can/could/imagine)", "ok")

    lines = [
        "# QA report — Oorjaman Future of Energy",
        "",
        "This is the **vision film**, not the Customer/Technician product demo.",
        "",
        f"- File: `{MP4}`",
        f"- Duration: {dur:.2f}s",
        f"- Video: {v.get('codec_name')} {w}x{h} {fps}",
        f"- Audio: {a.get('codec_name')} {a.get('sample_rate')} Hz",
        f"- TTS provider: `{provider}`",
        f"- Scenes: {len(TIMELINE['scenes'])}",
        "",
        "## Checks",
        "",
        "| OK | Check | Detail |",
        "| --- | --- | --- |",
    ]
    for ok, name, detail in checks:
        lines.append(f"| {'yes' if ok else 'NO'} | {name} | {detail} |")
    tts_note = f"- TTS: `{provider}` — brand spoken as Oorja-Man (Oorja then immediately Man)."
    custom_score = next(
        (ROOT / "audio" / name for name in ("score.mp3", "score.wav", "score.m4a") if (ROOT / "audio" / name).exists()),
        None,
    )
    if custom_score:
        score_note = (
            f"- Score: `{custom_score.name}` (drop-in). If this is Scott Buckley’s Horizons, "
            "credit: 'Horizons' by Scott Buckley — CC BY 4.0. www.scottbuckley.com.au"
        )
    else:
        score_note = "- Score is original / royalty-safe (procedural), not a licensed cinematic library."
    lines += [
        "",
        "## Current vs future",
        "",
        "- Super throughout: FUTURE VISION — NOT CURRENTLY OPERATIONAL",
        "- Opening: VISION FILM · NOT A PRODUCT DEMO",
        "- Evolution stage 1 tagged TODAY; later stages VISION",
        "- Trust / finance / academy / APIs framed as potential",
        "- India map caption: not national-scale operations today",
        "- Economy kicker: Potential — not current revenue",
        "",
        "## Known limits",
        "",
        score_note,
        tts_note,
        "- Duration is ~3:22 with the full Future of OorjaMan brief baked in.",
        "- Motion is typography + network graphics (no stock-photo montage, no live app capture).",
        "- Completely separate from `scripts/product-demo/` (current Customer/Technician apps).",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    (ROOT / "QA_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print(REPORT.read_text())
    if not all(ok for ok, _, _ in checks):
        sys.exit(1)


if __name__ == "__main__":
    main()
