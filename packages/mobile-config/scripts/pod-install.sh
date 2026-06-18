#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

APP_SLUG="${1:?Usage: pod-install.sh <customer-app|technician-app>}"
load_mobile_app_profile "$APP_SLUG"

IOS_DIR="$APP_ROOT/ios"
POD="/opt/homebrew/bin/pod"

if [[ ! -x "$POD" ]]; then
  POD="$(command -v pod || true)"
fi

if [[ -z "${POD:-}" || ! -x "$POD" ]]; then
  echo "CocoaPods not found. Install with: brew install cocoapods" >&2
  exit 1
fi

cd "$IOS_DIR"

unset EXPO_USE_PRECOMPILED_MODULES

if [[ "${RCT_BUILD_HERMES_FROM_SOURCE:-}" == "true" ]]; then
  exec "$POD" install
fi

exec env RCT_BUILD_HERMES_FROM_SOURCE=true RCT_IGNORE_PODS_DEPRECATION=1 "$POD" install
