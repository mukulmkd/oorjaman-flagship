#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "${ROOT}/output" "${ROOT}/work"
exec "${ROOT}/.venv/bin/python" "${ROOT}/lib/compose.py"
