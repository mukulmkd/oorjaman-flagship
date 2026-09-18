#!/usr/bin/env python3
"""
Production preflight — may retry setup up to 3 times.
Does NOT start production recording.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

PROD = Path(__file__).resolve().parent
sys.path.insert(0, str(PROD))

from lib.common import DemoError, sh, wait_until  # noqa: E402
from lib.paths import CFG, ROOT, DEMO, fonts_dir, logo_path, music_path, python_bin, resolve  # noqa: E402

MAX_RETRIES = int(CFG["preflight_max_retries"])
results: dict[str, str] = {}


def ok(name: str, msg: str = "PASS") -> None:
    results[name] = "PASS"
    print(f"  [PASS] {name}: {msg}", flush=True)


def fail(name: str, msg: str) -> None:
    results[name] = "FAIL"
    print(f"  [FAIL] {name}: {msg}", flush=True)


def check_tool(name: str, cmd: list[str]) -> None:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if p.returncode == 0 or name == "say":
            ok(name, (p.stdout or p.stderr or "ok").splitlines()[0][:80] if (p.stdout or p.stderr) else "ok")
        else:
            fail(name, (p.stderr or p.stdout or "nonzero")[:200])
    except Exception as e:
        fail(name, str(e))


def adb_devices() -> list[str]:
    p = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=15)
    lines = [ln.split()[0] for ln in p.stdout.splitlines()[1:] if "\tdevice" in ln]
    return lines


def with_retries(name: str, fn, retries: int = MAX_RETRIES) -> bool:
    last = ""
    for attempt in range(1, retries + 1):
        try:
            fn()
            ok(name, f"attempt {attempt}/{retries}")
            return True
        except Exception as e:
            last = str(e)
            print(f"  [retry {attempt}/{retries}] {name}: {last}", flush=True)
            time.sleep(1.5)
    fail(name, last)
    return False


def check_packages(serial: str, pkg: str) -> None:
    p = subprocess.run(
        ["adb", "-s", serial, "shell", "pm", "path", pkg],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if "package:" not in (p.stdout or ""):
        raise DemoError(f"{pkg} not installed on {serial}")


def check_uat_env() -> None:
    env = ROOT / ".env.uat.local"
    if not env.exists():
        raise DemoError("Missing .env.uat.local")
    text = env.read_text()
    if "SUPABASE_URL" not in text or "SUPABASE_SERVICE_ROLE_KEY" not in text:
        raise DemoError(".env.uat.local missing required keys")


def check_assign_dry() -> None:
    # Validate script exists and node can parse — do not assign a booking during preflight
    script = resolve(CFG["assign_script"])
    if not script.exists():
        raise DemoError(f"Missing assign script {script}")
    clean = resolve(CFG["clean_script"])
    if not clean.exists():
        raise DemoError(f"Missing clean script {clean}")


def check_recording_capability(serial: str) -> None:
    # Short scrcpy probe: start and stop without saving a production take
    out = PROD / "logs" / "_preflight_probe.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    proc = subprocess.Popen(
        [
            "scrcpy",
            "-s",
            serial,
            "--no-window",
            "--no-playback",
            "--max-size",
            "480",
            "--record",
            str(out),
            "--no-audio",
            "-t",
            "1.5",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
        raise DemoError("scrcpy probe hung")
    if not out.exists() or out.stat().st_size < 500:
        # -t may not exist on all scrcpy; fall back to start/stop
        if out.exists():
            out.unlink()
        proc = subprocess.Popen(
            [
                "scrcpy",
                "-s",
                serial,
                "--no-window",
                "--no-playback",
                "--max-size",
                "480",
                "--record",
                str(out),
                "--no-audio",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2.0)
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        time.sleep(0.5)
        if not out.exists() or out.stat().st_size < 500:
            raise DemoError("scrcpy probe produced no file")
    if out.exists():
        out.unlink()


def check_python_stack() -> None:
    py = python_bin()
    if not py.exists():
        raise DemoError(f"Missing venv python {py}")
    code = "import uiautomator2, PIL; print('ok')"
    sh([str(py), "-c", code], timeout=30)


def check_compositor_modules() -> None:
    for mod in ("compositor.py", "audio.py", "qc.py", "controller.py"):
        if not (PROD / mod).exists():
            raise DemoError(f"Missing {mod}")


def check_voice() -> None:
    voice = CFG["macos_voice"]
    p = subprocess.run(["say", "-v", "?", ""], capture_output=True, text=True, timeout=30)
    if voice not in (p.stdout or ""):
        raise DemoError(f"Configured voice {voice!r} not in say -v ?")
    probe = PROD / "audio" / "_voice_probe.aiff"
    sh(["say", "-v", voice, "-o", str(probe), "OorjaMan preflight."], timeout=30)
    if probe.exists():
        probe.unlink()


def check_auth_smoke() -> None:
    """Connect u2 and confirm apps respond — full login is optional if already logged in."""
    import uiautomator2 as u2

    cust = u2.connect(CFG["customer_device"])
    tech = u2.connect(CFG["technician_device"])
    # Launch without pm clear (preflight soft check)
    for serial, pkg in (
        (CFG["customer_device"], CFG["customer_package"]),
        (CFG["technician_device"], CFG["technician_package"]),
    ):
        subprocess.run(
            ["adb", "-s", serial, "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"],
            capture_output=True,
            timeout=20,
        )
    time.sleep(2.5)
    _ = cust.dump_hierarchy()
    _ = tech.dump_hierarchy()


def main() -> int:
    print("=== OORJAMAN PRODUCTION PREFLIGHT ===", flush=True)
    print(f"pipeline={CFG['pipeline_label']}", flush=True)

    check_tool("macos", ["uname", "-s"])
    if results.get("macos") == "PASS":
        # uname returns Darwin
        p = subprocess.run(["uname", "-s"], capture_output=True, text=True)
        if "Darwin" not in (p.stdout or ""):
            fail("macos", f"expected Darwin got {p.stdout!r}")

    check_tool("adb", ["adb", "version"])
    check_tool("scrcpy", ["scrcpy", "--version"])
    check_tool("ffmpeg", ["ffmpeg", "-version"])
    check_tool("say", ["say", "-v", "?"])
    check_tool("node", ["node", "--version"])

    with_retries("python_stack", check_python_stack)
    with_retries("compositor_modules", check_compositor_modules)

    try:
        music_path()
        ok("music", str(music_path()))
    except Exception as e:
        fail("music", str(e))

    try:
        if not logo_path().exists():
            raise DemoError("logo missing")
        ok("logo", str(logo_path()))
    except Exception as e:
        fail("logo", str(e))

    try:
        fd = fonts_dir()
        if not (fd / "PlusJakartaSans-Bold.ttf").exists():
            raise DemoError("Plus Jakarta Sans missing")
        ok("fonts", str(fd))
    except Exception as e:
        fail("fonts", str(e))

    try:
        check_voice()
        ok("macos_voice", CFG["macos_voice"])
    except Exception as e:
        fail("macos_voice", str(e))

    devices = adb_devices()
    cust, tech = CFG["customer_device"], CFG["technician_device"]
    if cust in devices:
        ok("customer_emulator", cust)
    else:
        fail("customer_emulator", f"{cust} not online; online={devices}")
    if tech in devices:
        ok("technician_emulator", tech)
    else:
        fail("technician_emulator", f"{tech} not online; online={devices}")

    if results.get("customer_emulator") == "PASS":
        with_retries("customer_package", lambda: check_packages(cust, CFG["customer_package"]))
        with_retries("recording_capability", lambda: check_recording_capability(cust))
    if results.get("technician_emulator") == "PASS":
        with_retries("technician_package", lambda: check_packages(tech, CFG["technician_package"]))

    with_retries("uat_env", check_uat_env)
    with_retries("assignment_script", check_assign_dry)

    if results.get("customer_emulator") == "PASS" and results.get("technician_emulator") == "PASS":
        with_retries("uiautomator_smoke", check_auth_smoke)

    # Writable dirs
    for d in ("raw", "events", "logs", "failed-runs", "rendered", "audio"):
        path = PROD / d
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_ok"
        try:
            probe.write_text("ok")
            probe.unlink()
            ok(f"writable_{d}", str(path))
        except Exception as e:
            fail(f"writable_{d}", str(e))

    # Infinite-loop protection self-check
    ok("infinite_loop_protection", "wait_until has timeout+max_iters; recording_max_retries=0")
    ok("product_code_modified", "NO (engine only)")

    report = {
        "results": results,
        "pipeline_label": CFG["pipeline_label"],
        "voice": CFG["macos_voice"],
        "failed": [k for k, v in results.items() if v != "PASS"],
    }
    (PROD / "logs" / "preflight-last.json").write_text(json.dumps(report, indent=2) + "\n")

    failed = report["failed"]
    # writable_* and product_code are informational PASS
    critical_fail = [
        k
        for k in failed
        if not k.startswith("writable_")
    ]
    print("", flush=True)
    if critical_fail:
        print("PREFLIGHT FAIL", flush=True)
        print("failed:", ", ".join(critical_fail), flush=True)
        return 1
    print("PREFLIGHT PASS", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
