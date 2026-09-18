#!/usr/bin/env python3
"""
Phase 3 scene recorder — extends Phase 2.5 validated automation.

Records natural-pace scene clips into scripts/product-demo/recordings/phase3/
using the same UAT accounts, future-dated booking, and assignment harness.

Usage:
  phase3_record.py all
  phase3_record.py scene-02-customer-home   # re-run one scene (requires prior state where needed)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import uiautomator2 as u2

# Reuse Phase 2 helpers (same validated login / booking / assign path)
sys.path.insert(0, str(Path(__file__).resolve().parent))
import phase2_automate as p2  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "recordings" / "phase3"
OUT.mkdir(parents=True, exist_ok=True)
STATE_PATH = OUT / "state.json"

CUST_SERIAL = p2.CUST_SERIAL
TECH_SERIAL = p2.TECH_SERIAL


def save_state(data: dict) -> None:
    prev = {}
    if STATE_PATH.exists():
        try:
            prev = json.loads(STATE_PATH.read_text())
        except Exception:
            prev = {}
    prev.update(data)
    STATE_PATH.write_text(json.dumps(prev, indent=2))


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    return json.loads(STATE_PATH.read_text())


def sh(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def start_record(serial: str, out_path: Path, time_limit: int | None = None) -> subprocess.Popen:
    if out_path.exists():
        out_path.unlink()
    common = [
        "--no-window",
        "--no-playback",
        "--max-size",
        "1080",
        "--video-bit-rate",
        "8M",
        "--no-audio",
    ]
    if time_limit:
        common.append(f"--time-limit={time_limit}")
    proc = subprocess.Popen(
        ["scrcpy", "-s", serial, "--record", str(out_path), *common],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2.2)
    return proc


def stop_record(proc: subprocess.Popen | None) -> None:
    if not proc:
        return
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    time.sleep(0.8)


def hold(seconds: float) -> None:
    time.sleep(seconds)


def dismiss_chrome(serial: str) -> None:
    """Kill browser if Maps / Chrome stole focus."""
    sh(["adb", "-s", serial, "shell", "am", "force-stop", "com.android.chrome"], check=False)
    sh(["adb", "-s", serial, "shell", "am", "force-stop", "com.google.android.apps.maps"], check=False)


def ensure_home_customer(cust) -> None:
    # Address picker residual
    if "SELECT SERVICE" in p2.joined(cust).upper():
        p2.click_any(cust, ["Home — Guwahati", "Guwahati"], timeout=2)
        hold(0.8)
    p2.click_any(cust, ["Home"], timeout=1.5)
    hold(0.6)


def ensure_home_tech(tech) -> None:
    p2.click_any(tech, ["Home"], timeout=2)
    hold(0.6)


def bootstrap_login() -> tuple:
    print("=== BOOTSTRAP LOGIN (Phase 2.5 path) ===", flush=True)
    for serial, pkg in ((CUST_SERIAL, p2.CUST_PKG), (TECH_SERIAL, p2.TECH_PKG)):
        p2.adb(serial, "shell", "pm", "clear", pkg, check=False)
        p2.grant_perms(serial, pkg)
        # Disable touch indicator / pointer location if somehow on
        p2.adb(serial, "shell", "settings", "put", "system", "pointer_location", "0", check=False)
        p2.adb(serial, "shell", "settings", "put", "system", "show_touches", "0", check=False)
        p2.launch(serial, pkg)
    hold(5)
    cust = u2.connect(CUST_SERIAL)
    tech = u2.connect(TECH_SERIAL)
    p2.advance_pre_login(cust, "customer")
    p2.advance_pre_login(tech, "technician")
    p2.login_email_otp(cust, "customer", p2.CUSTOMER_EMAIL)
    p2.login_email_otp(tech, "technician", p2.TECH_EMAIL)
    hold(1.2)
    ensure_home_customer(cust)
    ensure_home_tech(tech)
    save_state({"bootstrapped": True})
    return cust, tech


def record_scene_02(cust) -> Path:
    """Customer home linger — must show Home, not booking detail."""
    out = OUT / "scene-02-customer-home.mp4"
    print("=== SCENE 02 customer home ===", flush=True)
    ensure_home_customer(cust)
    hold(1.0)
    j = p2.joined(cust)
    if "Job Start Code" in j or "BOOK A VISIT" in j or "Booking confirmed" in j:
        # Dismiss detail / booking modal
        if cust(description="Close").exists:
            cust(description="Close").click()
            hold(0.8)
        p2.click_any(cust, ["Home"], timeout=2)
        hold(1.0)
        j = p2.joined(cust)
    if "Plan your next clean" not in j and "Book a visit" not in j:
        raise RuntimeError(f"not on Customer Home before record: {p2.texts(cust)[:18]}")
    print("  verified Customer Home UI", flush=True)
    cust.screenshot(str(OUT / "scene-02-verify-home.png"))
    rec = start_record(CUST_SERIAL, out)
    try:
        hold(2.5)
        cust.swipe_ext("up", scale=0.22)
        hold(3.0)
        cust.swipe_ext("down", scale=0.18)
        hold(4.0)
    finally:
        stop_record(rec)
    return out


def record_scene_02_clean() -> Path:
    """Fresh login → verified Home → replace scene-02 recording."""
    print("=== SCENE 02 CLEAN RE-RECORD ===", flush=True)
    # Immersive status (best-effort; compose also crops)
    for serial in (CUST_SERIAL, TECH_SERIAL):
        p2.adb(
            serial,
            "shell",
            "settings",
            "put",
            "global",
            "policy_control",
            "immersive.status=*",
            check=False,
        )
        p2.adb(serial, "shell", "settings", "put", "system", "show_touches", "0", check=False)
        p2.adb(serial, "shell", "settings", "put", "system", "pointer_location", "0", check=False)

    p2.adb(CUST_SERIAL, "shell", "pm", "clear", p2.CUST_PKG, check=False)
    p2.grant_perms(CUST_SERIAL, p2.CUST_PKG)
    p2.launch(CUST_SERIAL, p2.CUST_PKG)
    hold(5)
    cust = u2.connect(CUST_SERIAL)
    p2.advance_pre_login(cust, "customer")
    p2.login_email_otp(cust, "customer", p2.CUSTOMER_EMAIL)
    hold(1.5)
    ensure_home_customer(cust)
    # Dismiss address sheet if it appears on home
    if "SELECT SERVICE" in p2.joined(cust).upper():
        # Prefer staying on home: close sheet if possible, else select address then Home
        w, h = cust.window_size()
        cust.click(int(w * 0.5), int(h * 0.15))
        hold(0.5)
        p2.click_any(cust, ["Home"], timeout=1.5)
        hold(0.8)
    if "SELECT SERVICE" in p2.joined(cust).upper():
        p2.click_any(cust, ["Home — Guwahati", "Guwahati"], timeout=2)
        hold(1.0)
        p2.click_any(cust, ["Home"], timeout=2)
        hold(1.0)

    j = p2.joined(cust)
    ok = ("Plan your next clean" in j or "Book a visit" in j) and "Job Start Code" not in j
    if not ok:
        raise RuntimeError(f"Customer Home verification failed: {p2.texts(cust)[:20]}")
    print("  PRE-RECORD VERIFY OK:", p2.texts(cust)[:12], flush=True)
    path = record_scene_02(cust)
    # Post-verify first frame via screenshot already; also dump hierarchy marker
    save_state({"scene_02_verified_home": True})
    print(f"SCENE02_FIXED={path}", flush=True)
    return path


def record_scene_03(cust) -> Path:
    """Booking journey through pay-after-service (natural pace)."""
    out = OUT / "scene-03-booking.mp4"
    print("=== SCENE 03 booking ===", flush=True)
    ensure_home_customer(cust)
    hold(0.8)
    rec = start_record(CUST_SERIAL, out)
    try:
        hold(1.2)
        # Slow booking — reuse navigation but with pauses for camera
        if "SELECT SERVICE" in p2.joined(cust).upper():
            p2.click_any(cust, ["Home — Guwahati", "Guwahati"], timeout=3)
            hold(1.2)
        if not p2.click_any(cust, ["Book a visit", "Book visit"], timeout=5):
            raise RuntimeError("Book a visit missing")
        hold(2.0)
        p2.wait_until(lambda: "Book one-time" in p2.joined(cust), timeout=12, label="book options")
        hold(1.0)
        p2.click_any(cust, ["Book one-time visit", "one-time visit"], timeout=4)
        hold(2.0)
        p2.click_any(cust, ["Continue"], timeout=3)
        hold(2.0)
        # Schedule — tomorrow
        target_day = p2.calendar_day_candidates(1)[0]
        for day in p2.calendar_day_candidates(1):
            nodes = cust(text=day)
            if nodes.count < 1:
                continue
            try:
                nodes[0].click()
                print(f"  selected day {day}", flush=True)
                hold(1.5)
                break
            except Exception:
                continue
        hold(1.0)
        cust.swipe_ext("up", scale=0.4)
        hold(1.0)
        for frag in ("12:00", "1:00", "2:00", "3:00"):
            if cust(textContains=frag).exists:
                cust(textContains=frag).click()
                hold(1.5)
                break
        p2.click_any(cust, ["Continue"], timeout=3)
        hold(2.0)
        p2.click_any(cust, ["Continue"], timeout=3)
        hold(2.0)
        p2.click_any(cust, ["Pay after service"], timeout=4)
        hold(3.5)
        save_state({"selected_day": target_day, "at_payment": True})
    finally:
        stop_record(rec)
    return out


def record_scene_04(cust) -> Path:
    """Confirm booking."""
    out = OUT / "scene-04-confirmation.mp4"
    print("=== SCENE 04 confirmation ===", flush=True)
    rec = start_record(CUST_SERIAL, out)
    try:
        hold(1.5)
        p2.confirm_pay_later(cust)
        hold(4.0)
        save_state({"booking_confirmed": True})
    finally:
        stop_record(rec)
    return out


def record_scene_05(cust, tech) -> Path:
    """Two-panel raw pair: customer confirmed + tech receives assignment."""
    left = OUT / "scene-05-assignment-customer.mp4"
    right = OUT / "scene-05-assignment-technician.mp4"
    print("=== SCENE 05 assignment (dual) ===", flush=True)
    # Customer stays on confirmation; tech on Jobs Upcoming
    p2.tech_open_jobs(tech, prefer_segment="upcoming")
    hold(1.0)
    rc = start_record(CUST_SERIAL, left)
    rt = start_record(TECH_SERIAL, right)
    try:
        hold(2.5)
        assigned = p2.assign_booking()
        save_state({"assignment": assigned})
        ref = assigned.get("reference_code")
        hold(1.5)
        # Tech refresh until reference appears
        if ref:

            def visible():
                p2.click_jobs_segment(tech, "Upcoming")
                tech.swipe_ext("down", scale=0.5)
                hold(0.9)
                if ref in p2.joined(tech):
                    return True
                for _ in range(4):
                    tech.swipe_ext("up", scale=0.5)
                    hold(0.5)
                    if ref in p2.joined(tech):
                        return True
                return False

            p2.wait_until(visible, timeout=40, label=f"assign visible {ref}")
        hold(4.0)
    finally:
        stop_record(rc)
        stop_record(rt)
    return left


def record_scene_06(tech) -> Path:
    """Technician opens assigned job detail."""
    out = OUT / "scene-06-technician-job.mp4"
    print("=== SCENE 06 technician job ===", flush=True)
    st = load_state()
    ref = (st.get("assignment") or {}).get("reference_code")
    rec = start_record(TECH_SERIAL, out)
    try:
        hold(1.5)
        p2.tech_wait_and_open_assigned(tech, reference_code=ref)
        hold(2.0)
        tech.swipe_ext("up", scale=0.35)
        hold(2.5)
        tech.swipe_ext("up", scale=0.3)
        hold(3.0)
    finally:
        stop_record(rec)
    return out


def record_scene_07(tech) -> Path:
    """Execution beats: Start visit → enter code → safety (skip full photos)."""
    out = OUT / "scene-07-technician-execution.mp4"
    print("=== SCENE 07 technician execution ===", flush=True)
    st = load_state()
    code = (st.get("assignment") or {}).get("booking_code") or ""
    dismiss_chrome(TECH_SERIAL)
    rec = start_record(TECH_SERIAL, out)
    try:
        hold(1.5)
        # Prefer Start visit — En route may open Maps
        if not p2.click_any(tech, ["Start visit on site", "Continue visit"], timeout=4):
            # Try en route carefully
            if p2.click_any(tech, ["En route to customer"], timeout=2):
                hold(2.0)
                dismiss_chrome(TECH_SERIAL)
                p2.launch(TECH_SERIAL, p2.TECH_PKG)
                hold(2.0)
                st2 = load_state()
                ref = (st2.get("assignment") or {}).get("reference_code")
                p2.tech_wait_and_open_assigned(tech, reference_code=ref)
                p2.click_any(tech, ["Start visit on site", "Continue visit"], timeout=4)
        hold(2.5)
        # Job Start Code screen
        if code:
            # Prefer EditText set_text
            edits = tech(className="android.widget.EditText")
            if edits.exists:
                try:
                    edits[0].click()
                    hold(0.4)
                    edits[0].set_text(code)
                    hold(1.0)
                except Exception:
                    sh(["adb", "-s", TECH_SERIAL, "shell", "input", "text", code], check=False)
                    hold(1.0)
            print(f"  entered start code len={len(code)}", flush=True)
        hold(1.2)
        p2.click_any(tech, ["Continue", "Verify", "Next"], timeout=3)
        hold(2.0)
        # Safety checkboxes — tap each unchecked row heuristically
        for label in (
            "aware",
            "guidelines",
            "Job Start",
            "PPE",
            "safety",
            "reviewed",
        ):
            if tech(textContains=label).exists:
                try:
                    tech(textContains=label).click()
                    hold(0.7)
                except Exception:
                    pass
        # Also try clicking checkboxes by class
        for i in range(min(tech(className="android.widget.CheckBox").count, 6)):
            try:
                cb = tech(className="android.widget.CheckBox")[i]
                if not cb.info.get("checked"):
                    cb.click()
                    hold(0.5)
            except Exception:
                break
        hold(1.5)
        p2.click_any(tech, ["Continue", "Next"], timeout=3)
        hold(3.5)
    finally:
        stop_record(rec)
        dismiss_chrome(TECH_SERIAL)
    return out


def record_scene_08(cust, tech) -> Path:
    """Connected two-panel: customer booking detail | tech job/execute."""
    left = OUT / "scene-08-connected-customer.mp4"
    right = OUT / "scene-08-connected-technician.mp4"
    print("=== SCENE 08 connected ===", flush=True)
    st = load_state()
    ref = (st.get("assignment") or {}).get("reference_code")

    # Customer → bookings → open latest / detail with Job Start Code
    if "Booking confirmed" in p2.joined(cust):
        p2.click_any(cust, ["View My bookings"], timeout=3)
    else:
        p2.click_any(cust, ["Bookings"], timeout=3)
    hold(1.5)
    # Open first booking card / detail
    if ref and cust(textContains=ref.replace("OM-", "")).exists:
        pass
    p2.click_any(cust, ["Tap for details", "Technician assigned", "Assigned"], timeout=2)
    # Tap near top booking row
    if "Job Start Code" not in p2.joined(cust):
        w, h = cust.window_size()
        cust.click(w // 2, int(h * 0.28))
        hold(1.5)
    hold(1.0)

    # Tech back to job detail if possible
    dismiss_chrome(TECH_SERIAL)
    p2.launch(TECH_SERIAL, p2.TECH_PKG)
    hold(2.0)
    try:
        p2.tech_wait_and_open_assigned(tech, reference_code=ref)
    except Exception as e:
        print(f"  tech reopen note: {e}", flush=True)

    rc = start_record(CUST_SERIAL, left)
    rt = start_record(TECH_SERIAL, right)
    try:
        hold(2.0)
        cust.swipe_ext("up", scale=0.3)
        hold(2.0)
        tech.swipe_ext("up", scale=0.25)
        hold(4.0)
    finally:
        stop_record(rc)
        stop_record(rt)
    return left


def record_scene_09(cust) -> Path:
    """Customer completion/status surface."""
    out = OUT / "scene-09-completion.mp4"
    print("=== SCENE 09 completion / status ===", flush=True)
    p2.click_any(cust, ["Bookings"], timeout=2)
    hold(1.0)
    rec = start_record(CUST_SERIAL, out)
    try:
        hold(2.0)
        if "Job Start Code" not in p2.joined(cust):
            w, h = cust.window_size()
            cust.click(w // 2, int(h * 0.28))
            hold(2.0)
        cust.swipe_ext("up", scale=0.3)
        hold(3.5)
        cust.swipe_ext("down", scale=0.2)
        hold(2.5)
    finally:
        stop_record(rec)
    return out


def record_all() -> None:
    cust, tech = bootstrap_login()
    record_scene_02(cust)
    record_scene_03(cust)
    record_scene_04(cust)
    record_scene_05(cust, tech)
    record_scene_06(tech)
    record_scene_07(tech)
    record_scene_08(cust, tech)
    record_scene_09(cust)
    # Brand scenes generated at compose time
    meta = {
        "scenes": [
            "scene-01-opening",
            "scene-02-customer-home",
            "scene-03-booking",
            "scene-04-confirmation",
            "scene-05-assignment",
            "scene-06-technician-job",
            "scene-07-technician-execution",
            "scene-08-connected-state",
            "scene-09-completion",
            "scene-10-closing",
        ],
        "state": load_state(),
    }
    (OUT / "manifest.json").write_text(json.dumps(meta, indent=2))
    print(f"MANIFEST={OUT / 'manifest.json'}", flush=True)


def main() -> int:
    mode = (sys.argv[1] if len(sys.argv) > 1 else "all").strip()
    if mode == "all":
        record_all()
        return 0
    if mode in ("scene-02-customer-home", "scene-02"):
        record_scene_02_clean()
        return 0
    raise SystemExit(f"Unknown mode {mode}; use: all | scene-02-customer-home")


if __name__ == "__main__":
    raise SystemExit(main())
