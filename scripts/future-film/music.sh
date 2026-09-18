#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/lib/load-env.sh"
mkdir -p "${ROOT}/work/audio"
exec "${ROOT}/.venv/bin/python" "${ROOT}/lib/music.py"
