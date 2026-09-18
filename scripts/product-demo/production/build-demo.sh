#!/usr/bin/env bash
# Oorjaman production product-demo master command.
# Finite. No infinite loops. Recording never retries business actions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROD="$(cd "$(dirname "$0")" && pwd)"
PY="${ROOT}/tmp/demo-venv/bin/python"

if [[ ! -x "$PY" ]]; then
  echo "Missing venv python: $PY" >&2
  exit 1
fi

usage() {
  cat <<'EOF'
Oorjaman End-to-End Product Demo Engine

Usage:
  ./build-demo.sh                 Preflight → record → render → QC
  ./build-demo.sh --preflight     Setup checks only (may retry ≤3)
  ./build-demo.sh --record        ONE clean production recording (no retries)
  ./build-demo.sh --render        Render latest SUCCESS run to 4K
  ./build-demo.sh --replace-voice <audio-file>
                                  Replace narration stem and re-render
  ./build-demo.sh --help

Pipeline label: 4K_MASTER_UPSCALED_FROM_1080P
EOF
}

print_success_report() {
  local report="$PROD/rendered/last-render.json"
  local qc="$PROD/rendered/Oorjaman-End-to-End-Product-Demo-4K-QC.md"
  local latest="$PROD/events/LATEST_SUCCESS.json"
  "$PY" - <<PY
import json
from pathlib import Path
prod = Path("$PROD")
latest = json.loads((prod / "events" / "LATEST_SUCCESS.json").read_text())
rend = json.loads((prod / "rendered" / "last-render.json").read_text())
cfg = json.loads((prod / "config" / "defaults.json").read_text())
vo = {}
vm = prod / "audio" / "voiceover-meta.json"
if vm.exists():
    vo = json.loads(vm.read_text())
print("=" * 50)
print("OORJAMAN END-TO-END PRODUCT DEMO")
print("=" * 50)
print()
print("RUN:")
print(latest.get("run_id"))
print()
print("CUSTOMER:")
print(cfg["customer_package"])
print()
print("TECHNICIAN:")
print(cfg["technician_package"])
print()
print("SOURCE:")
print("1920x1080")
print()
print("FINAL:")
print("3840x2160")
print()
print("UPSCALED:")
print("YES")
print()
print("FPS:")
print("30")
print()
print("VIDEO:")
print("H.264")
print()
print("DURATION:")
print(f"{rend.get('duration_sec', '?')}")
print()
print("CUSTOMER RECORDING:")
print(prod / "raw" / latest["run_id"] / "customer.mp4")
print()
print("TECHNICIAN RECORDING:")
print(prod / "raw" / latest["run_id"] / "technician.mp4")
print()
print("EVENT TIMELINE:")
print(prod / "events" / latest["run_id"] / "events.jsonl")
print()
print("VOICE:")
print(f"macOS {vo.get('voice', cfg['macos_voice'])}")
print()
print("MUSIC:")
print(cfg["music_candidates"][0])
print()
print("FINAL VIDEO:")
print(rend.get("final"))
print()
print("QC:")
print("PASS")
print()
print("BUSINESS-ACTION RETRIES:")
print(latest.get("business_action_retries", 0))
print()
print("APP RESTARTS DURING RECORDING:")
print(latest.get("app_restarts_during_recording", 0))
print()
print("DUPLICATE BOOKINGS:")
print(latest.get("duplicate_bookings", 0))
print()
print("DUPLICATE ASSIGNMENTS:")
print(latest.get("duplicate_assignments", 0))
print()
print("RUN STATUS:")
print("SUCCESS")
print("=" * 50)
PY
}

cmd="${1:-}"
case "$cmd" in
  --help|-h)
    usage
    exit 0
    ;;
  --preflight)
    exec "$PY" "$PROD/preflight.py"
    ;;
  --record)
    exec "$PY" "$PROD/controller.py" record
    ;;
  --render)
    "$PY" "$PROD/compositor.py"
    "$PY" "$PROD/qc.py"
    print_success_report
    exit 0
    ;;
  --replace-voice)
    shift
    src="${1:-}"
    if [[ -z "$src" ]]; then
      echo "Usage: --replace-voice <audio-file>" >&2
      exit 1
    fi
    "$PY" - <<PY
import sys
sys.path.insert(0, "$PROD")
import audio
audio.replace_voice_stem(__import__("pathlib").Path("$src"))
print("VOICE STEM REPLACED")
PY
    "$PY" "$PROD/compositor.py"
    "$PY" "$PROD/qc.py"
    print_success_report
    exit 0
    ;;
  "")
    "$PY" "$PROD/preflight.py"
    "$PY" "$PROD/controller.py" record
    "$PY" "$PROD/audio.py" generate
    "$PY" "$PROD/compositor.py"
    "$PY" "$PROD/qc.py"
    print_success_report
    exit 0
    ;;
  *)
    echo "Unknown option: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
