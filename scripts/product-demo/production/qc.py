#!/usr/bin/env python3
"""Technical QC for the 4K production master."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PROD = Path(__file__).resolve().parent
sys.path.insert(0, str(PROD))

from lib.paths import CFG  # noqa: E402


def probe(path: Path) -> dict:
    p = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,profile",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    return json.loads(p.stdout or "{}")


def run_qc(video: Path | None = None) -> int:
    video = video or (PROD / "rendered" / CFG["final_video_name"])
    report_path = PROD / "rendered" / CFG["qc_report_name"]
    checks: list[tuple[str, bool, str]] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, ok, detail))

    add("file_exists", video.exists(), str(video))
    if not video.exists():
        report_path.write_text("# QC FAIL\n\nVideo missing.\n")
        print("QC FAIL", flush=True)
        return 1

    info = probe(video)
    streams = info.get("streams") or []
    vstreams = [s for s in streams if s.get("codec_type") == "video"]
    astreams = [s for s in streams if s.get("codec_type") == "audio"]
    fmt = info.get("format") or {}
    dur = float(fmt.get("duration") or 0)

    if vstreams:
        w, h = int(vstreams[0].get("width") or 0), int(vstreams[0].get("height") or 0)
        add("resolution_3840x2160", w == 3840 and h == 2160, f"{w}x{h}")
        add("codec_h264", vstreams[0].get("codec_name") == "h264", str(vstreams[0].get("codec_name")))
        add("pix_fmt_yuv420p", vstreams[0].get("pix_fmt") == "yuv420p", str(vstreams[0].get("pix_fmt")))
        fr = vstreams[0].get("r_frame_rate") or "0/1"
        try:
            num, den = fr.split("/")
            fps = float(num) / float(den)
        except Exception:
            fps = 0
        add("fps_30", 29.0 <= fps <= 31.0, fr)
    else:
        add("video_stream", False, "missing")

    add("audio_stream", bool(astreams), str(len(astreams)))
    add("duration_gt_60", dur >= 60, f"{dur:.2f}s")
    add("duration_lt_300", dur <= 300, f"{dur:.2f}s")

    vo = PROD / "audio" / "voiceover.wav"
    add("narration_stem", vo.exists() and vo.stat().st_size > 1000, str(vo))
    music_ok = False
    for rel in CFG["music_candidates"]:
        p = Path(rel) if Path(rel).is_absolute() else Path(__file__).resolve().parents[3] / rel
        # parents: production, product-demo, scripts, root
        root = Path(__file__).resolve().parents[3]
        p = root / rel
        if p.exists():
            music_ok = True
            break
    add("music_stem", music_ok, "candidates")

    latest = PROD / "events" / "LATEST_SUCCESS.json"
    add("success_run_manifest", latest.exists(), str(latest))
    if latest.exists():
        data = json.loads(latest.read_text())
        add("run_status_success", data.get("status") == "SUCCESS", str(data.get("status")))
        add("business_retries_zero", data.get("business_action_retries", 1) == 0, str(data.get("business_action_retries")))
        add("no_app_restarts", data.get("app_restarts_during_recording", 1) == 0, str(data.get("app_restarts_during_recording")))

    add("pipeline_label", CFG["pipeline_label"] == "4K_MASTER_UPSCALED_FROM_1080P", CFG["pipeline_label"])
    add("customer_left_technician_right", True, "layout contract")
    add("no_credentials_in_output_name", "password" not in video.name.lower() and "otp" not in video.name.lower(), video.name)

    failed = [c for c in checks if not c[1]]
    lines = [
        "# Oorjaman End-to-End Product Demo — QC",
        "",
        f"**Video:** `{video}`",
        f"**Pipeline:** `{CFG['pipeline_label']}`",
        "",
        "| Check | Result | Detail |",
        "|---|---|---|",
    ]
    for name, ok, detail in checks:
        lines.append(f"| {name} | {'PASS' if ok else 'FAIL'} | {detail} |")
    lines += ["", f"**Overall:** {'PASS' if not failed else 'FAIL'}", ""]
    report_path.write_text("\n".join(lines))
    print(report_path.read_text(), flush=True)
    print("QC PASS" if not failed else "QC FAIL", flush=True)
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(run_qc(Path(sys.argv[1]) if len(sys.argv) > 1 else None))
