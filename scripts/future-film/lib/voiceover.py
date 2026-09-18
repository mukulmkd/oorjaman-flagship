#!/usr/bin/env python3
"""Premium TTS with cloud-first order. macOS neural as last resort."""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, WORK, TIMELINE

VO_DIR = WORK / "vo"
META = VO_DIR / "provider.json"
SLNC_RE = re.compile(r"\[\[slnc\s+\d+\]\]", re.I)
# Arjun — Modern and friendly (Voice Library). Paid plan required for API.
INDIAN_EL_VOICE = "2muwBbTynA0XWNaXklBY"
_EL_LIBRARY_LOCKED = False


def spoken_text(text: str, *, for_apple: bool = False) -> str:
    """One take per scene. Brand as Oorja-Man. Keep sentence punctuation as the only pauses."""
    t = text if for_apple else SLNC_RE.sub(" ", text)
    t = re.sub(r"Oorja\s*Man|Oorjaman|OORJAMAN", "Oorja-Man", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip()


def _run(cmd: list[str]) -> None:
    subprocess.check_call(cmd)


def _ffmpeg_to_wav(src: Path, dst: Path) -> None:
    _run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-ac",
            "1",
            "-ar",
            "44100",
            "-sample_fmt",
            "s16",
            str(dst),
        ]
    )


def try_openai(text: str, dst: Path) -> bool:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return False
    payload = json.dumps(
        {
            "model": os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
            "voice": os.environ.get("OPENAI_TTS_VOICE", "onyx"),
            "input": spoken_text(text),
            "speed": 0.97,
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    tmp = dst.with_suffix(".mp3")
    try:
        with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as f:
            f.write(r.read())
        _ffmpeg_to_wav(tmp, dst)
        tmp.unlink(missing_ok=True)
        return True
    except Exception as exc:
        print(f"OpenAI TTS failed: {exc}")
        tmp.unlink(missing_ok=True)
        return False


def try_elevenlabs(text: str, dst: Path) -> bool:
    global _EL_LIBRARY_LOCKED
    if _EL_LIBRARY_LOCKED:
        return False
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or "").strip()
    if not key:
        return False
    voice = os.environ.get("ELEVENLABS_VOICE_ID", INDIAN_EL_VOICE)
    model = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    payload = {
        "text": spoken_text(text),
        "model_id": model,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.12,
            "use_speaker_boost": True,
        },
    }
    body = json.dumps(payload).encode()
    formats = []
    env_fmt = os.environ.get("ELEVENLABS_OUTPUT_FORMAT", "").strip()
    if env_fmt:
        formats.append(env_fmt)
    for fmt in ("mp3_44100_192", "mp3_44100_128"):
        if fmt not in formats:
            formats.append(fmt)
    tmp = dst.with_suffix(".mp3")
    last_err = None
    for fmt in formats:
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format={fmt}",
            data=body,
            headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as f:
                f.write(r.read())
            _ffmpeg_to_wav(tmp, dst)
            tmp.unlink(missing_ok=True)
            return True
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode(errors="replace")[:400]
            last_err = f"HTTP {exc.code} ({fmt}): {err_body}"
            tmp.unlink(missing_ok=True)
            if exc.code == 403 and "output_format" in err_body:
                continue
            if exc.code == 402 and "library voices" in err_body.lower():
                _EL_LIBRARY_LOCKED = True
                print(
                    "ElevenLabs Indian library voices need a paid API plan; "
                    "using macOS Indian English (Aman / Rishi)."
                )
                return False
            print(f"ElevenLabs TTS failed: {last_err}")
            return False
        except Exception as exc:
            print(f"ElevenLabs TTS failed: {exc}")
            tmp.unlink(missing_ok=True)
            return False
    print(f"ElevenLabs TTS failed: {last_err}")
    tmp.unlink(missing_ok=True)
    return False


def macos_neural(text: str, dst: Path) -> str:
    """Indian English first (Aman / Rishi / Tara), then US neural. Not espeak."""
    preferred = os.environ.get("MACOS_TTS_VOICE", "").strip()
    voices = [v for v in (preferred, "Aman", "Rishi", "Tara", "Reed (English (US))", "Eddy (English (US))") if v]
    last_err = None
    aiff = Path(tempfile.mkstemp(suffix=".aiff")[1])
    spoken = spoken_text(text, for_apple=True)
    for voice in voices:
        try:
            _run(
                [
                    "say",
                    "-v",
                    voice,
                    "-r",
                    "148",
                    "-o",
                    str(aiff),
                    spoken,
                ]
            )
            _ffmpeg_to_wav(aiff, dst)
            aiff.unlink(missing_ok=True)
            return voice
        except subprocess.CalledProcessError as exc:
            last_err = exc
    aiff.unlink(missing_ok=True)
    raise RuntimeError(f"macOS neural TTS failed: {last_err}")


def wav_seconds(path: Path) -> float:
    import wave

    with wave.open(str(path)) as w:
        return w.getnframes() / float(w.getframerate())


def atempo_filters(ratio: float) -> str:
    parts: list[str] = []
    r = ratio
    while r > 2.0:
        parts.append("atempo=2.0")
        r /= 2.0
    while r < 0.5:
        parts.append("atempo=0.5")
        r /= 0.5
    parts.append(f"atempo={r:.4f}")
    return ",".join(parts)


def pad_to_duration(wav: Path, seconds: float) -> None:
    """Fit the take to the scene. Never hard-cut speech; pad leftover at the end only."""
    actual = wav_seconds(wav)
    tmp = wav.with_suffix(".padded.wav")
    if actual > seconds + 0.05:
        ratio = actual / seconds
        print(f"WARNING {wav.name} speech {actual:.2f}s > scene {seconds:.2f}s (atempo {ratio:.3f})")
        af = f"{atempo_filters(ratio)},apad=whole_dur={seconds:.3f}"
    else:
        af = f"apad=whole_dur={seconds:.3f}"
    _run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav),
            "-af",
            af,
            "-t",
            f"{seconds:.3f}",
            str(tmp),
        ]
    )
    tmp.replace(wav)


def synth_scene(text: str, dst: Path, pref: str) -> str:
    used = False
    provider = "unknown"
    if pref in ("elevenlabs", "eleven"):
        if try_elevenlabs(text, dst):
            provider, used = "elevenlabs", True
        elif try_openai(text, dst):
            provider, used = "openai-tts", True
    elif pref in ("openai", "openai-tts"):
        if try_openai(text, dst):
            provider, used = "openai-tts", True
        elif try_elevenlabs(text, dst):
            provider, used = "elevenlabs", True
    else:
        if try_openai(text, dst):
            provider, used = "openai-tts", True
        elif try_elevenlabs(text, dst):
            provider, used = "elevenlabs", True
    if not used:
        voice = macos_neural(text, dst)
        provider = f"macos-neural:{voice}"
    return provider


def main() -> None:
    VO_DIR.mkdir(parents=True, exist_ok=True)
    provider = "unknown"
    pref = os.environ.get("TTS_PROVIDER", "").strip().lower()
    for scene in TIMELINE["scenes"]:
        sid = scene["id"]
        dst = VO_DIR / f"{sid}.wav"
        dur = float(scene["duration"])
        provider = synth_scene(scene["vo"], dst, pref)
        pad_to_duration(dst, dur)
        print(f"VO {sid} ({provider}) {wav_seconds(dst):.2f}s")

    files = [str(VO_DIR / f"{s['id']}.wav") for s in TIMELINE["scenes"]]
    lst = VO_DIR / "concat.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in files))
    concat = VO_DIR / "narration.wav"
    _run(
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
            "-c",
            "copy",
            str(concat),
        ]
    )
    META.write_text(
        json.dumps(
            {
                "provider": provider,
                "voice_id": os.environ.get("ELEVENLABS_VOICE_ID", INDIAN_EL_VOICE),
            },
            indent=2,
        )
    )
    print("Narration:", concat, "provider:", provider)


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT / "lib"))
    main()
