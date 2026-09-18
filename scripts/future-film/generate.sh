#!/usr/bin/env bash
# Future-of-energy film — master. Not the product-demo film.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export FUTURE_FILM_ROOT="$ROOT"
cd "$ROOT"
# shellcheck disable=SC1091
source "${ROOT}/lib/load-env.sh"

if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  python3 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install -q --upgrade pip
  "$ROOT/.venv/bin/pip" install -q -r "$ROOT/requirements.txt"
fi

chmod +x "$ROOT"/*.sh
./voiceover.sh
./motion-graphics.sh
./music.sh
./compose.sh
./subtitles.sh
./qa.sh

echo "Output: $ROOT/output/Oorjaman-Future-of-Energy.mp4"
