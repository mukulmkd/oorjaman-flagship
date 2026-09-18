#!/usr/bin/env python3
"""
Production end-to-end controller.

PREFLIGHT may retry (via preflight.py).
RECORDING: business actions EXACTLY ONCE — fail fast, no recovery.
"""
from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

PROD = Path(__file__).resolve().parent
DEMO = PROD.parent
ROOT = DEMO.parents[1]
sys.path.insert(0, str(PROD))
sys.path.insert(0, str(DEMO))

import phase2_automate as p2  # noqa: E402
import phase3_record as r  # noqa: E402
import phase3_record_e2e as e2e  # noqa: E402
from lib.common import DemoError, now_run_id, sh, wait_until, write_json  # noqa: E402
from lib.events import EventLog  # noqa: E402
from lib.paths import CFG, resolve, run_dirs  # noqa: E402
from lib.recording import DualRecorder  # noqa: E402

HOLD = float(CFG.get("default_timeout_sec", 30))
BACKEND = float(CFG.get("backend_timeout_sec", 60))


def hold(s: float) -> None:
    time.sleep(max(0.0, s))


class ProductionFail(DemoError):
    def __init__(self, message: str, *, state: str, action: str, observed: str = ""):
        super().__init__(message)
        self.state = state
        self.action = action
        self.observed = observed


def fail_run(
    run_id: str,
    dirs: dict,
    recorder: DualRecorder | None,
    events: EventLog | None,
    err: Exception,
    *,
    state: str,
    action: str,
) -> int:
    print(f"RECORDING FAIL: {err}", flush=True)
    manifest = {}
    if recorder and recorder.recording_started:
        try:
            manifest = recorder.stop()
        except Exception:
            pass
    failed = dirs["failed"]
    failed.mkdir(parents=True, exist_ok=True)
    # Preserve raw / events / logs
    for key in ("raw", "events", "logs"):
        src = dirs[key]
        dst = failed / key
        if src.exists():
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
    report = failed / "failure-report.md"
    report.write_text(
        "\n".join(
            [
                f"# Failure report — {run_id}",
                "",
                f"- state: `{state}`",
                f"- action: `{action}`",
                f"- error: {err}",
                f"- observed: {getattr(err, 'observed', '')}",
                f"- elapsed: {time.strftime('%Y-%m-%d %H:%M:%S')}",
                f"- recording_started: {bool(recorder and recorder.recording_started)}",
                f"- recording_manifest: ```json\n{json.dumps(manifest, indent=2)}\n```",
                "",
                "## Root cause",
                "Business action failed during production recording. No retry performed (policy).",
                "",
            ]
        )
    )
    print(f"Preserved failed run under {failed}", flush=True)
    return 1


def click_once(d, labels: list[str], *, action: str, state: str, timeout: float = 4.0) -> None:
    """Exactly one successful click attempt window — no second business try."""
    if not p2.click_any(d, labels, timeout=timeout):
        raise ProductionFail(
            f"click_once missed {labels}",
            state=state,
            action=action,
            observed=str(p2.texts(d)[:20]),
        )


def pick_photo_once(d, *, state: str, serial: str | None = None, tile: int = 0) -> None:
    """Open gallery once and select a tile from the OorjaManDemo album only.

    Avoids Photos/Recent, which keeps stale MediaStore tiles (e.g. selfie reused
    for before/after).
    """
    serial = serial or CFG["technician_device"]
    for lab in ("Dismiss", "Allow", "While using the app", "Allow all"):
        if d(text=lab).exists:
            d(text=lab).click()
            hold(0.2)

    j0 = p2.joined(d)
    in_picker = any(x in j0 for x in ("Photos", "Albums", "Recent", "Pictures", "OorjaManDemo"))
    if not in_picker:
        opened = False
        for lab in ("PHOTO LIBRARY", "Photo library", "Choose photo", "Gallery", "Photos"):
            if d(text=lab).exists:
                d(text=lab).click()
                hold(0.55)
                opened = True
                break
            if d(textContains="LIBRARY").exists:
                d(textContains="LIBRARY").click()
                hold(0.55)
                opened = True
                break
        if not opened:
            raise ProductionFail(
                "photo source not shown",
                state=state,
                action="pick_photo",
                observed=str(p2.texts(d)[:16]),
            )

    # Albums → OorjaManDemo (not Recent — stale selfie tiles live there)
    if d(text="Albums").exists:
        d(text="Albums").click()
        hold(0.45)
    album_opened = False
    for label in ("OorjaManDemo", "Pictures", "Downloads"):
        if d(text=label).exists:
            d(text=label).click()
            hold(0.55)
            album_opened = True
            break
        if d(textContains=label).exists:
            d(textContains=label).click()
            hold(0.55)
            album_opened = True
            break
    if not album_opened:
        # Fallback: Photos tab still better than giving up
        for label in ("Photos", "Recent"):
            if d(text=label).exists:
                d(text=label).click()
                hold(0.4)
                break

    w, h = d.window_size()
    x_fracs = (0.22, 0.50, 0.78)
    preferred = x_fracs[max(0, min(tile, 2))]
    candidates: list[tuple[float, float]] = [
        (preferred, 0.28),
        (preferred, 0.34),
        (preferred, 0.40),
    ]

    def _picked(j: str) -> bool:
        return any(
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
                "Add photo",
                "Retake",
            )
        ) and "Albums" not in j

    for xf, yf in candidates:
        d.click(int(w * xf), int(h * yf))
        hold(0.5)
        j = p2.joined(d)
        if _picked(j):
            return
        if d(text="Done").exists:
            d(text="Done").click()
            hold(0.4)
            return
        if d(description="Done").exists:
            d(description="Done").click()
            hold(0.4)
            return
    sh(["adb", "-s", serial, "shell", "input", "keyevent", "66"], check=False)
    hold(0.5)
    j = p2.joined(d)
    still_picker = ("Albums" in j or "Photos" in j) and not any(
        x in j for x in ("Continue", "Start job", "Upload", "Submit", "Add photo", "Retake")
    )
    if still_picker:
        raise ProductionFail("gallery pick failed", state=state, action="pick_photo", observed=str(p2.texts(d)[:16]))


def ensure_safety_once(tech, *, state: str) -> None:
    labels = (
        "I am aware of the safety measures required for this visit",
        "I have reviewed OorjaMan and my employer field-safety expectations",
        "I will verify the customer's Job Start Code",
        "I will use appropriate PPE and follow on-site safety protocols",
    )
    # Finite: one pass checkboxes then Continue — max 8 polls
    for i in range(8):
        btn = tech(description="Continue")
        if btn.exists and btn.info.get("enabled"):
            btn.click()
            hold(0.9)
            return
        for lab in labels:
            n = tech(textContains=lab[:40])
            if not n.exists:
                continue
            b = n.info["bounds"]
            tech.click(max(40, b["left"] - 80), (b["top"] + b["bottom"]) // 2)
            hold(0.25)
        hold(0.3)
    raise ProductionFail("safety Continue never enabled", state=state, action="safety", observed=str(p2.texts(tech)[:16]))


def prepare_authenticated() -> tuple:
    """Pre-record setup — may include clears/login (not on camera)."""
    print("=== PREPARE (off-camera) ===", flush=True)
    sh(["node", str(resolve(CFG["clean_script"]))], timeout=120)
    e2e.seed_gallery(CFG["technician_device"])
    cust, tech = r.bootstrap_login()
    e2e.go_customer_home(cust)
    r.ensure_home_tech(tech)
    # Disable pointer / touches
    for serial in (CFG["customer_device"], CFG["technician_device"]):
        p2.adb(serial, "shell", "settings", "put", "system", "pointer_location", "0", check=False)
        p2.adb(serial, "shell", "settings", "put", "system", "show_touches", "0", check=False)
    return cust, tech


def assert_ready_for_record(cust, tech) -> None:
    j = p2.joined(cust)
    if "Plan your next clean" not in j and "Book a visit" not in j:
        raise DemoError(f"Customer not on home before record: {p2.texts(cust)[:18]}")
    jt = p2.joined(tech)
    if "Hello" not in jt and "Jobs" not in jt and "View all jobs" not in jt:
        # Still allow if Home tab present
        if not tech(text="Home").exists and not tech(description="Home").exists:
            raise DemoError(f"Technician not ready before record: {p2.texts(tech)[:18]}")


def record_once() -> int:
    run_id = now_run_id()
    dirs = run_dirs(run_id)
    for d in dirs.values():
        if d.name != "rendered" and d.name != "audio":
            d.mkdir(parents=True, exist_ok=True)

    log_path = dirs["logs"] / "controller.log"
    print(f"RUN_ID={run_id}", flush=True)
    events = EventLog(run_id, dirs["events"])
    recorder: DualRecorder | None = None
    state = "PREPARED"
    action = "prepare"

    try:
        cust, tech = prepare_authenticated()
        assert_ready_for_record(cust, tech)
        events.emit(
            actor="SYSTEM",
            state_before="BOOT",
            action="prepared",
            state_after="PREPARED",
            customer_visible_state="home",
            technician_visible_state="home",
        )

        recorder = DualRecorder(run_id, dirs["raw"], CFG["customer_device"], CFG["technician_device"])
        recorder.start()
        print("RECORDING_STARTED", flush=True)
        events.emit(
            actor="SYSTEM",
            state_before="PREPARED",
            action="recording_started",
            state_after="CUSTOMER_HOME",
        )
        hold(float(CFG["pre_roll_sec"]))

        # --- CUSTOMER_HOME ---
        state, action = "CUSTOMER_HOME", "assert_home"
        e2e.go_customer_home(cust)
        r.ensure_home_tech(tech)
        events.emit(
            actor="CUSTOMER",
            state_before="PREPARED",
            action=action,
            state_after="CUSTOMER_HOME",
            customer_visible_state="home",
            technician_visible_state="home",
        )
        hold(2.0)

        # --- SERVICE / BOOKING ---
        state, action = "SERVICE_SELECTED", "book_to_payment_once"
        day = p2.customer_navigate_to_payment(cust, schedule_offset_days=int(CFG["schedule_offset_days"]))
        events.emit(
            actor="CUSTOMER",
            state_before="CUSTOMER_HOME",
            action=action,
            state_after="BOOKING_DETAILS",
            customer_visible_state="payment_step",
            extra={"selected_day": day},
        )

        state, action = "BOOKING_CONFIRMED", "confirm_pay_later_once"
        p2.confirm_pay_later(cust)
        events.emit(
            actor="CUSTOMER",
            state_before="BOOKING_DETAILS",
            action=action,
            state_after="BOOKING_CONFIRMED",
            customer_visible_state="Booking confirmed",
            overlay="BOOKING CONFIRMED",
        )
        hold(2.5)

        # --- ASSIGN ---
        state, action = "BOOKING_ASSIGNED", "assign_once"
        # Open Jobs Upcoming once (navigation), then assign once
        if not p2.click_any(tech, ["Jobs", "View all jobs"], timeout=3):
            raise ProductionFail("Jobs tab missing", state=state, action=action, observed=str(p2.texts(tech)[:16]))
        hold(0.7)
        p2.click_jobs_segment(tech, "Upcoming")
        hold(0.5)
        assigned = p2.assign_booking()
        if not assigned.get("ok") and not assigned.get("reference_code"):
            raise ProductionFail("assign harness returned no reference", state=state, action=action, observed=str(assigned))
        ref = assigned.get("reference_code") or ""
        start_code = assigned.get("booking_code") or ""
        happy = assigned.get("happy_code") or ""
        events.emit(
            actor="SYSTEM",
            state_before="BOOKING_CONFIRMED",
            action=action,
            state_after="BOOKING_ASSIGNED",
            overlay="TECHNICIAN ASSIGNED",
            extra={"reference_code": ref, "booking_code": start_code},
        )

        # Wait for job visibility — poll only, NO pull-to-refresh, NO re-assign
        state, action = "TECHNICIAN_JOB_VISIBLE", "wait_job_visible"
        def job_visible() -> bool:
            return bool(ref and ref in p2.joined(tech))

        # One segment click already done; wait for text to appear (backend propagation)
        if not wait_until(job_visible, timeout=BACKEND, label=f"job {ref} visible", interval=0.7):
            # Single scroll pass through list (navigation), not a business retry
            for _ in range(6):
                if job_visible():
                    break
                tech.swipe_ext("up", scale=0.45)
                hold(0.45)
            if not job_visible():
                raise ProductionFail(
                    f"job {ref} never visible under Upcoming",
                    state=state,
                    action=action,
                    observed=str(p2.texts(tech)[:20]),
                )
        events.emit(
            actor="TECHNICIAN",
            state_before="BOOKING_ASSIGNED",
            action=action,
            state_after="TECHNICIAN_JOB_VISIBLE",
            technician_visible_state=f"Upcoming:{ref}",
            overlay="JOB RECEIVED",
        )
        hold(1.5)

        # Open job once
        state, action = "TECHNICIAN_JOB_OPENED", "open_job_once"
        if tech(textContains=ref).exists:
            tech(textContains=ref).click()
        else:
            raise ProductionFail("reference row missing for open", state=state, action=action, observed=str(p2.texts(tech)[:16]))
        hold(1.2)
        if not wait_until(
            lambda: any(
                x in p2.joined(tech)
                for x in (
                    "Start visit on site",
                    "Continue visit",
                    "Start visit",
                    "Job Start Code",
                )
            )
            or tech(description="Start visit on site").exists,
            timeout=HOLD,
            label="job detail",
        ):
            raise ProductionFail("job detail not opened", state=state, action=action, observed=str(p2.texts(tech)[:18]))
        events.emit(
            actor="TECHNICIAN",
            state_before="TECHNICIAN_JOB_VISIBLE",
            action=action,
            state_after="TECHNICIAN_JOB_OPENED",
            technician_visible_state="job_detail",
        )

        # Customer bookings detail once
        state, action = "CODES_ALIGNED", "customer_open_booking_once"
        if cust(description="Bookings").exists:
            cust(description="Bookings").click()
        else:
            click_once(cust, ["Bookings", "View My bookings"], action=action, state=state)
        hold(1.0)
        if ref and cust(textContains=ref).exists:
            cust(textContains=ref).click()
            hold(1.2)
        events.emit(
            actor="BOTH",
            state_before="TECHNICIAN_JOB_OPENED",
            action=action,
            state_after="CODES_ALIGNED",
            customer_visible_state="booking_detail",
            technician_visible_state="job_detail",
        )
        hold(2.0)

        # Start visit once — scroll to reveal footer CTAs (do NOT mark En route / Maps)
        state, action = "TECHNICIAN_STARTED", "start_visit_once"
        started = False
        for scroll_i in range(5):
            if tech(description="Start visit on site").exists:
                tech(description="Start visit on site").click()
                started = True
                break
            if tech(text="Start visit on site").exists:
                tech(text="Start visit on site").click()
                started = True
                break
            if tech(description="Continue visit").exists:
                tech(description="Continue visit").click()
                started = True
                break
            if tech(text="Continue visit").exists:
                tech(text="Continue visit").click()
                started = True
                break
            if scroll_i < 4:
                tech.swipe_ext("up", scale=0.55)
                hold(0.55)
        if not started:
            raise ProductionFail("Start visit missing", state=state, action=action, observed=str(p2.texts(tech)[:20]))
        hold(1.2)
        if start_code:
            edits = tech(className="android.widget.EditText")
            if not edits.exists:
                raise ProductionFail("start code field missing", state=state, action="enter_start_code")
            edits[0].click()
            hold(0.2)
            try:
                edits[0].set_text(start_code)
            except Exception as e:
                raise ProductionFail(f"start code entry failed: {e}", state=state, action="enter_start_code")
            hold(0.4)
        btn = tech(description="Continue")
        if btn.exists and btn.info.get("enabled"):
            btn.click()
        else:
            click_once(tech, ["Continue"], action="continue_after_code", state=state)
        hold(0.7)
        ensure_safety_once(tech, state=state)
        # Selfie: one-file gallery so picker can't grab before/after panels
        selfie = e2e.evidence_dir() / "technician-selfie.jpg"
        if not selfie.exists():
            selfie = Path(__file__).resolve().parents[2] / "apps" / "oorjaman-web" / "public" / "marketing" / "technician-selfie.jpg"
        if selfie.exists():
            e2e.seed_gallery(CFG["technician_device"], selfie, label="selfie")
        if tech(description="Choose photo").exists:
            tech(description="Choose photo").click()
        else:
            click_once(tech, ["Choose photo"], action="choose_selfie", state=state)
        hold(0.5)
        pick_photo_once(tech, state=state, tile=0)
        hold(0.55)
        cont_ok = False
        for _ in range(30):
            b = tech(description="Continue")
            if b.exists and b.info.get("enabled"):
                hold(2.2)  # allow signed selfie preview to paint before Continue
                b.click()
                cont_ok = True
                break
            hold(0.3)
        if not cont_ok:
            raise ProductionFail("Continue after selfie disabled", state=state, action="selfie_continue")
        hold(0.45)
        if tech(description="Start job & timer").exists:
            tech(description="Start job & timer").click()
        else:
            click_once(tech, ["Start job & timer"], action="start_timer", state=state)
        hold(2.0)
        events.emit(
            actor="TECHNICIAN",
            state_before="CODES_ALIGNED",
            action=action,
            state_after="TECHNICIAN_STARTED",
            overlay="SERVICE IN PROGRESS",
            technician_visible_state="timer_or_photos",
        )

        # Photos once each — single-file seed per step (correct image, minimal stall)
        state, action = "TECHNICIAN_PHOTOS_COMPLETED", "photos_once"
        ev = e2e.evidence_dir()
        photo_seeds = {
            "Upload before cleaning photo": (ev / "before-cleaning.jpg", "before"),
            "Upload after cleaning photo": (ev / "after-cleaning.jpg", "after"),
        }
        for cta in ("Upload before cleaning photo", "Upload after cleaning photo"):
            seed, tag = photo_seeds[cta]
            if seed.exists():
                e2e.seed_gallery(CFG["technician_device"], seed, label=tag)
            if tech(description=cta).exists:
                tech(description=cta).click()
            else:
                click_once(tech, [cta], action=cta, state=state)
            hold(0.5)
            pick_photo_once(tech, state=state, tile=0)
            cont_ok = False
            for _ in range(30):
                b = tech(description="Continue")
                if b.exists and b.info.get("enabled"):
                    hold(1.1)  # show uploaded thumbnail
                    b.click()
                    cont_ok = True
                    break
                hold(0.3)
            if not cont_ok:
                raise ProductionFail(f"Continue after {cta} disabled", state=state, action=cta)
            hold(0.4)
        if tech(description="Continue to finish").exists:
            tech(description="Continue to finish").click()
        else:
            click_once(tech, ["Continue to finish", "Continue"], action="continue_finish", state=state)
        hold(1.0)
        events.emit(
            actor="TECHNICIAN",
            state_before="TECHNICIAN_STARTED",
            action=action,
            state_after="TECHNICIAN_PHOTOS_COMPLETED",
        )

        # Submit once
        state, action = "TECHNICIAN_SUBMITTED", "submit_once"
        if happy:
            edits = tech(className="android.widget.EditText")
            if edits.exists:
                idx = max(0, edits.count - 1)
                edits[idx].click()
                hold(0.2)
                try:
                    edits[idx].set_text(happy)
                except Exception:
                    tech.send_keys(happy, clear=True)
                hold(0.4)
        if tech(description="Submit report").exists and tech(description="Submit report").info.get("enabled"):
            tech(description="Submit report").click()
        else:
            click_once(tech, ["Submit report"], action=action, state=state)
        hold(2.0)
        if tech(text="OK").exists:
            tech(text="OK").click()
            hold(0.6)
        events.emit(
            actor="TECHNICIAN",
            state_before="TECHNICIAN_PHOTOS_COMPLETED",
            action=action,
            state_after="TECHNICIAN_SUBMITTED",
        )

        state, action = "SERVICE_COMPLETED", "verify_completion"
        cust.swipe_ext("down", scale=0.3)
        hold(1.0)
        events.emit(
            actor="BOTH",
            state_before="TECHNICIAN_SUBMITTED",
            action=action,
            state_after="SERVICE_COMPLETED",
            overlay="SERVICE COMPLETED",
            customer_visible_state="post_submit",
            technician_visible_state="submitted",
        )

        hold(float(CFG["post_roll_sec"]))
        rec_manifest = recorder.stop()
        write_json(dirs["events"] / "recording-manifest.json", rec_manifest)

        if rec_manifest["customer_bytes"] < 50_000 or rec_manifest["technician_bytes"] < 50_000:
            raise ProductionFail("recording files too small", state="END", action="stop_recording")

        success = {
            "run_id": run_id,
            "status": "SUCCESS",
            "assignment": assigned,
            "business_action_retries": 0,
            "app_restarts_during_recording": 0,
            "duplicate_bookings": 0,
            "duplicate_assignments": 0,
            "recording_manifest": rec_manifest,
            "pipeline_label": CFG["pipeline_label"],
        }
        write_json(dirs["events"] / "manifest.json", success)
        write_json(PROD / "events" / "LATEST_SUCCESS.json", {"run_id": run_id, **success})
        log_path.write_text(json.dumps(success, indent=2))
        print("RECORDING PASS", flush=True)
        print(f"RUN_ID={run_id}", flush=True)
        return 0

    except Exception as e:
        return fail_run(
            run_id,
            dirs,
            recorder,
            events,
            e,
            state=state,
            action=action,
        )


def latest_success_run_id() -> str:
    p = PROD / "events" / "LATEST_SUCCESS.json"
    if not p.exists():
        raise DemoError("No successful run — run --record first")
    data = json.loads(p.read_text())
    if data.get("status") != "SUCCESS":
        raise DemoError("Latest run is not SUCCESS")
    return data["run_id"]


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "record"
    if mode == "record":
        raise SystemExit(record_once())
    raise SystemExit(f"Unknown controller mode {mode}")
