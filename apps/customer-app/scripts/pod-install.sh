#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT/ios"
POD="/opt/homebrew/bin/pod"

if [[ ! -x "$POD" ]]; then
  POD="$(command -v pod || true)"
fi

if [[ -z "${POD:-}" || ! -x "$POD" ]]; then
  echo "CocoaPods not found. Install with: brew install cocoapods" >&2
  exit 1
fi

cd "$IOS_DIR"
if [[ "${RCT_BUILD_HERMES_FROM_SOURCE:-}" == "true" ]]; then
  exec "$POD" install
fi

# Avoid Hermes nightly Maven 403 when release tarball check fails.
exec env RCT_BUILD_HERMES_FROM_SOURCE=true "$POD" install
