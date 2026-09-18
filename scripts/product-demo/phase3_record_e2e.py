#!/usr/bin/env python3
"""
Phase 3 E2E recorder — booking → assign → full technician job completion.

Prerequisites:
  - UAT bookings cleaned (clean_uat_demo_bookings.mjs)
  - emulator-5554 customer UAT, emulator-5556 technician UAT
  - Gallery photos seeded on technician emulator (Pictures/OorjaManDemo)

Usage:
  tmp/demo-venv/bin/python scripts/product-demo/phase3_record_e2e.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

import uiautomator2 as u2

sys.path.insert(0, str(Path(__file__).resolve().parent))
import phase2_automate as p2  # noqa: E402
import phase3_record as r  # noqa: E402

OUT = r.OUT
OUT.mkdir(parents=True, exist_ok=True)
CUST = p2.CUST_SERIAL
TECH = p2.TECH_SERIAL


def hold(s: float) -> None:
    time.sleep(s)


def evidence_dir() -> Path:
    return Path(__file__).resolve().parent / "production" / "assets" / "evidence"


def seed_gallery(serial: str, *images: Path, label: str | None = None) -> None:
    """Push demo evidence into technician gallery — one clear set, MediaStore purged.

    Call with a single image before each pick so the OorjaManDemo album shows
    exactly that photo (selfie → before → after, one by one).
    """
    root = Path(__file__).resolve().parents[2]
    ev = evidence_dir()
    before = ev / "before-cleaning.jpg"
    after = ev / "after-cleaning.jpg"
    selfie = ev / "technician-selfie.jpg"
    if not selfie.exists():
        marketing = root / "apps" / "oorjaman-web" / "public" / "marketing" / "technician-selfie.jpg"
        logo = root / "brand" / "source" / "logo-icon.png"
        selfie = marketing if marketing.exists() else logo

    if images:
        srcs = [p for p in images if p.exists()]
    elif before.exists() and after.exists() and selfie.exists():
        srcs = [selfie, before, after]
    elif selfie.exists():
        srcs = [selfie]
    else:
        print("WARN: no evidence images for gallery seed", flush=True)
        return

    demo_dir = "/sdcard/Pictures/OorjaManDemo"
    # Wipe folder + MediaStore rows so Recent/Photos can't keep stale selfie tiles
    r.sh(["adb", "-s", serial, "shell", "rm", "-rf", demo_dir], check=False)
    r.sh(["adb", "-s", serial, "shell", "mkdir", "-p", demo_dir], check=False)
    r.sh(
        [
            "adb",
            "-s",
            serial,
            "shell",
            "content",
            "delete",
            "--uri",
            "content://media/external/images/media",
            "--where",
            "_data LIKE '%OorjaManDemo%'",
        ],
        check=False,
    )

    stamp = int(time.time() * 1000)
    tag = (label or "evidence").replace(" ", "-")
    for i, src in enumerate(srcs, start=1):
        ext = src.suffix.lower() or ".jpg"
        remote = f"{demo_dir}/{stamp}-{tag}-{i}{ext}"
        r.sh(["adb", "-s", serial, "push", str(src), remote], check=False)
        r.sh(
            [
                "adb",
                "-s",
                serial,
                "shell",
                "am",
                "broadcast",
                "-a",
                "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
                "-d",
                f"file://{remote}",
            ],
            check=False,
        )
        time.sleep(0.15)
    # Let Photos indexer pick up the new file before we open the picker
    time.sleep(0.7 if len(srcs) == 1 else 0.35)
    print(f"gallery seeded on {serial}: {[p.name for p in srcs]} → {demo_dir}", flush=True)


def pick_first_gallery_image(d, serial: str) -> None:
    """After Photo library / Choose photo opens system picker — select first tile."""
    hold(1.5)
    # Common picker affordances
    for label in ("Photos", "Gallery", "Downloads", "Recent", "Pictures", "OorjaManDemo"):
        if d(text=label).exists or d(textContains=label).exists:
            try:
                (d(text=label) if d(text=label).exists else d(textContains=label)).click()
                hold(1.0)
            except Exception:
                pass
    # Tap a mid-upper tile region (works for Android photo picker on Pixel AVDs)
    w, h = d.window_size()
    for yf in (0.28, 0.35, 0.42):
        for xf in (0.22, 0.38, 0.55):
            d.click(int(w * xf), int(h * yf))
            hold(0.9)
            # Leave picker if we returned to app
            j = p2.joined(d)
            if any(
                x in j
                for x in (
                    "Start-of-visit",
                    "Before cleaning",
                    "After cleaning",
                    "Continue",
                    "Start job",
                    "Upload",
                    "Job finish",
                    "Submit",
                )
            ):
                return
            if d(text="Done").exists:
                d(text="Done").click()
                hold(0.8)
                return
            if d(description="Done").exists:
                d(description="Done").click()
                hold(0.8)
                return
    # Fallback: KEYCODE_ENTER / back
    r.sh(["adb", "-s", serial, "shell", "input", "keyevent", "66"], check=False)
    hold(0.8)


def gallery_upload(d, serial: str, open_labels: list[str]) -> None:
    clicked = False
    for lab in open_labels:
        n = d(description=lab)
        if n.exists:
            n.click()
            clicked = True
            break
    if not clicked and not p2.click_any(d, open_labels, timeout=4):
        raise RuntimeError(f"missing upload CTA: {open_labels} ui={p2.texts(d)[:18]}")
    hold(1.0)
    # RN Alert buttons may be UPPERCASE on Android
    if not p2.click_any(
        d,
        ["PHOTO LIBRARY", "Photo library", "Choose photo", "Gallery", "Photos"],
        timeout=3,
    ):
        if d(textContains="LIBRARY").exists:
            d(textContains="LIBRARY").click()
            hold(0.8)
        else:
            raise RuntimeError(f"photo source alert missing: {p2.texts(d)[:20]}")
    pick_first_gallery_image(d, serial)
    for _ in range(40):
        j = p2.joined(d)
        if "Upload failed" in j:
            raise RuntimeError("photo upload failed")
        if "Add photo" not in j and "Photos" not in j:
            hold(1.2)
            return
        hold(0.5)
    hold(2.0)


def go_customer_home(cust) -> None:
    for _ in range(8):
        j = p2.joined(cust)
        if ("Plan your next clean" in j or "Book a visit" in j) and "Tell the technician" not in j:
            return
        if cust(description="Home").exists:
            cust(description="Home").click()
            hold(0.9)
            continue
        cust.press("back")
        hold(0.7)
    raise RuntimeError(f"customer home not reached: {p2.texts(cust)[:16]}")


def record_e2e() -> None:
    print("=== E2E BOOTSTRAP ===", flush=True)
    seed_gallery(TECH)
    cust, tech = r.bootstrap_login()
    go_customer_home(cust)
    r.ensure_home_tech(tech)

    # --- 02 Home ---
    print("=== SCENE 02 home ===", flush=True)
    out = OUT / "scene-02-customer-home.mp4"
    cust.screenshot(str(OUT / "scene-02-verify-home.png"))
    rec = r.start_record(CUST, out)
    try:
        hold(2.0)
        for _ in range(2):
            cust.swipe_ext("up", scale=0.25)
            hold(1.2)
            cust.swipe_ext("down", scale=0.2)
            hold(1.2)
        hold(2.0)
    finally:
        r.stop_record(rec)

    # --- 03 Booking ---
    print("=== SCENE 03 booking ===", flush=True)
    out = OUT / "scene-03-booking.mp4"
    rec = r.start_record(CUST, out)
    try:
        hold(1.0)
        day = p2.customer_navigate_to_payment(cust, schedule_offset_days=1)
        r.save_state({"selected_day": day, "at_payment": True})
        hold(2.0)
    finally:
        r.stop_record(rec)

    # --- 04 Confirm ---
    print("=== SCENE 04 confirmation ===", flush=True)
    out = OUT / "scene-04-confirmation.mp4"
    rec = r.start_record(CUST, out)
    try:
        hold(1.2)
        p2.confirm_pay_later(cust)
        hold(3.5)
        r.save_state({"booking_confirmed": True})
    finally:
        r.stop_record(rec)

    # --- 05 Assignment dual ---
    print("=== SCENE 05 assignment ===", flush=True)
    left = OUT / "scene-05-assignment-customer.mp4"
    right = OUT / "scene-05-assignment-technician.mp4"
    p2.tech_open_jobs(tech, prefer_segment="upcoming")
    hold(1.0)
    rc = r.start_record(CUST, left)
    rt = r.start_record(TECH, right)
    try:
        hold(2.0)
        assigned = p2.assign_booking()
        r.save_state({"assignment": assigned})
        ref = assigned.get("reference_code")
        happy = assigned.get("happy_code")
        print(f"  assigned ref={ref} start={assigned.get('booking_code')} finish={happy}", flush=True)
        hold(1.2)

        def visible():
            p2.click_jobs_segment(tech, "Upcoming")
            tech.swipe_ext("down", scale=0.45)
            hold(0.8)
            return bool(ref and ref in p2.joined(tech))

        if ref:
            p2.wait_until(visible, timeout=45, label=f"assign visible {ref}")
        hold(4.0)
    finally:
        r.stop_record(rc)
        r.stop_record(rt)

    st = r.load_state()
    assigned = st.get("assignment") or {}
    ref = assigned.get("reference_code")
    start_code = assigned.get("booking_code") or ""
    happy_code = assigned.get("happy_code") or ""

    # --- 06 Tech job detail ---
    print("=== SCENE 06 technician job ===", flush=True)
    out = OUT / "scene-06-technician-job.mp4"
    rec = r.start_record(TECH, out)
    try:
        hold(1.2)
        p2.tech_wait_and_open_assigned(tech, reference_code=ref)
        hold(1.5)
        tech.swipe_ext("up", scale=0.35)
        hold(2.0)
        tech.swipe_ext("up", scale=0.3)
        hold(3.0)
    finally:
        r.stop_record(rec)

    # --- 07 Start visit: code + safety + selfie + timer ---
    print("=== SCENE 07 execution start ===", flush=True)
    out = OUT / "scene-07-technician-execution.mp4"
    r.dismiss_chrome(TECH)
    rec = r.start_record(TECH, out)
    try:
        hold(1.2)
        if not p2.click_any(tech, ["Start visit on site", "Continue visit"], timeout=5):
            raise RuntimeError(f"Start visit missing: {p2.texts(tech)[:18]}")
        hold(2.0)
        # Job Start Code
        if start_code:
            edits = tech(className="android.widget.EditText")
            if edits.exists:
                edits[0].click()
                hold(0.3)
                try:
                    edits[0].set_text(start_code)
                except Exception:
                    r.sh(["adb", "-s", TECH, "shell", "input", "text", start_code], check=False)
                hold(0.8)
        p2.click_any(tech, ["Continue"], timeout=3)
        hold(1.5)
        # Safety — click icon hit-targets until Continue (description) is enabled
        labels = (
            "I am aware of the safety measures required for this visit",
            "I have reviewed OorjaMan and my employer field-safety expectations",
            "I will verify the customer's Job Start Code",
            "I will use appropriate PPE and follow on-site safety protocols",
        )
        for _ in range(8):
            btn = tech(description="Continue")
            if btn.exists and btn.info.get("enabled"):
                btn.click()
                hold(1.2)
                break
            for lab in labels:
                n = tech(textContains=lab[:40])
                if not n.exists:
                    continue
                b = n.info["bounds"]
                tech.click(max(40, b["left"] - 80), (b["top"] + b["bottom"]) // 2)
                hold(0.35)
        else:
            raise RuntimeError(f"safety Continue never enabled: {p2.texts(tech)[:16]}")
        # Selfie via gallery
        if tech(description="Choose photo").exists:
            tech(description="Choose photo").click()
        else:
            p2.click_any(tech, ["Choose photo"], timeout=3)
        hold(1.0)
        pick_first_gallery_image(tech, TECH)
        hold(3.0)
        for _ in range(30):
            btn = tech(description="Continue")
            if btn.exists and btn.info.get("enabled"):
                btn.click()
                break
            hold(0.4)
        hold(1.5)
        # Start timer
        if tech(description="Start job & timer").exists:
            tech(description="Start job & timer").click()
        else:
            p2.click_any(tech, ["Start job & timer", "Start job"], timeout=5)
        hold(4.0)
    finally:
        r.stop_record(rec)
        r.dismiss_chrome(TECH)

    # --- 08 Before / after photos ---
    print("=== SCENE 08 photos ===", flush=True)
    out = OUT / "scene-08-job-photos.mp4"
    rec = r.start_record(TECH, out)
    try:
        hold(1.5)
        # Before
        gallery_upload(tech, TECH, ["Upload before cleaning photo"])
        hold(2.0)
        p2.click_any(tech, ["Continue"], timeout=4)
        hold(1.5)
        # After
        gallery_upload(tech, TECH, ["Upload after cleaning photo"])
        hold(2.0)
        p2.click_any(tech, ["Continue"], timeout=4)
        hold(1.5)
        # Issues (optional) → finish
        p2.click_any(tech, ["Continue to finish", "Continue"], timeout=4)
        hold(2.5)
    finally:
        r.stop_record(rec)

    # Fetch happy_code from DB if harness JSON omitted it
    if not happy_code and assigned.get("booking_id"):
        try:
            import os
            from pathlib import Path as P

            # Re-read via assign state file / node one-liner
            pass
        except Exception:
            pass
    # Prefer metadata from assignment JSON; if missing, query via node
    if not happy_code:
        try:
            q = subprocess.check_output(
                [
                    "node",
                    "-e",
                    f"""
import {{ createClient }} from '@supabase/supabase-js';
import {{ config }} from 'dotenv';
config({{ path: '.env.uat.local' }});
const a=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {{auth:{{persistSession:false}}}});
const {{ data }} = await a.from('bookings').select('metadata').eq('id','{assigned.get("booking_id","")}').maybeSingle();
const hc=data?.metadata?.service_otp?.happy_code||'';
console.log(hc);
""",
                ],
                cwd=str(Path(__file__).resolve().parents[2]),
                text=True,
            ).strip()
            happy_code = q
            print(f"  happy_code from db={happy_code}", flush=True)
        except Exception as e:
            print(f"  happy_code lookup failed: {e}", flush=True)

    # --- 09 Submit finish + customer completed ---
    print("=== SCENE 09 completion ===", flush=True)
    left = OUT / "scene-09-completion-customer.mp4"
    right = OUT / "scene-09-completion-technician.mp4"

    # Customer open booking detail with codes
    if cust(description="Bookings").exists:
        cust(description="Bookings").click()
    else:
        p2.click_any(cust, ["Bookings", "View My bookings"], timeout=3)
    hold(1.5)
    if ref and cust(textContains=ref).exists:
        cust(textContains=ref).click()
        hold(1.2)
    elif not p2.click_any(cust, ["Tap for details", "Assigned", "In progress", "IN PROGRESS"], timeout=2):
        w, h = cust.window_size()
        cust.click(w // 2, int(h * 0.3))
        hold(1.5)

    rc = r.start_record(CUST, left)
    rt = r.start_record(TECH, right)
    try:
        hold(2.0)
        # Enter finish code + submit on tech
        if happy_code:
            edits = tech(className="android.widget.EditText")
            if edits.exists:
                # last edit is finish code
                idx = max(0, edits.count - 1)
                edits[idx].click()
                hold(0.3)
                try:
                    edits[idx].set_text(happy_code)
                except Exception:
                    r.sh(["adb", "-s", TECH, "shell", "input", "text", happy_code], check=False)
                hold(0.8)
        p2.click_any(tech, ["Submit report"], timeout=4)
        hold(2.0)
        # Dismiss completion alert
        p2.click_any(tech, ["OK", "Collect payment"], timeout=3)
        hold(2.0)
        # Customer refresh / scroll to completed
        cust.swipe_ext("down", scale=0.4)
        hold(1.5)
        cust.swipe_ext("up", scale=0.3)
        hold(3.5)
    finally:
        r.stop_record(rc)
        r.stop_record(rt)

    # Also write single-panel completion alias for older compose paths
    # Prefer customer completion as scene-09-completion.mp4
    src9 = left if left.exists() else right
    if src9.exists():
        (OUT / "scene-09-completion.mp4").write_bytes(src9.read_bytes())

    # Dual connected mid-state aliases used by older compose (optional)
    # scene-08-connected-* → use photo scene + customer detail stills via copies if missing
    if not (OUT / "scene-08-connected-customer.mp4").exists() and left.exists():
        (OUT / "scene-08-connected-customer.mp4").write_bytes(left.read_bytes())
    if not (OUT / "scene-08-connected-technician.mp4").exists() and (OUT / "scene-08-job-photos.mp4").exists():
        (OUT / "scene-08-connected-technician.mp4").write_bytes(
            (OUT / "scene-08-job-photos.mp4").read_bytes()
        )

    meta = {
        "mode": "e2e_full_completion",
        "scenes": [
            "scene-01-opening",
            "scene-02-customer-home",
            "scene-03-booking",
            "scene-04-confirmation",
            "scene-05-assignment",
            "scene-06-technician-job",
            "scene-07-technician-execution",
            "scene-08-job-photos",
            "scene-09-completion",
            "scene-10-closing",
        ],
        "state": r.load_state(),
    }
    (OUT / "manifest.json").write_text(json.dumps(meta, indent=2))
    print(f"MANIFEST={OUT / 'manifest.json'}", flush=True)
    print("E2E RECORD COMPLETE", flush=True)


def main() -> int:
    record_e2e()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
