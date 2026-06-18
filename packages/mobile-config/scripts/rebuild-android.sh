#!/usr/bin/env bash
# Full clean rebuild of a native Android app (dev build — not Expo Go).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

APP_SLUG="${1:?Usage: rebuild-android.sh <customer-app|technician-app>}"
shift

load_mobile_app_profile "$APP_SLUG"

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$ANDROID_SDK/platform-tools:$PATH"

PACKAGE="${EXPO_PUBLIC_ANDROID_PACKAGE:-$DEFAULT_ANDROID_PACKAGE}"

cd "$APP_ROOT"

echo "==> $APP_LABEL: clean Android rebuild"
echo "    Directory: $APP_ROOT"
echo "    Package:   $PACKAGE"

stop_metro_for_profile

echo "==> Remove local build + Metro caches"
rm -rf android/app/build android/build android/.gradle
clear_metro_caches

if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -E '\tdevice$' >/dev/null; then
  echo "==> USB device: adb reverse (Metro) + uninstall old app (if any)"
  adb reverse tcp:8081 tcp:8081 2>/dev/null || true
  adb uninstall "$PACKAGE" 2>/dev/null || true
else
  echo "    (no USB device — skip adb reverse / uninstall)"
fi

bash "$SCRIPT_DIR/prebuild-android.sh" "$APP_SLUG"

echo "==> Build native Android app only (install on emulator/device, start Metro)"
EXPO_NO_METRO_CACHE=1 npx expo run:android --no-install "$@"
