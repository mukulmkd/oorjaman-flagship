#!/usr/bin/env python3
"""
4K compositor — 4K_MASTER_UPSCALED_FROM_1080P

Loads one successful run; rejects mixed run IDs.
"""
from __future__ import annotations

import json
import math
import random
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PROD = Path(__file__).resolve().parent
sys.path.insert(0, str(PROD))

import audio as audio_mod  # noqa: E402
from lib.common import DemoError, sh, write_json  # noqa: E402
from lib.paths import CFG, fonts_dir, lockup_path, logo_path, music_path, run_dirs  # noqa: E402

W = int(CFG["final_width"])
H = int(CFG["final_height"])
FPS = int(CFG["fps"])
SRC_W = int(CFG["source_width"])
SRC_H = int(CFG["source_height"])
BG = (246, 250, 249)
OORJA = (84, 144, 72)
MAN = (28, 66, 118)
MUTED = (81, 106, 123)
PRIMARY = (31, 134, 96)
NAVY = (11, 18, 32)
LAYOUT_W, LAYOUT_H = 1920, 1080
SCALE = W / LAYOUT_W


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(fonts_dir() / f"PlusJakartaSans-{name}.ttf"), size=int(size * SCALE))


def clamp01(t: float) -> float:
    return max(0.0, min(1.0, t))


def ease_out(t: float) -> float:
    t = clamp01(t)
    return 1 - (1 - t) ** 3


def ease_out_back(t: float, s: float = 1.05) -> float:
    """Match RN BrandSplash: Easing.out(Easing.back(1.05))."""
    t = clamp01(t)
    return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2


def ease_in_out(t: float) -> float:
    t = clamp01(t)
    return 3 * t * t - 2 * t * t * t


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def load_events(events_path: Path) -> list[dict]:
    rows = []
    for line in events_path.read_text().splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def verify_run(run_id: str) -> dict:
    dirs = run_dirs(run_id)
    manifest_path = dirs["events"] / "manifest.json"
    if not manifest_path.exists():
        raise DemoError(f"Missing manifest for {run_id}")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("status") != "SUCCESS":
        raise DemoError(f"Run {run_id} is not SUCCESS — refusing to render")
    if manifest.get("run_id") != run_id:
        raise DemoError("manifest run_id mismatch")
    cust = dirs["raw"] / "customer.mp4"
    tech = dirs["raw"] / "technician.mp4"
    if not cust.exists() or not tech.exists():
        raise DemoError("Missing customer/technician recordings")
    rec = json.loads((dirs["events"] / "recording-manifest.json").read_text())
    if rec.get("run_id") != run_id:
        raise DemoError("recording-manifest run_id mismatch — refusing mixed runs")
    return {"dirs": dirs, "manifest": manifest, "customer": cust, "technician": tech, "rec": rec}


def render_brand(dst: Path, duration: float, *, closing: bool) -> None:
    """
    Brand open/close using the official brand-kit lockup raster
    (logo + OorjaMan + WE CLEAN. YOU GENERATE.) as ONE animated unit.
    Canvas matches kit: pure white. Animation mirrors BrandSplash: fade + scale.
    """
    work = PROD / "rendered" / "_work"
    work.mkdir(parents=True, exist_ok=True)
    frames = work / ("_close" if closing else "_open")
    if frames.exists():
        for p in frames.glob("*.png"):
            p.unlink()
    frames.mkdir(parents=True, exist_ok=True)

    WHITE = (255, 255, 255)
    src = Image.open(lockup_path()).convert("RGB")
    # Tight crop to real lockup ink (threshold must ignore near-white JPEG/PNG haze —
    # a looser mask pulls phantom pixels on the right and shifts the unit off-center).
    import numpy as np

    arr = np.asarray(src)
    dist = 255 - arr.min(axis=2)
    mask = dist > 12
    ys, xs = np.where(mask)
    pad = 48
    left = max(0, int(xs.min()) - pad)
    top = max(0, int(ys.min()) - pad)
    right = min(src.width, int(xs.max()) + 1 + pad)
    bottom = min(src.height, int(ys.max()) + 1 + pad)
    unit = src.crop((left, top, right, bottom))

    # Lockup is nearly square — size by height so it breathes on 16:9 (not huge).
    # ~38% of frame height ≈ premium title-card scale.
    th = int(H * 0.38)
    tw = int(unit.width * (th / unit.height))
    if tw > int(W * 0.36):
        tw = int(W * 0.36)
        th = int(unit.height * (tw / unit.width))
    unit_base = unit.resize((tw, th), Image.Resampling.LANCZOS)

    n = int(duration * FPS)
    for i in range(n):
        t = i / FPS
        im = Image.new("RGB", (W, H), WHITE)

        if closing:
            # Full lockup held, then fade + gentle scale-out (mirror of entrance)
            fade = 1.20
            hold_end = max(0.6, duration - fade)
            if t <= hold_end:
                op, sc = 1.0, 1.0
            else:
                u = ease_out(clamp01((duration - t) / fade))
                op = u
                sc = 0.90 + 0.10 * u
        else:
            # BrandSplash-like: opacity 500ms, scale 650ms ease-out-back from 0.88
            u_op = ease_out(clamp01((t - 0.12) / 0.50))
            u_sc = clamp01((t - 0.12) / 0.65)
            op = u_op
            sc = 0.88 + 0.12 * ease_out_back(u_sc) if u_sc > 0 else 0.88
            if t >= 0.90:
                op, sc = 1.0, 1.0

        if op <= 0.01:
            im.save(frames / f"f_{i:05d}.png")
            continue

        w = max(8, int(tw * sc))
        h = max(8, int(th * sc))
        framed = unit_base.resize((w, h), Image.Resampling.LANCZOS).convert("RGBA")
        if op < 0.999:
            a = framed.split()[-1].point(lambda p, o=op: int(p * o))
            framed.putalpha(a)
        # On white RGB: paste with alpha
        canvas = Image.new("RGBA", (W, H), (*WHITE, 255))
        x = (W - w) // 2
        y = (H - h) // 2
        canvas.alpha_composite(framed, (x, y))
        canvas.convert("RGB").save(frames / f"f_{i:05d}.png")

    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(FPS),
            "-i",
            str(frames / "f_%05d.png"),
            "-c:v",
            "libx264",
            "-profile:v",
            "main",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "17",
            "-preset",
            "veryfast",
            "-r",
            str(FPS),
            str(dst),
        ],
        timeout=300,
    )



def make_label(path: Path, text: str) -> None:
    img = Image.new("RGBA", (800, 36), (*NAVY, 210))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(str(fonts_dir() / "PlusJakartaSans-SemiBold.ttf"), 18)
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((800 - tw) / 2, (36 - th) / 2), text, fill=(255, 255, 255, 255), font=f)
    img.save(path)


def _probe_duration(path: Path) -> float:
    return float(
        sh(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            timeout=30,
        ).stdout.strip()
        or "0"
    )


def phone_frame_assets() -> tuple[Path, dict]:
    """Premium phone chassis PNG + screen hole metadata.

    Screen hole aspect matches scrcpy portrait (484:1080) so contain-fit
    fills the glass without cropping app UI.
    """
    from PIL import ImageChops, ImageFilter

    assets = PROD / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    frame = assets / "phone-frame.png"
    mask_path = assets / "phone-screen-mask.png"
    meta_path = assets / "phone-frame.json"
    version = 3
    if frame.exists() and mask_path.exists() and meta_path.exists():
        meta = json.loads(meta_path.read_text())
        if meta.get("version") == version:
            return frame, meta

    # Chassis sized for portrait scrcpy aspect (484/1080)
    src_aspect = 484 / 1080
    oh = 1680
    top = bottom = 28
    scr_h = oh - top - bottom
    scr_w = int(round(scr_h * src_aspect))
    scr_w -= scr_w % 2
    side = 46  # slightly thicker left/right bezel — premium phone look
    ow = scr_w + side * 2
    left = right = side
    r_outer, r_screen, pad = 78, 52, 48

    def rounded_mask(w: int, h: int, r: int) -> Image.Image:
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
        return m

    def punch_screen(img: Image.Image) -> Image.Image:
        """Force fully transparent pixels in the screen glass (no shadow bleed)."""
        out = img.copy()
        clear = Image.new("RGBA", (scr_w, scr_h), (0, 0, 0, 0))
        # Hard rounded clear so soft shadow cannot tint the UI
        hole_m = rounded_mask(scr_w, scr_h, r_screen)
        out.paste(clear, (pad + left, pad + top), hole_m)
        return out

    canvas = Image.new("RGBA", (ow + pad * 2, oh + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (0, 0, ow - 1, oh - 1), radius=r_outer, fill=(15, 30, 45, 100)
    )
    # Shadow only around the chassis — punch screen so it never overlays the app UI
    shadow_hole = Image.new("L", (ow, oh), 255)
    shadow_hole.paste(Image.new("L", (scr_w, scr_h), 0), (left, top))
    sr, sg, sb, sa = shadow.split()
    shadow = Image.merge("RGBA", (sr, sg, sb, ImageChops.multiply(sa, shadow_hole)))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)), (pad + 8, pad + 18))
    # Blur softens edges back into the hole — punch again after blur
    canvas = punch_screen(canvas)

    body = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.rounded_rectangle((0, 0, ow - 1, oh - 1), radius=r_outer, fill=(28, 36, 48, 255))
    bd.rounded_rectangle((3, 3, ow - 4, oh - 4), radius=r_outer - 3, fill=(18, 24, 34, 255))
    bd.rounded_rectangle((4, 4, ow - 5, oh - 5), radius=r_outer - 4, outline=(70, 88, 110, 170), width=2)
    cx, cy, cr = ow // 2, 14, 8
    bd.ellipse((cx - cr, cy - cr, cx + cr, cy + cr), fill=(8, 10, 14, 255))
    bd.ellipse((cx - cr + 2, cy - cr + 2, cx + cr - 2, cy + cr - 2), fill=(45, 60, 85, 220))
    ibar_w, ibar_h = 118, 5
    ix, iy = (ow - ibar_w) // 2, oh - 16
    bd.rounded_rectangle((ix, iy, ix + ibar_w, iy + ibar_h), radius=3, fill=(220, 230, 240, 150))

    bezel_a = rounded_mask(ow, oh, r_outer)
    hole = Image.new("L", (ow, oh), 0)
    hole.paste(rounded_mask(scr_w, scr_h, r_screen), (left, top))
    alpha = ImageChops.subtract(bezel_a, hole)
    br, bg_, bb, _ = body.split()
    rgb = Image.merge("RGB", (br, bg_, bb))
    rgb.paste(Image.new("RGB", (scr_w, scr_h), (0, 0, 0)), (left, top))
    body = Image.merge("RGBA", (*rgb.split(), alpha))
    canvas.alpha_composite(body, (pad, pad))
    canvas = punch_screen(canvas)
    canvas.save(frame)

    # Soft rounded glass mask (slightly tighter than hole so bezel never eats UI)
    inset = 4
    mask = Image.new("L", (scr_w, scr_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset, inset, scr_w - 1 - inset, scr_h - 1 - inset),
        radius=max(8, r_screen - 6),
        fill=255,
    )
    mask.save(mask_path)

    meta = {
        "version": version,
        "frame_w": canvas.width,
        "frame_h": canvas.height,
        "screen_x": pad + left,
        "screen_y": pad + top,
        "screen_w": scr_w,
        "screen_h": scr_h,
        "screen_radius": r_screen,
        "mask": "phone-screen-mask.png",
        "src_aspect": src_aspect,
    }
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")
    return frame, meta


def make_role_label(path: Path, text: str) -> None:
    """Clean under-phone role label for 4K dual layout."""
    img = Image.new("RGBA", (900, 72), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(str(fonts_dir() / "PlusJakartaSans-SemiBold.ttf"), 36)
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((900 - tw) / 2, (72 - th) / 2), text, fill=(*MUTED, 255), font=f)
    img.save(path)


def compose_dual_devices_4k(cust: Path, tech: Path, dst: Path) -> float:
    """
    Place each recording inside a premium phone chassis on a 4K brand canvas.
    Contain-fit (no crop) + rounded glass mask so top UI stays intact.
    """
    work = PROD / "rendered" / "_work"
    work.mkdir(parents=True, exist_ok=True)
    frame_path, meta = phone_frame_assets()
    mask_path = PROD / "assets" / str(meta.get("mask") or "phone-screen-mask.png")
    lc, lt = work / "lbl_c.png", work / "lbl_t.png"
    make_role_label(lc, "CUSTOMER")
    make_role_label(lt, "TECHNICIAN")

    body_dur = min(_probe_duration(cust), _probe_duration(tech))
    bg_hex = f"0x{BG[0]:02X}{BG[1]:02X}{BG[2]:02X}"

    # Scale phones so chassis height is ~86% of 4K frame; keep breathing room.
    target_h = int(H * 0.86)
    scale = target_h / float(meta["frame_h"])
    fw = int(round(meta["frame_w"] * scale))
    fh = int(round(meta["frame_h"] * scale))
    sx = int(round(meta["screen_x"] * scale))
    sy = int(round(meta["screen_y"] * scale))
    sw = int(round(meta["screen_w"] * scale))
    scr_h = int(round(meta["screen_h"] * scale))
    fw -= fw % 2
    fh -= fh % 2
    sw -= sw % 2
    scr_h -= scr_h % 2

    gap = 160
    total_w = fw * 2 + gap
    left_x = (W - total_w) // 2
    right_x = left_x + fw + gap
    phone_y = (H - fh) // 2 - 36
    label_y = phone_y + fh - 18

    # Contain-fit: preserve full UI (no crop). Pad with near-black glass; mask rounds edges.
    screen_vf = (
        f"fps={FPS},setpts=PTS-STARTPTS,"
        f"scale={sw}:{scr_h}:force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={sw}:{scr_h}:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1,format=rgba"
    )
    mask_vf = f"scale={sw}:{scr_h}:flags=lanczos,format=gray"
    fc = (
        f"color=c={bg_hex}:s={W}x{H}:d={body_dur:.3f},fps={FPS},format=rgba[bg];"
        f"[0:v]{screen_vf}[sc0];"
        f"[1:v]{screen_vf}[st0];"
        f"[5:v]{mask_vf},split=2[mL][mR];"
        f"[sc0][mL]alphamerge[sc];"
        f"[st0][mR]alphamerge[st];"
        f"[2:v]fps={FPS},scale={fw}:{fh}:flags=lanczos,format=rgba,"
        f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(alpha(X,Y)\\,12)\\,0\\,alpha(X,Y))',"
        f"split=2[frL][frR];"
        f"[3:v]scale=720:-1,format=rgba[lc];"
        f"[4:v]scale=720:-1,format=rgba[lt];"
        f"[bg][sc]overlay={left_x + sx}:{phone_y + sy}:shortest=1[a];"
        f"[a][frL]overlay={left_x}:{phone_y}:shortest=1[b];"
        f"[b][st]overlay={right_x + sx}:{phone_y + sy}:shortest=1[c];"
        f"[c][frR]overlay={right_x}:{phone_y}:shortest=1[d];"
        f"[d][lc]overlay={left_x + (fw - 720) // 2}:{label_y}[e];"
        f"[e][lt]overlay={right_x + (fw - 720) // 2}:{label_y},format=yuv420p[vout]"
    )
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(cust),
            "-i",
            str(tech),
            "-loop",
            "1",
            "-i",
            str(frame_path),
            "-i",
            str(lc),
            "-i",
            str(lt),
            "-loop",
            "1",
            "-i",
            str(mask_path),
            "-filter_complex",
            fc,
            "-map",
            "[vout]",
            "-c:v",
            "libx264",
            "-profile:v",
            "main",
            "-level",
            "5.1",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            "-crf",
            "17",
            "-preset",
            "veryfast",
            "-threads",
            "0",
            "-t",
            f"{body_dur:.3f}",
            str(dst),
        ],
        timeout=1800,
    )
    return _probe_duration(dst)


def compose_dual_1080(cust: Path, tech: Path, dst: Path, events: list[dict]) -> float:
    """Legacy flat dual layout (kept for fallback). Prefer compose_dual_devices_4k."""
    return compose_dual_devices_4k(cust, tech, dst)


def burn_overlays_and_subs(
    body_1080: Path,
    events: list[dict],
    vo_wav: Path,
    dst_1080: Path,
    open_sec: float,
    recording_started_wall: float,
) -> Path:
    """PNG overlays for event badges — timed to body (recording-relative)."""
    work = PROD / "rendered" / "_work"
    overlay_inputs: list[str] = []
    filter_parts: list[str] = []
    idx = 0
    base = "[0:v]"
    last = "v0"
    filter_parts.append(f"{base}null[{last}]")
    for ev in events:
        label = ev.get("overlay")
        if not label:
            continue
        t = max(0.0, float(ev.get("timestamp_wall") or 0) - recording_started_wall)
        png = work / f"ov_{idx}.png"
        bw, bh = 920, 72
        img = Image.new("RGBA", (bw, bh), (*NAVY, 200))
        d = ImageDraw.Draw(img)
        f = ImageFont.truetype(str(fonts_dir() / "PlusJakartaSans-SemiBold.ttf"), 34)
        bb = d.textbbox((0, 0), label, font=f)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        d.text(((bw - tw) / 2, (bh - th) / 2), label, fill=(255, 255, 255, 255), font=f)
        img.save(png)
        overlay_inputs += ["-i", str(png)]
        nxt = f"v{idx+1}"
        filter_parts.append(
            f"[{last}][{idx+1}:v]overlay=(W-w)/2:H-h-64:enable='between(t\\,{t:.3f}\\,{t+2.8:.3f})'[{nxt}]"
        )
        last = nxt
        idx += 1

    if idx == 0:
        sh(["ffmpeg", "-y", "-i", str(body_1080), "-c", "copy", str(dst_1080)], timeout=120)
        return dst_1080

    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(body_1080),
            *overlay_inputs,
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            f"[{last}]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            "-crf",
            "16",
            "-preset",
            "veryfast",
            str(dst_1080),
        ],
        timeout=1200,
    )
    return dst_1080


def upscale_4k(src: Path, dst: Path) -> None:
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-vf",
            f"scale={W}:{H}:flags=lanczos,format=yuv420p",
            "-c:v",
            "libx264",
            "-profile:v",
            "main",
            "-level",
            "5.1",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            "-crf",
            str(CFG["crf"]),
            "-preset",
            "veryfast",
            "-movflags",
            "+faststart",
            str(dst),
        ],
        timeout=1200,
    )


def concat_picture(open_p: Path, body: Path, close_p: Path, dst: Path) -> float:
    lst = PROD / "rendered" / "_work" / "concat.txt"
    lst.parent.mkdir(parents=True, exist_ok=True)
    lst.write_text(f"file '{open_p}'\nfile '{body}'\nfile '{close_p}'\n")
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(lst),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-r",
            str(FPS),
            "-crf",
            "17",
            "-preset",
            "veryfast",
            str(dst),
        ],
        timeout=900,
    )
    return float(
        sh(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(dst),
            ],
            timeout=30,
        ).stdout.strip()
        or "0"
    )


def mux(picture: Path, audio_wav: Path, dst: Path) -> None:
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(picture),
            "-i",
            str(audio_wav),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "256k",
            "-ac",
            "2",
            "-ar",
            "48000",
            "-shortest",
            "-movflags",
            "+faststart",
            str(dst),
        ],
        timeout=300,
    )



def write_srt_from_placements(placements: list[dict], srt_path: Path) -> None:
    def ts(sec: float) -> str:
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        ms = int(round((sec - int(sec)) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    lines = []
    for i, p in enumerate(placements):
        a = float(p["start"])
        b = a + float(p["duration"])
        words = str(p["text"]).split()
        mid = max(1, len(words) // 2)
        text_block = " ".join(words[:mid]) + "\n" + " ".join(words[mid:]) if len(words) > 8 else p["text"]
        lines.append(f"{i+1}\n{ts(a)} --> {ts(b)}\n{text_block}\n")
    srt_path.write_text("\n".join(lines))


def render(run_id: str | None = None) -> Path:
    if not run_id:
        latest = PROD / "events" / "LATEST_SUCCESS.json"
        if not latest.exists():
            raise DemoError("No LATEST_SUCCESS.json — record first")
        run_id = json.loads(latest.read_text())["run_id"]

    beats_cfg = json.loads((PROD / "audio" / "voiceover-beats.json").read_text())
    open_sec = float(beats_cfg.get("brand_open_sec", 6.0))
    close_sec = float(beats_cfg.get("brand_close_sec", 5.0))

    info = verify_run(run_id)
    dirs = info["dirs"]
    events = load_events(dirs["events"] / "events.jsonl")
    rec_started = float(info["rec"]["recording_started_wall"])
    work = PROD / "rendered" / "_work"
    work.mkdir(parents=True, exist_ok=True)

    print(f"=== RENDER {run_id} ({CFG['pipeline_label']}) ===", flush=True)
    open_mp4 = work / "brand_open.mp4"
    close_mp4 = work / "brand_close.mp4"
    print("=== Brand open/close (unified lockup) ===", flush=True)
    render_brand(open_mp4, open_sec, closing=False)
    render_brand(close_mp4, close_sec, closing=True)

    body4k = work / "dual_4k.mp4"
    print("=== Dual device-framed 4K body ===", flush=True)
    body_raw = work / "dual_4k_raw.mp4"
    compose_dual_devices_4k(info["customer"], info["technician"], body_raw)
    burn_overlays_and_subs(body_raw, events, Path("."), body4k, open_sec, rec_started)

    picture = work / "picture_silent.mp4"
    total = concat_picture(open_mp4, body4k, close_mp4, picture)
    print(f"picture={total:.2f}s", flush=True)

    print("=== Event-synced macOS VO ===", flush=True)
    vo, placements = audio_mod.build_event_synced_vo(
        events,
        rec_started,
        total,
        open_sec=open_sec,
        close_sec=close_sec,
    )
    for p in placements:
        print(f"  VO {p['id']}: t={p['start']:.2f}s dur={p['duration']:.2f}s", flush=True)

    srt = PROD / "rendered" / "Oorjaman-End-to-End-Product-Demo-4K.srt"
    write_srt_from_placements(placements, srt)

    mixed = work / "audio_master.wav"
    audio_mod.mix_master(vo, music_path(), mixed, total)

    final = PROD / "rendered" / CFG["final_video_name"]
    mux(picture, mixed, final)

    write_json(
        PROD / "rendered" / "last-render.json",
        {
            "run_id": run_id,
            "final": str(final),
            "duration_sec": total,
            "pipeline_label": CFG["pipeline_label"],
            "device_framed": True,
            "upscaled": True,
            "source": "scrcpy per-device portrait",
            "final_res": f"{W}x{H}",
            "voice": "Rishi",
            "vo_synced": True,
            "brand_open_sec": open_sec,
            "brand_close_sec": close_sec,
        },
    )
    print(f"FINAL={final}", flush=True)
    return final



if __name__ == "__main__":
    rid = sys.argv[1] if len(sys.argv) > 1 else None
    render(rid)
