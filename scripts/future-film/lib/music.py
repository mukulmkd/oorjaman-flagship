#!/usr/bin/env python3
"""Film score: custom file → ElevenLabs Music → royalty-safe placeholder."""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, TIMELINE, WORK, total_duration

SR = 44100
OUT = WORK / "audio"
MUSIC = OUT / "score.wav"
SFX = OUT / "sfx.wav"
CUSTOM_SCORE_NAMES = ("score.wav", "score.mp3", "score.m4a", "score.aiff", "score.flac", "score.ogg")

ELEVEN_MUSIC_PROMPT = (
    "Instrumental underscore for a premium clean-tech vision film about solar energy in India. "
    "Calm, spacious, modern. Soft analog pads, a low pulse, gentle piano or mallet motifs, "
    "subtle rising warmth. Apple and Tesla film energy, not a movie trailer. "
    "No vocals, no choir, no rap, no EDM drop, no epic brass stabs, no distortion. "
    "Tempo around 76 BPM. Hopeful, trustworthy, minimal."
)


def env_adsr(n: int, a=0.02, d=0.1, s=0.7, r=0.3) -> np.ndarray:
    t = np.linspace(0, 1, n, endpoint=False)
    out = np.ones(n) * s
    na, nd, nr = int(a * n), int(d * n), int(r * n)
    if na:
        out[:na] = np.linspace(0, 1, na)
    if nd:
        out[na : na + nd] = np.linspace(1, s, nd)
    if nr:
        out[-nr:] = np.linspace(out[-nr] if nr else s, 0, nr)
    return out


def pad(dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    # slow evolving fifths in a low register
    sig = 0.18 * np.sin(2 * math.pi * 55 * t)
    sig += 0.12 * np.sin(2 * math.pi * 82.5 * t + 0.2)
    sig += 0.08 * np.sin(2 * math.pi * 110 * t + 0.4)
    lfo = 0.5 + 0.5 * np.sin(2 * math.pi * 0.05 * t)
    sig += 0.05 * np.sin(2 * math.pi * 165 * t) * lfo
    # gentle noise bed
    rng = np.random.default_rng(4)
    noise = rng.normal(0, 0.02, n).astype(np.float64)
    # one-pole lowpass
    alpha = 0.02
    for i in range(1, n):
        noise[i] = alpha * noise[i] + (1 - alpha) * noise[i - 1]
    sig += noise
    # fade
    fade = int(2.5 * SR)
    sig[:fade] *= np.linspace(0, 1, fade)
    sig[-int(4 * SR) :] *= np.linspace(1, 0, int(4 * SR))
    return sig


def pulse(dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    # BPM 72 → 96 over the film
    bpm = 72 + 24 * np.clip(t / max(dur, 1), 0, 1)
    phase = np.cumsum(bpm / 60.0 / SR) * 2 * math.pi
    click = np.exp(-((np.sin(phase) ** 2) * 18)) * 0.09
    # increase complexity in the middle (AI / India)
    mid = np.exp(-0.5 * ((t - dur * 0.55) / (dur * 0.22)) ** 2)
    click *= 0.45 + 0.7 * mid
    return click


def bells(dur: float) -> np.ndarray:
    n = int(dur * SR)
    sig = np.zeros(n)
    starts = [s["start"] for s in TIMELINE["scenes"]]
    freqs = [440, 494, 392, 523, 330, 370, 415, 349]
    for i, st in enumerate(starts):
        f = freqs[i % len(freqs)]
        i0 = int(st * SR)
        length = int(1.8 * SR)
        i1 = min(n, i0 + length)
        tt = np.arange(i1 - i0) / SR
        tone = 0.06 * np.sin(2 * math.pi * f * tt) * np.exp(-tt * 1.6)
        tone += 0.03 * np.sin(2 * math.pi * f * 2 * tt) * np.exp(-tt * 2.2)
        sig[i0:i1] += tone
    return sig


def sfx_track(dur: float) -> np.ndarray:
    n = int(dur * SR)
    rng = np.random.default_rng(9)
    sig = np.zeros(n)
    # soft whoosh on opening + final
    last = float(TIMELINE["scenes"][-1]["start"])
    for st, length in [(0.3, 1.6), (last + 0.4, 2.0)]:
        i0 = int(st * SR)
        ln = int(length * SR)
        i1 = min(n, i0 + ln)
        tt = np.arange(i1 - i0) / SR
        noise = rng.normal(0, 1, i1 - i0)
        for i in range(1, len(noise)):
            noise[i] = 0.08 * noise[i] + 0.92 * noise[i - 1]
        env = np.sin(np.pi * tt / max(tt[-1], 1e-6)) ** 2
        sig[i0:i1] += 0.04 * noise * env
    # UI ticks for score / passport
    by_id = {s["id"]: float(s["start"]) for s in TIMELINE["scenes"]}
    for sid, offset in (
        ("02_passport", 0.6),
        ("03_score", 0.8),
        ("05_trust", 3.6),
        ("08_health", 0.8),
        ("08_health", 10.3),
        ("13_india", 2.4),
        ("17_final", 4.4),
    ):
        st = by_id[sid] + offset
        i0 = int(st * SR)
        ln = int(0.04 * SR)
        if i0 + ln >= n:
            continue
        tt = np.arange(ln) / SR
        tick = 0.05 * np.sin(2 * math.pi * 1240 * tt) * np.exp(-tt * 40)
        sig[i0 : i0 + ln] += tick
    return sig


def find_custom_score() -> Path | None:
    audio = ROOT / "audio"
    for name in CUSTOM_SCORE_NAMES:
        p = audio / name
        if p.exists() and p.stat().st_size > 1024:
            return p
    return None


def ingest_custom_score(src: Path, dst: Path, dur: float) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-stream_loop",
            "-1",
            "-i",
            str(src),
            "-t",
            f"{dur:.3f}",
            "-ac",
            "2",
            "-ar",
            str(SR),
            "-c:a",
            "pcm_s16le",
            str(dst),
        ]
    )


def try_elevenlabs_music(dst_mp3: Path, dur: float) -> bool:
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or "").strip()
    if not key:
        return False
    provider = os.environ.get("MUSIC_PROVIDER", "elevenlabs").strip().lower()
    if provider in ("off", "none", "placeholder", "procedural"):
        return False
    length_ms = min(600_000, max(10_000, int(dur * 1000) + 1500))
    model = os.environ.get("ELEVENLABS_MUSIC_MODEL", "music_v2")
    prompt = os.environ.get("ELEVENLABS_MUSIC_PROMPT", ELEVEN_MUSIC_PROMPT)
    body = json.dumps(
        {
            "prompt": prompt,
            "music_length_ms": length_ms,
            "model_id": model,
            "force_instrumental": True,
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192",
        data=body,
        headers={
            "xi-api-key": key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    dst_mp3.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst_mp3.with_suffix(".tmp.mp3")
    try:
        print(f"ElevenLabs Music ({model}, {length_ms} ms)…", flush=True)
        with urllib.request.urlopen(req, timeout=420) as r, tmp.open("wb") as f:
            f.write(r.read())
        tmp.replace(dst_mp3)
        print("Wrote", dst_mp3)
        return True
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        print(f"ElevenLabs Music failed: {exc}")
        print("If this is 401/403, edit or recreate the API key and set Music Generation = Write.")
        return False


def write_wav(path: Path, sig: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sig = np.clip(sig, -1, 1)
    pcm = (sig * 32767).astype(np.int16)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    dur = total_duration()
    write_wav(SFX, sfx_track(dur) * 0.7)
    custom = find_custom_score()
    if custom is None:
        generated = ROOT / "audio" / "score.mp3"
        if try_elevenlabs_music(generated, dur):
            custom = generated
    if custom is not None:
        ingest_custom_score(custom, MUSIC, dur)
        print("Using score", custom)
    else:
        score = pad(dur) + pulse(dur) + bells(dur)
        peak = np.max(np.abs(score)) or 1
        score = score / peak * 0.38
        write_wav(MUSIC, score)
        print("Procedural placeholder score", MUSIC)
    print("SFX", SFX)


if __name__ == "__main__":
    main()
