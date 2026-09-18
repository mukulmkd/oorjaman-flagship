#!/usr/bin/env python3
"""Mux picture + ducked score + VO + SFX → H.264/AAC 3840x2160 30fps."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import OUTPUT, WORK

PIC = WORK / "picture_silent.mp4"
VO = WORK / "vo" / "narration.wav"
SCORE = WORK / "audio" / "score.wav"
SFX = WORK / "audio" / "sfx.wav"
OUT = OUTPUT / "Oorjaman-Future-of-Energy.mp4"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # Gentle score bed under speech (masks TTS hiss). Mild duck, never mute the music.
    filt = (
        "[2:a]aformat=sample_rates=48000:channel_layouts=stereo,"
        "highpass=f=80,lowpass=f=12500,afftdn=nr=14:nf=-22:tn=1,volume=1.12,asplit=2[sc][vo];"
        "[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.20[scin];"
        "[scin][sc]sidechaincompress=threshold=0.04:ratio=3.5:attack=20:release=480:knee=6:makeup=1[ducked];"
        "[3:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.04[sfx];"
        "[ducked][vo][sfx]amix=inputs=3:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,aresample=48000[a]"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(PIC),
            "-i",
            str(SCORE),
            "-i",
            str(VO),
            "-i",
            str(SFX),
            "-filter_complex",
            filt,
            "-map",
            "0:v",
            "-map",
            "[a]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "256k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            str(OUT),
        ]
    )
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
