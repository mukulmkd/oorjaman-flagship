#!/usr/bin/env bash
# Thin wrapper — production preflight only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
exec "$ROOT/tmp/demo-venv/bin/python" "$(cd "$(dirname "$0")" && pwd)/preflight.py"
