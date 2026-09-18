#!/usr/bin/env python3
"""Narration + music mixer — replaceable, event-synced voice stem.

TTS: ElevenLabs when scripts/product-demo/.env has TTS_PROVIDER=elevenlabs
(and ELEVENLABS_* credentials). Falls back to macOS `say` otherwise.
Music: always the local score from config (never ElevenLabs Music).
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROD = Path(__file__).resolve().parent
DEMO = PROD.parent
sys.path.insert(0, str(PROD))

from lib.common import DemoError, sh, write_json  # noqa: E402
from lib.paths import CFG, music_path  # noqa: E402


def load_demo_env() -> None:
    """Load scripts/product-demo/.env into os.environ (does not override existing)."""
    env_path = DEMO / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and v and not os.environ.get(k):
            os.environ[k] = v


load_demo_env()


# Visual/script stays OorjaMan.
# Brand audio: Google Translate / gTTS Hindi — ऊर्जा + मैन (same as Translate listen).
BRAND_SPOKEN = "ऊर्जा मैन"
BRAND_HI = ("ऊर्जा", "मैन")  # Oorja + Man in Devanagari
BRAND_RE = re.compile(
    r"^\s*(Oorja\s*-?\s*Man|Oorjaman|OORJAMAN|Urja\s*-?\s*Man|Oorjah\s*-?\s*Man|"
    r"Oor-ja-man|UrjaMan|Oor-jah-Man)\s*[—\-–:,.]?\s*",
    re.I,
)


def spoken(text: str) -> str:
    """ElevenLabs body lines still use Oorja-Man; brand clip is Google Hindi."""
    t = re.sub(r"Oorja\s*Man|Oorjaman|OORJAMAN", "Oorja-Man", text, flags=re.I)
    return re.sub(r"\s+", " ", t).strip()


def google_hi_tts(text: str, out_mp3: Path) -> None:
    """Google Translate TTS (gTTS) — Hindi, same engine as translate.google.com listen."""
    from gtts import gTTS

    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    gTTS(text=text, lang="hi", slow=False).save(str(out_mp3))
    if out_mp3.stat().st_size < 200:
        raise DemoError(f"gTTS returned empty audio for {text!r}")


def elevenlabs_speech_to_speech(src_audio: Path, out_mp3: Path) -> dict:
    """Map source audio onto ELEVENLABS_VOICE_ID (keeps pronunciation/timing).

    Requires the API key permission `speech_to_speech` (Voice Changer).
    """
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or "").strip()
    voice_id = (os.environ.get("ELEVENLABS_VOICE_ID") or "").strip()
    if not key or not voice_id:
        raise DemoError("ElevenLabs credentials missing for speech-to-speech")

    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    audio_bytes = src_audio.read_bytes()
    last_err: Exception | None = None
    for model in ("eleven_multilingual_sts_v2", "eleven_english_sts_v2"):
        boundary = "----OorjamanBrandStsBoundary"
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="model_id"\r\n\r\n{model}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="audio"; filename="{src_audio.name}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode() + audio_bytes + f"\r\n--{boundary}--\r\n".encode()
        url = f"https://api.elevenlabs.io/v1/speech-to-speech/{voice_id}?output_format=mp3_44100_128"
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "xi-api-key": key,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                payload = resp.read()
            if len(payload) < 500:
                raise RuntimeError(f"STS tiny payload ({len(payload)} bytes)")
            out_mp3.write_bytes(payload)
            return {"provider": "elevenlabs_sts", "voice_id": voice_id, "model": model}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:400]
            last_err = RuntimeError(f"HTTP {exc.code}: {detail}")
            if exc.code in (401, 403) and "speech_to_speech" in detail:
                raise DemoError(
                    "ElevenLabs API key missing permission speech_to_speech "
                    "(enable Voice Changer on the key, then retry)"
                ) from last_err
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise DemoError(f"ElevenLabs speech-to-speech failed: {last_err}")


def elevenlabs_brand_tts_to_wav(out_wav: Path) -> dict:
    """ElevenLabs TTS of Hindi brand spelling — same voice persona as body VO."""
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or "").strip()
    voice = (os.environ.get("ELEVENLABS_VOICE_ID") or "").strip()
    if not key or not voice:
        raise DemoError("ElevenLabs credentials missing for brand TTS")

    preferred = (os.environ.get("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2").strip()
    models: list[str] = []
    for m in (preferred, "eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_v3"):
        if m and m not in models:
            models.append(m)

    out_wav.parent.mkdir(parents=True, exist_ok=True)
    mp3 = out_wav.with_suffix(".mp3")
    last_err: Exception | None = None
    for model in models:
        body = json.dumps(
            {
                "text": BRAND_SPOKEN,
                "model_id": model,
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.12,
                    "use_speaker_boost": True,
                },
            }
        ).encode()
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128"
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "xi-api-key": key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                audio = resp.read()
            if len(audio) < 500:
                raise RuntimeError(f"tiny payload ({len(audio)} bytes)")
            mp3.write_bytes(audio)
            _ffmpeg_to_wav(mp3, out_wav)
            return {
                "provider": "elevenlabs_brand_hi",
                "voice_id": voice,
                "model": model,
                "text": BRAND_SPOKEN,
                "duration_sec": _wav_duration(out_wav),
            }
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:300]
            last_err = RuntimeError(f"HTTP {exc.code} model={model}: {detail}")
            if exc.code in (401, 403):
                break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
    raise DemoError(f"ElevenLabs brand Hindi TTS failed: {last_err}")


def _wav_duration(path: Path) -> float:
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


def _ffmpeg_to_wav(src: Path, dst: Path) -> None:
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-ac",
            "2",
            "-ar",
            "48000",
            str(dst),
        ],
        timeout=60,
    )


def elevenlabs_configured() -> bool:
    provider = (os.environ.get("TTS_PROVIDER") or "").strip().lower()
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or "").strip()
    voice = (os.environ.get("ELEVENLABS_VOICE_ID") or "").strip()
    if provider and provider not in ("elevenlabs", "eleven", "el"):
        return False
    return bool(key and voice)


def elevenlabs_tts_to_wav(text: str, out_wav: Path) -> dict:
    """Call ElevenLabs TTS → mp3 → wav. Returns meta including model used."""
    key = (os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY") or "").strip()
    voice = (os.environ.get("ELEVENLABS_VOICE_ID") or "").strip()
    preferred = (os.environ.get("ELEVENLABS_MODEL_ID") or "eleven_multilingual_v2").strip()
    if not key or not voice:
        raise DemoError("ElevenLabs credentials missing in scripts/product-demo/.env")

    models: list[str] = []
    for m in (preferred, "eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_v3"):
        if m and m not in models:
            models.append(m)

    formats: list[str] = []
    env_fmt = (os.environ.get("ELEVENLABS_OUTPUT_FORMAT") or "").strip()
    if env_fmt:
        formats.append(env_fmt)
    for fmt in ("mp3_44100_128", "mp3_44100_192", "mp3_44100_64"):
        if fmt not in formats:
            formats.append(fmt)

    payload_base = {
        "text": spoken(text),
        "voice_settings": {
            # Match scripts/future-film/lib/voiceover.py ElevenLabs settings
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.12,
            "use_speaker_boost": True,
        },
    }

    out_wav.parent.mkdir(parents=True, exist_ok=True)
    mp3 = out_wav.with_suffix(".mp3")
    last_err: Exception | None = None

    for model in models:
        for fmt in formats:
            body = dict(payload_base)
            body["model_id"] = model
            data = json.dumps(body).encode()
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format={fmt}"
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "xi-api-key": key,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    audio = resp.read()
                if len(audio) < 500:
                    raise RuntimeError(f"ElevenLabs returned tiny payload ({len(audio)} bytes)")
                mp3.write_bytes(audio)
                _ffmpeg_to_wav(mp3, out_wav)
                return {
                    "provider": "elevenlabs",
                    "voice_id": voice,
                    "model": model,
                    "format": fmt,
                    "duration_sec": _wav_duration(out_wav),
                }
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:300]
                last_err = RuntimeError(f"HTTP {exc.code} model={model} fmt={fmt}: {detail}")
                if exc.code in (401, 403):
                    break
            except Exception as exc:  # noqa: BLE001
                last_err = exc
        if isinstance(last_err, RuntimeError) and ("HTTP 401" in str(last_err) or "HTTP 403" in str(last_err)):
            break

    raise DemoError(f"ElevenLabs TTS failed: {last_err}")


def split_brand_lead(text: str) -> tuple[bool, str]:
    """If line starts with OorjaMan, return (True, remainder without brand)."""
    m = BRAND_RE.match(text.strip())
    if not m:
        return False, text
    rest = text.strip()[m.end() :].strip()
    rest = re.sub(r"^[—\-–:,.\s]+", "", rest).strip()
    return True, rest


def _concat_wavs(parts: list[Path], out_wav: Path, *, gap_ms: int = 90) -> float:
    """Concatenate wavs with a short gap (for brand + rest)."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    if len(parts) == 1:
        sh(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(parts[0]),
                "-ac",
                "2",
                "-ar",
                "48000",
                str(out_wav),
            ],
            timeout=60,
        )
        return _wav_duration(out_wav)

    silence = out_wav.with_name(out_wav.stem + "_gap.wav")
    if gap_ms > 0:
        sh(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=48000:cl=stereo",
                "-t",
                f"{gap_ms / 1000.0:.3f}",
                str(silence),
            ],
            timeout=30,
        )
    lst = out_wav.with_suffix(".concat.txt")
    lines = []
    for i, p in enumerate(parts):
        lines.append(f"file '{p}'")
        if gap_ms > 0 and i < len(parts) - 1:
            lines.append(f"file '{silence}'")
    lst.write_text("\n".join(lines) + "\n")
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
            "-ac",
            "2",
            "-ar",
            "48000",
            str(out_wav),
        ],
        timeout=60,
    )
    return _wav_duration(out_wav)


def ensure_brand_clip(*, voice: str, rate: int, force: bool = False) -> Path:
    """Canonical brand take — identical on open and close.

    Prefer: Google Hindi pronunciation → ElevenLabs speech-to-speech (same voice ID).
    Fallback (if API key lacks speech_to_speech): ElevenLabs TTS of Hindi ऊर्जा मैन.
    Last resort: Google Hindi alone.
    """
    work = PROD / "audio" / "_beats"
    work.mkdir(parents=True, exist_ok=True)
    brand = work / "brand_oorjaman.wav"
    if brand.exists() and brand.stat().st_size > 1000 and not force:
        return brand

    hi_mp3 = work / "brand_oorjaman_hi.mp3"
    print(f"=== Brand clip for {BRAND_SPOKEN!r} ===", flush=True)
    google_hi_tts(BRAND_SPOKEN, hi_mp3)

    if elevenlabs_configured():
        sts_mp3 = work / "brand_oorjaman_sts.mp3"
        try:
            meta = elevenlabs_speech_to_speech(hi_mp3, sts_mp3)
            print(f"  STS (Google→ElevenLabs voice) model={meta.get('model')}", flush=True)
            _ffmpeg_to_wav(sts_mp3, brand)
            return brand
        except DemoError as exc:
            print(f"  STS unavailable ({exc}); using ElevenLabs Hindi TTS", flush=True)
            meta = elevenlabs_brand_tts_to_wav(brand)
            print(f"  brand TTS model={meta.get('model')} dur={meta.get('duration_sec'):.3f}s", flush=True)
            return brand

    print("  ElevenLabs not configured — Google Hindi voice only", flush=True)
    _ffmpeg_to_wav(hi_mp3, brand)
    return brand


def say_to_wav(text: str, out_wav: Path, *, voice: str, rate: int) -> float:
    """macOS say fallback."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    aiff = out_wav.with_suffix(".aiff")
    txt = out_wav.with_suffix(".txt")
    txt.write_text(spoken(text) + "\n")
    sh(["say", "-v", voice, "-r", str(rate), "-f", str(txt), "-o", str(aiff)], timeout=120)
    _ffmpeg_to_wav(aiff, out_wav)
    return _wav_duration(out_wav)


def synthesize_line(text: str, out_wav: Path, *, voice: str, rate: int) -> tuple[float, dict]:
    """Prefer ElevenLabs; fall back to macOS say. Returns (duration, meta).

    Lines that lead with OorjaMan stitch the same canonical brand wav + remainder,
    so open and close brand takes are identical.
    """
    has_brand, rest = split_brand_lead(text)
    meta: dict = {"provider": "elevenlabs" if elevenlabs_configured() else "macos_say"}

    if has_brand and rest:
        brand = ensure_brand_clip(voice=voice, rate=rate)
        rest_wav = out_wav.with_name(out_wav.stem + "_rest.wav")
        if elevenlabs_configured():
            meta.update(elevenlabs_tts_to_wav(rest, rest_wav))
        else:
            say_to_wav(rest, rest_wav, voice=voice, rate=rate)
            meta.update({"voice": voice, "rate": rate})
        dur = _concat_wavs([brand, rest_wav], out_wav, gap_ms=100)
        meta["duration_sec"] = dur
        meta["brand_clip"] = str(brand)
        return dur, meta

    if has_brand and not rest:
        # Brand-only line — use canonical clip as-is
        brand = ensure_brand_clip(voice=voice, rate=rate)
        sh(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(brand), "-ac", "2", "-ar", "48000", str(out_wav)], timeout=60)
        dur = _wav_duration(out_wav)
        return dur, {**meta, "duration_sec": dur, "brand_clip": str(brand)}

    if elevenlabs_configured():
        meta = elevenlabs_tts_to_wav(text, out_wav)
        return float(meta["duration_sec"]), meta
    dur = say_to_wav(text, out_wav, voice=voice, rate=rate)
    return dur, {"provider": "macos_say", "voice": voice, "rate": rate}


def generate_macos_voiceover(
    script_path: Path,
    out_aiff: Path,
    out_wav: Path,
    *,
    voice: str | None = None,
    rate: int | None = None,
) -> dict:
    """Legacy monolithic stem — prefer build_event_synced_vo for demos."""
    voice = voice or CFG["macos_voice"]
    rate = rate if rate is not None else int(CFG["macos_voice_rate"])
    if not script_path.exists():
        raise DemoError(f"Missing voiceover script {script_path}")
    text = script_path.read_text()
    if elevenlabs_configured():
        meta = elevenlabs_tts_to_wav(text, out_wav)
        write_json(PROD / "audio" / "voiceover-meta.json", meta)
        return meta
    out_aiff.parent.mkdir(parents=True, exist_ok=True)
    sh(["say", "-v", voice, "-r", str(rate), "-f", str(script_path), "-o", str(out_aiff)], timeout=180)
    _ffmpeg_to_wav(out_aiff, out_wav)
    dur = _wav_duration(out_wav)
    meta = {"provider": "macos_say", "voice": voice, "rate": rate, "duration_sec": dur, "wav": str(out_wav)}
    write_json(PROD / "audio" / "voiceover-meta.json", meta)
    return meta


def replace_voice_stem(src: Path) -> Path:
    if not src.exists():
        raise DemoError(f"Voice file not found: {src}")
    dst = PROD / "audio" / "voiceover.wav"
    _ffmpeg_to_wav(src, dst)
    write_json(
        PROD / "audio" / "voiceover-meta.json",
        {"voice": "external", "source": str(src), "wav": str(dst)},
    )
    return dst


def body_time_for_state(events: list[dict], state_after: str, recording_started_wall: float) -> float | None:
    for ev in events:
        if ev.get("state_after") == state_after and ev.get("action") != "recording_started":
            return max(0.0, float(ev["timestamp_wall"]) - recording_started_wall)
    return None


def build_event_synced_vo(
    events: list[dict],
    recording_started_wall: float,
    total_sec: float,
    *,
    open_sec: float,
    close_sec: float,
) -> tuple[Path, list[dict]]:
    """
    Place short VO lines at picture times derived from real events.
    picture_t = brand_open + body_relative_event_time
    """
    beats_path = PROD / "audio" / "voiceover-beats.json"
    if not beats_path.exists():
        raise DemoError(f"Missing {beats_path}")
    beats_cfg = json.loads(beats_path.read_text())
    voice = beats_cfg.get("voice") or CFG["macos_voice"]
    rate = int(beats_cfg.get("voice_rate") or CFG["macos_voice_rate"])
    work = PROD / "audio" / "_beats"
    work.mkdir(parents=True, exist_ok=True)

    provider = "elevenlabs" if elevenlabs_configured() else "macos_say"
    print(f"=== VO provider: {provider} ===", flush=True)

    placements: list[dict] = []
    line_meta: dict | None = None

    open_txt = beats_cfg["open"]["text"]
    open_wav = work / "open.wav"
    open_dur, line_meta = synthesize_line(open_txt, open_wav, voice=voice, rate=rate)
    placements.append(
        {
            "id": "open",
            "text": open_txt,
            "start": float(beats_cfg["open"].get("offset_in_open_sec", 1.2)),
            "duration": open_dur,
            "wav": open_wav,
        }
    )

    for b in beats_cfg["beats"]:
        body_t = body_time_for_state(events, b["anchor"], recording_started_wall)
        if body_t is None:
            print(f"  WARN: no event for anchor {b['anchor']} — skip {b['id']}", flush=True)
            continue
        body_t += float(b.get("delay_sec") or 0)
        start = open_sec + body_t
        wav = work / f"{b['id']}.wav"
        dur, line_meta = synthesize_line(b["text"], wav, voice=voice, rate=rate)
        placements.append(
            {
                "id": b["id"],
                "text": b["text"],
                "start": start,
                "duration": dur,
                "wav": wav,
                "body_t": body_t,
                "anchor": b["anchor"],
            }
        )

    close_txt = beats_cfg["close"]["text"]
    close_wav = work / "close.wav"
    close_dur, line_meta = synthesize_line(close_txt, close_wav, voice=voice, rate=rate)
    close_start = max(0.0, total_sec - close_sec + float(beats_cfg["close"].get("offset_in_close_sec", 1.0)))
    placements.append(
        {
            "id": "close",
            "text": close_txt,
            "start": close_start,
            "duration": close_dur,
            "wav": close_wav,
        }
    )

    placements.sort(key=lambda p: p["start"])
    for i, p in enumerate(placements):
        end = p["start"] + p["duration"]
        nxt = placements[i + 1]["start"] if i + 1 < len(placements) else total_sec - 0.3
        if end > nxt - 0.15:
            print(
                f"  WARN VO overlap risk: {p['id']} ends {end:.2f} next {nxt:.2f} (dur={p['duration']:.2f})",
                flush=True,
            )

    inputs: list[str] = []
    filters: list[str] = []
    for i, p in enumerate(placements):
        inputs += ["-i", str(p["wav"])]
        delay_ms = int(round(p["start"] * 1000))
        filters.append(f"[{i}:a]adelay={delay_ms}|{delay_ms},apad=whole_dur={total_sec:.3f}[a{i}]")
    mix_in = "".join(f"[a{i}]" for i in range(len(placements)))
    filters.append(
        f"{mix_in}amix=inputs={len(placements)}:duration=longest:dropout_transition=0:normalize=0,"
        f"alimiter=limit=0.92:attack=5:release=60[vo]"
    )
    out = PROD / "audio" / "voiceover.wav"
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            *inputs,
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[vo]",
            "-ac",
            "2",
            "-ar",
            "48000",
            "-t",
            f"{total_sec:.3f}",
            str(out),
        ],
        timeout=180,
    )
    meta = {
        "provider": provider,
        "voice": voice if provider == "macos_say" else (line_meta or {}).get("voice_id"),
        "model": (line_meta or {}).get("model"),
        "rate": rate if provider == "macos_say" else None,
        "synced": True,
        "duration_sec": total_sec,
        "wav": str(out),
        "music": "local_score",
        "placements": [
            {k: (str(v) if k == "wav" else v) for k, v in p.items()} for p in placements
        ],
    }
    write_json(PROD / "audio" / "voiceover-meta.json", meta)
    write_json(PROD / "audio" / "voiceover-placements.json", meta["placements"])
    return out, placements


def mix_master(vo: Path, music: Path, out_wav: Path, total_sec: float) -> Path:
    """Mix local score + narration. Music path is always the project score file."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    sh(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-stream_loop",
            "-1",
            "-i",
            str(music),
            "-i",
            str(vo),
            "-filter_complex",
            f"[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"atrim=0:{total_sec:.3f},volume=0.12[mus];"
            f"[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"apad=whole_dur={total_sec:.3f},atrim=0:{total_sec:.3f},volume=1.05[narr];"
            f"[mus][narr]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,"
            f"alimiter=limit=0.90:attack=5:release=80,aresample=48000[aout]",
            "-map",
            "[aout]",
            "-ac",
            "2",
            "-ar",
            "48000",
            "-t",
            f"{total_sec:.3f}",
            str(out_wav),
        ],
        timeout=180,
    )
    return out_wav


def ensure_voiceover() -> Path:
    wav = PROD / "audio" / "voiceover.wav"
    if wav.exists() and wav.stat().st_size > 1000:
        return wav
    aiff = PROD / "audio" / "voiceover-macos.aiff"
    generate_macos_voiceover(PROD / "audio" / "voiceover.txt", aiff, wav)
    return wav


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "generate":
        ensure_voiceover()
        print("VOICE OK", flush=True)
    else:
        print("Usage: audio.py generate", flush=True)
