#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "${ROOT}/work/scenes"
exec "${ROOT}/.venv/bin/python" "${ROOT}/lib/motion.py"
