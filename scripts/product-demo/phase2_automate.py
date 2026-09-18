#!/usr/bin/env python3
"""
Phase 2 sync-test automation for OorjaMan UAT dual-emulator demo.

Modes:
  prepare  — clear/login both apps; leave customer on payment step; tech on Jobs
  record   — short synchronized booking confirm → assign → tech opens job
  all      — prepare then record (default)

Env:
  CUSTOMER_DEVICE, TECHNICIAN_DEVICE (adb serials)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

import uiautomator2 as u2

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "recordings" / "phase2"
OUT.mkdir(parents=True, exist_ok=True)

CUST_SERIAL = os.environ.get("CUSTOMER_DEVICE", "emulator-5554")
TECH_SERIAL = os.environ.get("TECHNICIAN_DEVICE", "emulator-5556")
CUST_PKG = "com.oorjaman.customer.uat"
TECH_PKG = "com.oorjaman.technician.uat"

CUSTOMER_EMAIL = "appreview.customer@oorjaman.com"
TECH_EMAIL = "amit.das@gamusagreen.in"
DUMMY_OTP = "123456"

PY = ROOT / "tmp" / "demo-venv" / "bin" / "python"
ASSIGN = ROOT / "scripts" / "product-demo" / "phase2_assign_booking.mjs"


def sh(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def adb(serial: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return sh(["adb", "-s", serial, *args], check=check)


def texts(d) -> list[str]:
    xml = d.dump_hierarchy()
    return [n.attrib.get("text", "") for n in ET.fromstring(xml).iter("node") if n.attrib.get("text")]


def joined(d) -> str:
    return " ".join(texts(d))


def click_any(d, labels: list[str], timeout: float = 2.0, settle: float = 0.7) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        for label in labels:
            if d(text=label).exists:
                print(f"  click text={label!r}", flush=True)
                d(text=label).click()
                time.sleep(settle)
                return True
            if d(description=label).exists:
                print(f"  click desc={label!r}", flush=True)
                d(description=label).click()
                time.sleep(settle)
                return True
            if d(textContains=label).exists:
                print(f"  click contains={label!r}", flush=True)
                d(textContains=label).click()
                time.sleep(settle)
                return True
        time.sleep(0.12)
    return False


def click_jobs_segment(d, name: str, timeout: float = 2.5) -> bool:
    """Click Today/Upcoming/Active/Done chips — avoid matching body copy that mentions them."""
    deadline = time.time() + timeout
    # Chip labels look like "Upcoming (2)" or bare "Active"
    patterns = [rf"^{name} \(\d+\)$", rf"^{name}$"]
    while time.time() < deadline:
        for pat in patterns:
            sel = d(textMatches=pat)
            if sel.exists:
                print(f"  click segment ~{pat!r}", flush=True)
                sel.click()
                time.sleep(0.7)
                return True
        time.sleep(0.2)
    return False


def grant_perms(serial: str, pkg: str) -> None:
    for perm in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
    ):
        adb(serial, "shell", "pm", "grant", pkg, perm, check=False)


def launch(serial: str, pkg: str) -> None:
    adb(
        serial,
        "shell",
        "monkey",
        "-p",
        pkg,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
        check=False,
    )


def advance_pre_login(d, label: str, max_steps: int = 24) -> None:
    print(f"[{label}] advance to login…", flush=True)
    for i in range(max_steps):
        # Session-expired / interstitial
        click_any(d, ["SIGN IN", "Sign in", "OK", "Dismiss"], timeout=0.4)
        t = texts(d)
        print(f"[{label}] {i}: {t[:8]}", flush=True)
        j = " ".join(t)
        if any(x in j for x in ("Email", "Send code", "Sign in with email", "Mobile OTP", "PARTNER SIGN-IN", "Password")):
            if "Session expired" not in j:
                return
        if click_any(
            d,
            ["Skip", "Not now", "Allow location", "Next", "Get started", "Continue", "Maybe later", "SIGN IN"],
            timeout=0.6,
        ):
            continue
        time.sleep(0.35)
    raise RuntimeError(f"{label}: could not reach login")


def login_email_otp(d, label: str, email: str) -> None:
    """UAT login: OTP 123456, or Play-review password UI when present."""
    print(f"[{label}] login {email}", flush=True)
    click_any(d, ["SIGN IN", "Sign in"], timeout=1.0)
    click_any(d, ["Email"], timeout=2)
    time.sleep(0.35)
    edits = d(className="android.widget.EditText")
    if edits.count < 1:
        raise RuntimeError(f"{label}: no EditText")
    edits[0].click()
    edits[0].clear_text()
    edits[0].set_text(email)
    time.sleep(1.0)

    # Play-review password path (newer UAT builds)
    j = joined(d)
    play_ui = (
        "Play review" in j
        or "fixed password" in j.lower()
        or (
            d(text="Password").exists
            and not d(text="Send code").exists
            and not d(textContains="Send code").exists
        )
    )
    if play_ui:
        print(f"[{label}] play-review password UI detected", flush=True)
        pwd = "OorjaManPlayReview2026!"
        edits = d(className="android.widget.EditText")
        if edits.count < 2:
            raise RuntimeError(f"{label}: password field missing")
        pwd_field = edits[1]
        pwd_field.click()
        time.sleep(0.35)
        # RN SecureTextEntry: set_text / clipboard paste often update the native
        # field visually without React onChangeText → Sign in stays disabled.
        # uiautomator2 send_keys reliably drives React state on current UAT builds.
        try:
            d.send_keys(pwd, clear=True)
        except Exception:
            # Fallback: clipboard paste
            for _ in range(40):
                adb(d.serial, "shell", "input", "keyevent", "67", check=False)
            d.set_clipboard(pwd)
            time.sleep(0.15)
            adb(d.serial, "shell", "input", "keyevent", "279", check=False)
        time.sleep(0.6)
        # Dismiss IME so the primary CTA is fully hittable
        adb(d.serial, "shell", "input", "keyevent", "4", check=False)
        time.sleep(0.35)
        # Prefer accessibilityLabel (Pressable), not the child TextView
        signed = False
        if d(description="Sign in").exists:
            d(description="Sign in").click()
            signed = True
        elif not click_any(d, ["Sign in"], timeout=3):
            raise RuntimeError(f"{label}: Sign in missing")
        else:
            signed = True
        if not signed:
            raise RuntimeError(f"{label}: Sign in missing")
        for _ in range(50):
            j2 = joined(d)
            if "Invalid login credentials" in j2:
                time.sleep(0.4)
                continue
            if "SELECT SERVICE" in j2 or "Hello" in j2 or "Book" in j2 or "Plan your" in j2 or "GGE" in j2:
                print(f"[{label}] logged in (password): {texts(d)[:14]}", flush=True)
                d.screenshot(str(OUT / f"{label}-logged-in.png"))
                return
            if "Sign in with email" not in j2 and "PARTNER SIGN-IN" not in j2 and "Password" not in j2:
                print(f"[{label}] logged in (password): {texts(d)[:14]}", flush=True)
                d.screenshot(str(OUT / f"{label}-logged-in.png"))
                return
            time.sleep(0.4)
        raise RuntimeError(f"{label}: password login failed: {texts(d)[:20]}")

    if not d(text="Send code").exists:
        d.press("back")
        time.sleep(0.25)
    if not click_any(d, ["Send code"], timeout=4):
        raise RuntimeError(f"{label}: Send code missing")

    otp = None
    for _ in range(30):
        node = d(description="One-time code")
        if node.exists and node.info.get("enabled"):
            otp = node
            break
        edits = d(className="android.widget.EditText")
        if edits.count >= 2 and edits[1].info.get("enabled"):
            otp = edits[1]
            break
        time.sleep(0.2)
    if otp is None:
        raise RuntimeError(f"{label}: OTP not enabled")
    otp.click()
    time.sleep(0.2)
    otp.set_text(DUMMY_OTP)

    for _ in range(40):
        j = joined(d)
        if "Invalid" in j:
            raise RuntimeError(f"{label}: login invalid: {j[:160]}")
        if "Sign in with email" not in j and "PARTNER SIGN-IN" not in j and "Send code" not in j:
            print(f"[{label}] logged in: {texts(d)[:14]}", flush=True)
            d.screenshot(str(OUT / f"{label}-logged-in.png"))
            return
        time.sleep(0.4)
    click_any(d, ["Verify & continue", "Verify and continue"], timeout=2)
    time.sleep(3)
    if "Sign in with email" in joined(d) or "PARTNER SIGN-IN" in joined(d):
        raise RuntimeError(f"{label}: still on login")


def ist_now() -> datetime:
    # Prefer zoneinfo; fall back to fixed +05:30 offset.
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Asia/Kolkata"))
    except Exception:
        return datetime.utcnow() + timedelta(hours=5, minutes=30)


def ist_day_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def calendar_day_candidates(offset_days: int = 1) -> list[str]:
    """Day-of-month strings to tap for a future IST schedule (relative to now)."""
    target = ist_now() + timedelta(days=max(1, offset_days))
    days = [str(target.day)]
    for extra in range(1, 8):
        d2 = (target + timedelta(days=extra)).day
        if str(d2) not in days:
            days.append(str(d2))
    return days


def wait_until(predicate, timeout: float, label: str, interval: float = 0.5) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            print(f"  wait OK: {label}", flush=True)
            return True
        time.sleep(interval)
    print(f"  wait FAIL: {label}", flush=True)
    return False


def customer_navigate_to_payment(d, schedule_offset_days: int = 1) -> str:
    """Navigate to payment. Returns the calendar day string intended for selection."""
    print(
        f"[customer] navigate to payment (schedule_offset_days={schedule_offset_days})…",
        flush=True,
    )
    # Address gate
    if "SELECT SERVICE" in joined(d).upper() or "Select service" in joined(d):
        click_any(d, ["Home — Guwahati", "Guwahati", "Home"], timeout=3, settle=0.35)
        time.sleep(0.35)

    if not click_any(d, ["Book a visit", "Book visit"], timeout=5, settle=0.35):
        d.screenshot(str(OUT / "customer-book-entry-fail.png"))
        raise RuntimeError(f"could not open Book a visit: {texts(d)[:20]}")
    time.sleep(0.45)

    if not wait_until(
        lambda: "Book one-time" in joined(d) or "one-time" in joined(d).lower(),
        timeout=12,
        label="book options",
        interval=0.15,
    ):
        d.screenshot(str(OUT / "customer-book-options-fail.png"))
        raise RuntimeError(f"book options not shown: {texts(d)[:25]}")

    if not click_any(d, ["Book one-time visit", "one-time visit"], timeout=4, settle=0.3):
        raise RuntimeError(f"could not choose one-time visit: {texts(d)[:20]}")
    time.sleep(0.45)

    # Partner step
    if "partner" in joined(d).lower() or "STEP 1" in joined(d) or "Continue" in joined(d):
        click_any(d, ["Continue"], timeout=3, settle=0.3)
        time.sleep(0.45)

    if not wait_until(
        lambda: any(x in joined(d) for x in ("STEP 2", "Pick a day", "Choose a day", "Select a day", "Time slot", "Available")),
        timeout=15,
        label="schedule step",
        interval=0.15,
    ):
        # Calendar day numerals alone also indicate schedule
        if not any(d(text=str(x)).exists for x in range(1, 29)):
            d.screenshot(str(OUT / "customer-schedule-step-fail.png"))
            raise RuntimeError(f"schedule step not shown: {texts(d)[:30]}")

    # If calendar is still on current month and target day is next month, tap next month.
    target = ist_now() + timedelta(days=max(1, schedule_offset_days))
    if ist_now().month != target.month or (ist_now().day > target.day and target.day < 7):
        if d(text="›").exists:
            d(text="›").click()
            time.sleep(0.25)

    selected_day = None
    candidates = calendar_day_candidates(schedule_offset_days)
    # Prefer later days when earlier ones may already be capacity-constrained in UAT
    for day in candidates:
        nodes = d(text=day)
        if nodes.count < 1:
            continue
        for i in range(min(nodes.count, 8)):
            try:
                node = nodes[i]
                info = node.info
                # Skip tiny / disabled-looking nodes when possible
                if info.get("enabled") is False:
                    continue
                node.click()
                selected_day = day
                print(f"  selected calendar day {day}", flush=True)
                break
            except Exception:
                continue
        if selected_day:
            break
        # Try advancing month once if day not clickable this month
        if d(text="›").exists:
            d(text="›").click()
            time.sleep(0.25)
    if not selected_day:
        d.screenshot(str(OUT / "customer-schedule-fail.png"))
        raise RuntimeError(f"could not select future day; tried {candidates}; ui={texts(d)[:30]}")

    # Time slots: wait briefly for list, then click first available (no 1s-per-slot lag)
    slot_labels = (
        "12:00 pm",
        "1:00 pm",
        "2:00 pm",
        "3:00 pm",
        "4:00 pm",
        "5:00 pm",
        "10:00 am",
        "11:00 am",
    )
    slot_frags = ("12:00", "1:00", "2:00", "3:00", "4:00", "5:00", "10:00", "11:00")

    def _slots_ready() -> bool:
        j = joined(d)
        if any(s in j for s in slot_labels):
            return True
        return any(d(textContains=f).exists for f in slot_frags)

    # Slots often appear below the fold — light nudge, then poll fast
    if not _slots_ready():
        d.swipe_ext("up", scale=0.35)
    if not wait_until(_slots_ready, timeout=3.5, label="time slots", interval=0.12):
        d.swipe_ext("up", scale=0.4)
        wait_until(_slots_ready, timeout=2.0, label="time slots retry", interval=0.12)

    slot_clicked = False
    for slot in slot_labels:
        if d(text=slot).exists:
            print(f"  click slot {slot!r}", flush=True)
            d(text=slot).click()
            slot_clicked = True
            time.sleep(0.2)
            break
    if not slot_clicked:
        for frag in slot_frags:
            if d(textContains=frag).exists:
                print(f"  click slot contains {frag}", flush=True)
                d(textContains=frag).click()
                slot_clicked = True
                time.sleep(0.2)
                break
    if not slot_clicked:
        # Last resort: short settle click_any across all labels at once
        slot_clicked = click_any(d, list(slot_labels), timeout=1.2, settle=0.2)
    if not slot_clicked:
        d.screenshot(str(OUT / "customer-schedule-fail.png"))
        raise RuntimeError(f"no time slot clicked: {texts(d)[:30]}")
    click_any(d, ["Continue"], timeout=2.5, settle=0.35)
    time.sleep(0.45)

    # Step 3 confirm → payment
    for _ in range(3):
        j = joined(d)
        if "How would you like to pay" in j or "STEP 4" in j:
            break
        if "STEP 3" in j or "Review & confirm" in j or "Review your visit" in j:
            click_any(d, ["Continue"], timeout=2.5, settle=0.35)
            time.sleep(0.45)
            continue
        break

    click_any(d, ["Pay after service"], timeout=2.5, settle=0.25)
    time.sleep(0.35)
    print(f"[customer] at payment: {texts(d)[:18]}", flush=True)
    d.screenshot(str(OUT / "customer-payment-ready.png"))
    if "Pay after service" not in joined(d) and "Book visit" not in joined(d) and "Proceed to pay" not in joined(d):
        raise RuntimeError(f"customer not on payment step: {texts(d)[:25]}")
    return selected_day


def tech_open_jobs(d, prefer_segment: str = "upcoming") -> None:
    print(f"[technician] open Jobs tab (prefer {prefer_segment})…", flush=True)
    click_any(d, ["Jobs", "View all jobs"], timeout=3)
    time.sleep(0.8)
    label = "Upcoming" if prefer_segment == "upcoming" else "Today"
    if not click_jobs_segment(d, label):
        click_jobs_segment(d, "Upcoming") or click_jobs_segment(d, "Today")
    time.sleep(0.6)
    d.screenshot(str(OUT / "technician-jobs-ready.png"))
    print(f"[technician] ready: {texts(d)[:16]}", flush=True)


def assign_booking() -> dict:
    print("[harness] assign latest booking…", flush=True)
    r = sh(["node", str(ASSIGN)], check=False)
    print(r.stdout or "", flush=True)
    if r.returncode != 0:
        print(r.stderr or "", flush=True)
        raise RuntimeError("assign harness failed")
    raw = (r.stdout or "").strip()
    # Prefer last JSON object in stdout
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.rfind("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            return json.loads(raw[start : end + 1])
        return {"ok": True, "raw": raw}

def start_scrcpy_records() -> tuple[subprocess.Popen, subprocess.Popen]:
    cust_mp4 = OUT / "customer-raw.mp4"
    tech_mp4 = OUT / "technician-raw.mp4"
    for p in (cust_mp4, tech_mp4):
        if p.exists():
            p.unlink()
    common = ["--no-window", "--no-playback", "--max-size", "1080", "--video-bit-rate", "6M", "--no-audio"]
    cust = subprocess.Popen(
        ["scrcpy", "-s", CUST_SERIAL, "--record", str(cust_mp4), *common],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    tech = subprocess.Popen(
        ["scrcpy", "-s", TECH_SERIAL, "--record", str(tech_mp4), *common],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2.0)
    return cust, tech


def stop_procs(procs: list[subprocess.Popen]) -> None:
    for p in procs:
        if p.poll() is None:
            p.terminate()
            try:
                p.wait(timeout=8)
            except subprocess.TimeoutExpired:
                p.kill()


def stitch() -> Path:
    left = OUT / "customer-raw.mp4"
    right = OUT / "technician-raw.mp4"
    final = OUT / "Oorjaman-Sync-Test.mp4"
    # Homebrew ffmpeg often lacks libfreetype drawtext — burn labels via PNG overlays.
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as e:
        raise RuntimeError("Pillow required for labels: tmp/demo-venv/bin/pip install pillow") from e

    def label_png(path: Path, text: str) -> None:
        img = Image.new("RGBA", (860, 56), (11, 18, 32, 255))
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)
        except Exception:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((860 - tw) / 2, (56 - th) / 2), text, fill=(255, 255, 255, 255), font=font)
        img.save(path)

    cust_lbl = OUT / "_label_customer.png"
    tech_lbl = OUT / "_label_technician.png"
    label_png(cust_lbl, "CUSTOMER")
    label_png(tech_lbl, "TECHNICIAN")

    filter_complex = (
        f"[0:v]scale=800:900:force_original_aspect_ratio=decrease,setsar=1,"
        f"pad=860:960:(ow-iw)/2:(oh-ih)/2:black[left];"
        f"[1:v]scale=800:900:force_original_aspect_ratio=decrease,setsar=1,"
        f"pad=860:960:(ow-iw)/2:(oh-ih)/2:black[right];"
        f"[left][2:v]overlay=0:0[leftL];"
        f"[right][3:v]overlay=0:0[rightL];"
        f"[leftL][rightL]hstack=inputs=2[row];"
        f"[row]pad=1920:1080:(ow-iw)/2:(oh-ih)/2:#0B1220[v]"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(left),
        "-i",
        str(right),
        "-i",
        str(cust_lbl),
        "-i",
        str(tech_lbl),
        "-filter_complex",
        filter_complex,
        "-map",
        "[v]",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "20",
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
        "-t",
        "15",
        str(final),
    ]
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    return final


def prepare() -> tuple:
    print("=== PREPARE ===", flush=True)
    for serial, pkg in ((CUST_SERIAL, CUST_PKG), (TECH_SERIAL, TECH_PKG)):
        adb(serial, "shell", "pm", "clear", pkg, check=False)
        grant_perms(serial, pkg)
        launch(serial, pkg)
    time.sleep(5)
    cust = u2.connect(CUST_SERIAL)
    tech = u2.connect(TECH_SERIAL)
    advance_pre_login(cust, "customer")
    advance_pre_login(tech, "technician")
    login_email_otp(cust, "customer", CUSTOMER_EMAIL)
    login_email_otp(tech, "technician", TECH_EMAIL)
    time.sleep(1.5)
    customer_navigate_to_payment(cust, schedule_offset_days=1)
    tech_open_jobs(tech, prefer_segment="upcoming")
    return cust, tech


def confirm_pay_later(cust) -> None:
    if not click_any(cust, ["Book visit · pay later", "pay later"], timeout=4):
        if cust(textContains="Book visit").exists:
            cust(textContains="Book visit").click()
        else:
            w, h = cust.window_size()
            cust.click(w // 2, int(h * 0.86))
    ok = wait_until(
        lambda: "Booking confirmed" in joined(cust) or "My bookings" in joined(cust),
        timeout=25,
        label="customer booking confirmed UI",
    )
    if not ok:
        raise RuntimeError(f"booking confirm not visible: {texts(cust)[:25]}")


def tech_wait_and_open_assigned(tech, reference_code: str | None = None) -> dict:
    """Prefer Upcoming for future jobs; open the assigned booking by reference when known."""
    click_any(tech, ["Jobs", "View all jobs"], timeout=3)
    time.sleep(0.5)

    found_segment = None
    segments = ("Upcoming", "Today", "Active") if reference_code else ("Upcoming", "Today", "Active")

    for seg in segments:
        click_jobs_segment(tech, seg)
        time.sleep(0.5)

        # Pull-to-refresh once, then scroll the list looking for the reference
        tech.swipe_ext("down", scale=0.55)
        time.sleep(1.0)

        for scroll_i in range(18):
            j = joined(tech)
            if reference_code:
                if reference_code in j:
                    found_segment = seg
                    break
            elif any(x in j for x in ("Guwahati", "ASSIGNED", "View job", "OM-")):
                found_segment = seg
                break
            # Scroll list content (up gesture moves list toward later rows)
            tech.swipe_ext("up", scale=0.55)
            time.sleep(0.55)
            if scroll_i in (5, 11):
                # Re-assert segment in case scroll hit another tab area
                click_jobs_segment(tech, seg)
                time.sleep(0.3)
        if found_segment:
            break

    if not found_segment:
        tech.screenshot(str(OUT / "technician-job-missing.png"))
        raise RuntimeError(
            f"assigned job not visible (ref={reference_code}): {texts(tech)[:30]}"
        )

    print(f"[technician] job visible under {found_segment}", flush=True)

    # Open the specific card — never the first View job when a reference is known
    opened = False
    if reference_code and tech(text=reference_code).exists:
        print(f"  click text={reference_code!r}", flush=True)
        tech(text=reference_code).click()
        time.sleep(1.0)
        opened = True
        if "SCHEDULE" not in joined(tech) and "CUSTOMER CODES" not in joined(tech):
            click_any(tech, ["View job", "Open job", "Open"], timeout=2)
    if not opened:
        if not click_any(tech, ["View job", "Open job", "Open"], timeout=3):
            w, h = tech.window_size()
            tech.click(w // 2, int(h * 0.42))
            time.sleep(1.2)

    def detail_ready() -> bool:
        j = joined(tech)
        detail_ok = any(
            x in j
            for x in ("ASSIGNED", "SCHEDULE", "SITE", "Job Start", "CUSTOMER CODES", "Mark en route")
        )
        if not detail_ok:
            return False
        if reference_code and reference_code not in j:
            return False
        return True

    ok = wait_until(detail_ready, timeout=20, label="technician job detail")
    detail = texts(tech)
    tech.screenshot(str(OUT / "technician-job-detail-rehearsal.png"))
    if not ok:
        raise RuntimeError(
            f"job detail incomplete (ref={reference_code}): {detail[:30]}"
        )
    return {"segment": found_segment, "detail_texts": detail[:40]}


def customer_verify_bookings(cust, reference_code: str | None = None) -> None:
    """Leave confirmation and open bookings list/detail for the new visit."""
    # Confirmation CTA is exactly "View My bookings" — avoid matching body copy
    # that also contains the words "My bookings".
    if not click_any(cust, ["View My bookings"], timeout=4):
        if "Booking confirmed" in joined(cust):
            w, h = cust.window_size()
            cust.click(int(w * 0.92), int(h * 0.07))
            time.sleep(0.8)
        click_any(cust, ["Bookings"], timeout=3)

    def bookings_ready() -> bool:
        j = joined(cust)
        if "Booking confirmed" in j and "View My bookings" in j:
            return False
        if reference_code and reference_code in j:
            return True
        return any(
            x in j
            for x in (
                "OM-",
                "Guwahati",
                "Accepted",
                "Confirmed",
                "Partner",
                "Upcoming",
                "Scheduled",
                "Pay after",
            )
        )

    ok = wait_until(bookings_ready, timeout=20, label="customer bookings surface")
    cust.screenshot(str(OUT / "customer-bookings-rehearsal.png"))
    if not ok:
        raise RuntimeError(f"customer bookings not ready: {texts(cust)[:25]}")


def record_sync(cust, tech) -> Path:
    """Phase-2 technical sync recording (trimmed to 15s). Production scenes use natural duration."""
    print("=== RECORD SYNC (~15s technical test) ===", flush=True)
    rec_c, rec_t = start_scrcpy_records()
    t0 = time.time()
    try:
        time.sleep(2.0)
        confirm_pay_later(cust)
        assigned = assign_booking()
        ref = assigned.get("reference_code") if isinstance(assigned, dict) else None
        tech_wait_and_open_assigned(tech, reference_code=ref)
        customer_verify_bookings(cust, reference_code=ref)
        elapsed = time.time() - t0
        print(f"scenario elapsed {elapsed:.1f}s", flush=True)
        if elapsed < 12:
            time.sleep(12 - elapsed)
    finally:
        stop_procs([rec_c, rec_t])
        time.sleep(1)

    if not (OUT / "customer-raw.mp4").exists() or not (OUT / "technician-raw.mp4").exists():
        raise RuntimeError("raw recordings missing")
    final = stitch()
    probe = sh(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(final),
        ]
    )
    print(f"SYNC_TEST={final}\nDURATION={probe.stdout.strip()}s", flush=True)
    return final


def rehearse_once(run_id: int = 1) -> dict:
    """Full deterministic rehearsal without video recording."""
    print(f"\n======== REHEARSAL RUN {run_id} ========", flush=True)
    result: dict = {"run": run_id, "pass": False}
    try:
        for serial, pkg in ((CUST_SERIAL, CUST_PKG), (TECH_SERIAL, TECH_PKG)):
            adb(serial, "shell", "pm", "clear", pkg, check=False)
            grant_perms(serial, pkg)
            launch(serial, pkg)
        time.sleep(5)
        cust = u2.connect(CUST_SERIAL)
        tech = u2.connect(TECH_SERIAL)
        advance_pre_login(cust, "customer")
        advance_pre_login(tech, "technician")
        login_email_otp(cust, "customer", CUSTOMER_EMAIL)
        login_email_otp(tech, "technician", TECH_EMAIL)
        time.sleep(1.0)

        selected_day = customer_navigate_to_payment(cust, schedule_offset_days=1)
        result["selected_calendar_day"] = selected_day
        tech_open_jobs(tech, prefer_segment="upcoming")

        confirm_pay_later(cust)
        assigned = assign_booking()
        result["assignment"] = assigned
        ref = assigned.get("reference_code")
        scheduled = assigned.get("scheduled_start")
        result["scheduled_start"] = scheduled

        # Assert scheduled day is in the future (IST) when possible
        if scheduled:
            try:
                from zoneinfo import ZoneInfo

                start = datetime.fromisoformat(str(scheduled).replace("Z", "+00:00"))
                day = start.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d")
                today = ist_day_key(ist_now())
                result["scheduled_ist_day"] = day
                result["today_ist"] = today
                if day <= today:
                    raise RuntimeError(f"expected future IST day, got {day} (today={today})")
            except RuntimeError:
                raise
            except Exception as e:
                print(f"  note: could not parse scheduled_start ({e})", flush=True)

        # Explicit state wait: technician Jobs → Upcoming contains this reference
        if ref:

            def ref_on_upcoming() -> bool:
                click_any(tech, ["Jobs", "View all jobs"], timeout=1.5)
                click_jobs_segment(tech, "Upcoming")
                tech.swipe_ext("down", scale=0.5)
                time.sleep(0.9)
                if ref in joined(tech):
                    return True
                for _ in range(6):
                    tech.swipe_ext("up", scale=0.55)
                    time.sleep(0.45)
                    if ref in joined(tech):
                        return True
                return False

            appeared = wait_until(
                ref_on_upcoming,
                timeout=50,
                label=f"technician list has {ref}",
                interval=1.0,
            )
            if not appeared:
                print(f"  note: {ref} not yet in hierarchy; will scroll deeper", flush=True)

        tech_info = tech_wait_and_open_assigned(tech, reference_code=ref)
        result["technician"] = {
            "segment": tech_info["segment"],
            "status_visible": "ASSIGNED" in " ".join(tech_info["detail_texts"]),
            "reference_visible": bool(ref and ref in " ".join(tech_info["detail_texts"])),
            "detail_sample": tech_info["detail_texts"][:20],
        }
        if ref and not result["technician"]["reference_visible"]:
            raise RuntimeError(f"technician opened wrong job; expected {ref}")
        if tech_info["segment"] != "Upcoming":
            raise RuntimeError(
                f"expected Upcoming segment for future job, got {tech_info['segment']}"
            )
        customer_verify_bookings(cust, reference_code=ref)
        result["customer"] = {"bookings_ok": True, "reference_code": ref}
        result["pass"] = True
        print(f"REHEARSAL RUN {run_id}: PASS", flush=True)
    except Exception as e:
        result["error"] = str(e)
        print(f"REHEARSAL RUN {run_id}: FAIL — {e}", flush=True)
    return result


def main() -> int:
    mode = (sys.argv[1] if len(sys.argv) > 1 else "all").strip().lower()
    if mode == "prepare":
        prepare()
        return 0
    if mode == "record":
        cust = u2.connect(CUST_SERIAL)
        tech = u2.connect(TECH_SERIAL)
        record_sync(cust, tech)
        return 0
    if mode == "assign":
        print(assign_booking())
        return 0
    if mode == "stitch":
        stitch()
        return 0
    if mode == "rehearse":
        runs = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        results = [rehearse_once(i + 1) for i in range(runs)]
        out = OUT / "rehearsal-results.json"
        out.write_text(json.dumps(results, indent=2))
        print(f"\nWrote {out}", flush=True)
        return 0 if all(r.get("pass") for r in results) else 1
    cust, tech = prepare()
    record_sync(cust, tech)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
