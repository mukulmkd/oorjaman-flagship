#!/usr/bin/env bash
# Premium TTS: OpenAI → ElevenLabs → Azure → Google → Polly → macOS neural (Reed/Eddy).
# Never espeak / festival / android.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/lib/load-env.sh"
PY="${ROOT}/.venv/bin/python"
mkdir -p "${ROOT}/work/vo"
exec "$PY" "${ROOT}/lib/voiceover.py"
