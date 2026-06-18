#!/usr/bin/env bash
# Full clean rebuild of a native iOS app (dev build on Simulator — not Expo Go).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

APP_SLUG="${1:?Usage: rebuild-ios.sh <customer-app|technician-app>}"
shift

load_mobile_app_profile "$APP_SLUG"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
POD_BIN="$(command -v pod || true)"
if [[ -z "$POD_BIN" ]]; then
  echo "ERROR: CocoaPods not found. Install: brew install cocoapods"
  exit 1
fi

BUNDLE_ID="${EXPO_PUBLIC_IOS_BUNDLE_ID:-$DEFAULT_IOS_BUNDLE_ID}"

cd "$APP_ROOT"

echo "==> $APP_LABEL: clean iOS rebuild"
echo "    Directory: $APP_ROOT"
echo "    Bundle ID: $BUNDLE_ID"

stop_metro_for_profile

echo "==> Remove local build + Metro caches"
rm -rf ios/build
clear_metro_caches

echo "==> Uninstall old app from booted simulator (if any)"
if xcrun simctl list devices booted 2>/dev/null | grep -q Booted; then
  xcrun simctl uninstall booted "$BUNDLE_ID" 2>/dev/null || true
else
  echo "    (no booted simulator — skip uninstall)"
fi

echo "==> $BRAND_SYNC_ECHO (this app only)"
BRAND_SYNC_APP="$APP_SLUG" npm run brand:sync

echo "==> Regenerate native ios/ only (android/ is not modified)"
unset EXPO_USE_PRECOMPILED_MODULES
npx expo prebuild --platform ios --clean --no-install

echo "==> CocoaPods (Hermes-safe install via mobile-config pod-install.sh)"
bash "$SCRIPT_DIR/pod-install.sh" "$APP_SLUG"

echo "==> Build native app, install on Simulator, start Metro (cache cleared)"
EXPO_NO_METRO_CACHE=1 npx expo run:ios "$@"
