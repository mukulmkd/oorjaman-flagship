#!/usr/bin/env python3
"""
Dual-emulator UAT demo: customer + technician side-by-side recording.

Usage:
  tmp/demo-venv/bin/python scripts/demo-dual-emulator-record.py

Expects:
  emulator-5554 = customer (com.oorjaman.customer.uat)
  emulator-5556 = technician (com.oorjaman.technician.uat)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import uiautomator2 as u2

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "demo-record"
OUT.mkdir(parents=True, exist_ok=True)

CUST_SERIAL = "emulator-5554"
TECH_SERIAL = "emulator-5556"
CUST_PKG = "com.oorjaman.customer.uat"
TECH_PKG = "com.oorjaman.technician.uat"

# Seeded UAT dummy-auth users (password TestOtp123!; OTP 123456)
CUSTOMER_EMAIL = "appreview.customer@oorjaman.com"  # Guwahati site
TECH_EMAIL = "amit.das@gamusagreen.in"  # Gamusa technician
DUMMY_OTP = "123456"

GAMUSA_VENDOR_ID = "abcdf706-2f75-49c8-9fcb-a5745df0fc07"
AMIT_TECH_ID = "2aa6d0be-2801-4077-b7b5-599141102cec"


def sh(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def adb(serial: str, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return sh(["adb", "-s", serial, *args], check=check)


def texts(d) -> list[str]:
    xml = d.dump_hierarchy()
    return [n.attrib.get("text", "") for n in ET.fromstring(xml).iter("node") if n.attrib.get("text")]


def joined_texts(d) -> str:
    return " ".join(texts(d))


def click_any(d, labels: list[str], timeout: float = 2.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        for label in labels:
            if d(text=label).exists:
                print(f"  click text={label!r}", flush=True)
                d(text=label).click()
                time.sleep(0.8)
                return True
            if d(description=label).exists:
                print(f"  click desc={label!r}", flush=True)
                d(description=label).click()
                time.sleep(0.8)
                return True
            if d(textContains=label).exists:
                print(f"  click contains={label!r}", flush=True)
                d(textContains=label).click()
                time.sleep(0.8)
                return True
        time.sleep(0.25)
    return False


def dismiss_system_dialogs(d) -> None:
    for _ in range(4):
        if not click_any(
            d,
            [
                "While using the app",
                "Only this time",
                "Allow",
                "ALLOW",
                "OK",
                "Got it",
            ],
            timeout=0.5,
        ):
            break


def advance_pre_login(d, label: str, max_steps: int = 22) -> None:
    print(f"[{label}] advancing to login…", flush=True)
    for i in range(max_steps):
        dismiss_system_dialogs(d)
        d.screenshot(str(OUT / f"{label}-adv{i}.png"))
        t = texts(d)
        print(f"[{label}] step {i}: {t[:10]}", flush=True)
        joined = " ".join(t)
        if any(x in joined for x in ("Email", "Send code", "Mobile OTP", "Sign in")):
            print(f"[{label}] login UI reached", flush=True)
            return
        if click_any(
            d,
            [
                "Skip",
                "Not now",
                "Allow location",
                "Next",
                "Continue",
                "Get started",
                "Maybe later",
            ],
            timeout=0.7,
        ):
            continue
        time.sleep(0.4)
    raise RuntimeError(f"{label}: could not reach login")


def login_email_otp(d, label: str, email: str) -> None:
    print(f"[{label}] login as {email}", flush=True)
    click_any(d, ["Email"], timeout=2)
    time.sleep(0.4)

    edits = d(className="android.widget.EditText")
    if edits.count < 1:
        raise RuntimeError(f"{label}: no email field")
    edits[0].click()
    time.sleep(0.2)
    edits[0].clear_text()
    edits[0].set_text(email)
    time.sleep(0.5)

    if not d(text="Send code").exists:
        d.press("back")
        time.sleep(0.3)
    if not click_any(d, ["Send code"], timeout=4):
        raise RuntimeError(f"{label}: Send code missing")

    # Wait until OTP EditText is enabled (otpSent)
    otp = None
    for _ in range(25):
        node = d(description="One-time code")
        if node.exists and node.info.get("enabled"):
            otp = node
            break
        edits = d(className="android.widget.EditText")
        if edits.count >= 2 and edits[1].info.get("enabled"):
            otp = edits[1]
            break
        time.sleep(0.25)
    if otp is None:
        raise RuntimeError(f"{label}: OTP field never enabled")

    otp.click()
    time.sleep(0.25)
    otp.set_text(DUMMY_OTP)
    print(f"[{label}] OTP set; waiting for auto-verify…", flush=True)

    # Auto-verify fires ~380ms after 6 digits; hierarchy flickers during nav
    for i in range(40):
        joined = joined_texts(d)
        if "Invalid login credentials" in joined or "Invalid or expired" in joined:
            raise RuntimeError(f"{label}: login failed: {joined[:180]}")
        if "Sign in with email" not in joined and "PARTNER SIGN-IN" not in joined:
            if "Send code" not in joined:
                print(f"[{label}] logged in: {texts(d)[:18]}", flush=True)
                d.screenshot(str(OUT / f"{label}-after-login.png"))
                return
        time.sleep(0.45)

    # Fallback: tap Verify if still on login
    click_any(d, ["Verify & continue", "Verify and continue"], timeout=2)
    time.sleep(3)
    joined = joined_texts(d)
    if "Sign in with email" in joined or "PARTNER SIGN-IN" in joined:
        raise RuntimeError(f"{label}: still on login after OTP: {texts(d)[:25]}")
    d.screenshot(str(OUT / f"{label}-after-login.png"))


def customer_book_one_time(d) -> None:
    print("[customer] booking flow…", flush=True)
    dismiss_system_dialogs(d)

    # Address picker (first launch / book entry)
    if "SELECT SERVICE LOCATION" in joined_texts(d) or "Select service" in joined_texts(d):
        click_any(d, ["Home — Guwahati", "Home", "Guwahati"], timeout=3)
        time.sleep(0.8)

    # Open book from home / tabs
    for _ in range(8):
        if click_any(
            d,
            [
                "Book a visit",
                "Book visit",
                "Book",
                "Book cleaning",
                "New booking",
            ],
            timeout=1.2,
        ):
            break
        time.sleep(0.4)
    time.sleep(1.2)

    click_any(d, ["Book one-time visit"], timeout=5)
    time.sleep(1.5)

    # Step 1 partner — keep "Assign a partner for me" (Gamusa default)
    click_any(d, ["Continue"], timeout=4)
    time.sleep(1.5)

    # Step 2 schedule — pick first selectable day + afternoon slot
    # After 7pm IST: first open day is tomorrow; day number "12" etc.
    for day in ("12", "13", "14", "15", "16"):
        # Prefer exact calendar day cells; may match other "12"s — try once
        nodes = d(text=day)
        if nodes.count >= 1:
            # click last matching small cell-ish by trying each
            for i in range(min(nodes.count, 6)):
                try:
                    nodes[i].click()
                    time.sleep(0.6)
                    if d(textContains="Available slots").exists or d(textContains="12:00").exists:
                        print(f"  selected day {day} via instance {i}", flush=True)
                        break
                except Exception:
                    continue
            else:
                continue
            break

    for slot in ("12:00 pm", "1:00 pm", "2:00 pm", "12:00", "1:00", "2:00"):
        if click_any(d, [slot], timeout=1.2):
            break
    time.sleep(0.6)
    click_any(d, ["Continue"], timeout=4)
    time.sleep(1.5)

    # Step 3 review → payment
    for _ in range(4):
        joined = joined_texts(d)
        d.screenshot(str(OUT / "customer-book-step.png"))
        print(f"[customer] wizard: {texts(d)[:18]}", flush=True)
        if "STEP 4" in joined or "How would you like to pay" in joined:
            break
        if "STEP 3" in joined or "Review & confirm" in joined:
            click_any(d, ["Continue"], timeout=3)
            time.sleep(1.2)
            continue
        if not click_any(d, ["Continue", "Next"], timeout=2):
            break
        time.sleep(1.0)

    # Pay after service (postpaid) — avoids Razorpay WebView
    if not click_any(d, ["Pay after service"], timeout=4):
        # Fallback: tap second payment card area
        w, h = d.window_size()
        d.click(w // 2, int(h * 0.62))
        time.sleep(0.8)
    time.sleep(0.8)
    print(f"[customer] payment screen: {texts(d)[:20]}", flush=True)

    # CTA becomes "Book visit · pay later · ₹…"
    if not click_any(d, ["Book visit · pay later", "pay later"], timeout=4):
        if d(textContains="Book visit").exists:
            print("  click contains='Book visit'", flush=True)
            d(textContains="Book visit").click()
            time.sleep(1.5)
        else:
            w, h = d.window_size()
            d.click(w // 2, int(h * 0.86))
            time.sleep(2)

    # Wait for success / leave checkout
    for _ in range(20):
        joined = joined_texts(d)
        print(f"[customer] post-submit: {texts(d)[:16]}", flush=True)
        d.screenshot(str(OUT / "customer-book-done.png"))
        if "Booking confirmed" in joined:
            # Prefer explicit CTA if present; otherwise close sheet
            if not click_any(
                d,
                ["View booking", "Done", "Close", "Go to bookings"],
                timeout=1.5,
            ):
                # X / close icon often top-right
                w, h = d.window_size()
                d.click(int(w * 0.92), int(h * 0.07))
                time.sleep(1)
            break
        if "STEP 4" not in joined and "How would you like to pay" not in joined:
            break
        time.sleep(0.6)
    # Show bookings list briefly for the recording
    click_any(d, ["Bookings", "My bookings"], timeout=2)
    time.sleep(3)
    d.screenshot(str(OUT / "customer-bookings.png"))
    print(f"[customer] bookings: {texts(d)[:20]}", flush=True)


def load_uat_env() -> tuple[str, str]:
    env: dict[str, str] = {}
    for path in (ROOT / ".env.uat.local", ROOT / "apps/customer-app/.env.uat.local"):
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if not line or line.strip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get("SUPABASE_URL") or env.get("EXPO_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.uat.local")
    return url.rstrip("/"), key


def rest_sql_accept_latest_booking() -> dict:
    """Mark latest confirmed/pending booking for play-review customer as accepted + assigned."""
    url, key = load_uat_env()
    # Use PostgREST: find customer, latest booking, update
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    def get(path: str):
        req = urllib.request.Request(f"{url}/rest/v1/{path}", headers=headers)
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode())

    def patch(path: str, body: dict):
        req = urllib.request.Request(
            f"{url}/rest/v1/{path}",
            data=json.dumps(body).encode(),
            headers={**headers, "Prefer": "return=representation"},
            method="PATCH",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode())

    users = get("users?email=eq.appreview.customer@oorjaman.com&select=id")
    if not users:
        raise RuntimeError("play-review customer user missing")
    user_id = users[0]["id"]
    customers = get(f"customers?user_id=eq.{user_id}&select=id")
    if not customers:
        raise RuntimeError("play-review customer row missing")
    customer_id = customers[0]["id"]
    bookings = get(
        f"bookings?customer_id=eq.{customer_id}&select=*&order=created_at.desc&limit=8"
    )
    if not bookings:
        raise RuntimeError("no bookings found for customer")
    # Prefer newest non-terminal booking
    booking = next(
        (
            b
            for b in bookings
            if b.get("status") in ("confirmed", "pending_payment", "accepted")
        ),
        bookings[0],
    )
    print(f"[sql] latest booking {booking['id']} status={booking['status']}", flush=True)

    code = booking.get("booking_code") or f"{int(time.time()) % 1000000:06d}"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    meta = booking.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}
    meta = {
        **meta,
        "vendor_acceptance": {
            "accepted_at": now,
            "technician_readiness_ack": True,
            "safety_compliance_ack": True,
            "uniform_safety_kit_ack": True,
            "safety_briefing_ack": True,
            "technician_id": AMIT_TECH_ID,
        },
        "service_otp": {
            "start_code": code,
            "generated_at": now,
        },
    }
    updated = patch(
        f"bookings?id=eq.{booking['id']}",
        {
            "status": "accepted",
            "vendor_id": GAMUSA_VENDOR_ID,
            "technician_id": AMIT_TECH_ID,
            "booking_code": code,
            "metadata": meta,
        },
    )
    print(f"[sql] accepted + assigned code={code} → {updated}", flush=True)
    return updated[0] if updated else {"booking_code": code, "id": booking["id"]}


def technician_show_job(d) -> None:
    print("[technician] show jobs…", flush=True)
    dismiss_system_dialogs(d)
    click_any(d, ["Jobs"], timeout=3)
    time.sleep(1)
    click_any(d, ["Upcoming", "Active", "Today"], timeout=2)
    for _ in range(8):
        d.swipe_ext("down", scale=0.55)
        time.sleep(1.4)
        joined = joined_texts(d)
        print(f"[technician] {texts(d)[:22]}", flush=True)
        d.screenshot(str(OUT / "technician-jobs.png"))
        if any(
            x in joined.lower()
            for x in ("guwahati", "zoo road", "accepted", "upcoming", "start code", "om-")
        ):
            if click_any(d, ["View job", "Open", "View", "Start job", "Start"], timeout=2):
                break
        time.sleep(0.8)
    time.sleep(4)
    d.screenshot(str(OUT / "technician-job-detail.png"))
    print(f"[technician] detail: {texts(d)[:24]}", flush=True)


def start_recordings() -> tuple[subprocess.Popen, subprocess.Popen]:
    cust_mp4 = OUT / "customer-raw.mp4"
    tech_mp4 = OUT / "technician-raw.mp4"
    for p in (cust_mp4, tech_mp4):
        if p.exists():
            p.unlink()
    common = [
        "--no-window",
        "--no-playback",
        "--max-size",
        "720",
        "--video-bit-rate",
        "4M",
        "--no-audio",
    ]
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
    time.sleep(2.5)
    return cust, tech


def grant_perms(serial: str, pkg: str) -> None:
    for perm in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
    ):
        adb(serial, "shell", "pm", "grant", pkg, perm, check=False)


def stitch() -> Path:
    left = OUT / "customer-raw.mp4"
    right = OUT / "technician-raw.mp4"
    final = OUT / "oorjaman-uat-dual-demo.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(left),
        "-i",
        str(right),
        "-filter_complex",
        "[0:v]scale=540:-2,setsar=1[left];[1:v]scale=540:-2,setsar=1[right];"
        "[left][right]hstack=inputs=2[v]",
        "-map",
        "[v]",
        "-c:v",
        "libx264",
        "-crf",
        "23",
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
        str(final),
    ]
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)
    return final


def main() -> int:
    print("Preparing devices…", flush=True)
    for serial, pkg in ((CUST_SERIAL, CUST_PKG), (TECH_SERIAL, TECH_PKG)):
        adb(serial, "shell", "pm", "clear", pkg, check=False)
        grant_perms(serial, pkg)
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
    time.sleep(6)

    cust = u2.connect(CUST_SERIAL)
    tech = u2.connect(TECH_SERIAL)

    print("Starting dual recordings…", flush=True)
    rec_c, rec_t = start_recordings()
    time.sleep(1.5)

    try:
        advance_pre_login(cust, "customer")
        advance_pre_login(tech, "technician")

        login_email_otp(cust, "customer", CUSTOMER_EMAIL)
        login_email_otp(tech, "technician", TECH_EMAIL)

        time.sleep(2)
        customer_book_one_time(cust)

        try:
            accepted = rest_sql_accept_latest_booking()
            print("[sql] ok", accepted.get("booking_code"), flush=True)
        except Exception as e:
            print(f"[sql] WARN accept failed: {e}", flush=True)

        time.sleep(2)
        technician_show_job(tech)

        # Hold for readable outro
        time.sleep(6)
        print("Demo interactions done.", flush=True)
    finally:
        print("Stopping recordings…", flush=True)
        for p in (rec_c, rec_t):
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    p.kill()
        time.sleep(1)

    if not (OUT / "customer-raw.mp4").exists() or not (OUT / "technician-raw.mp4").exists():
        print("ERROR: raw recordings missing", file=sys.stderr)
        return 1

    final = stitch()
    desktop = Path.home() / "Desktop" / "OorjaMan-UAT-Dual-Demo.mp4"
    sh(["cp", str(final), str(desktop)], check=False)
    print(f"\nDONE\n  {final}\n  {desktop}\n", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
