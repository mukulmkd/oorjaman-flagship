#!/usr/bin/env bash
# Full clean rebuild of the OorjaMan Partner native iOS app (dev build on Simulator — not Expo Go).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Homebrew CocoaPods first (system `pod` is often a broken shim on macOS).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
POD_BIN="$(command -v pod || true)"
if [[ -z "$POD_BIN" ]]; then
  echo "ERROR: CocoaPods not found. Install: brew install cocoapods"
  exit 1
fi

BUNDLE_ID="${EXPO_PUBLIC_IOS_BUNDLE_ID:-com.oorjaman.technician}"

echo "==> OorjaMan Partner app: clean iOS rebuild"
echo "    Directory: $ROOT"
echo "    Bundle ID: $BUNDLE_ID"

echo "==> Stop any Metro on :8081 (wrong app bundle is a common cause of stale UI)"
if lsof -ti:8081 >/dev/null 2>&1; then
  lsof -ti:8081 | xargs kill -9 2>/dev/null || true
  sleep 1
fi
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

echo "==> Remove local build + Metro caches"
rm -rf ios/build
rm -rf .expo
rm -rf node_modules/.cache
rm -rf "$TMPDIR/metro-"* 2>/dev/null || true
rm -rf "$TMPDIR/haste-map-"* 2>/dev/null || true

echo "==> Uninstall old app from booted simulator (if any)"
if xcrun simctl list devices booted 2>/dev/null | grep -q Booted; then
  xcrun simctl uninstall booted "$BUNDLE_ID" 2>/dev/null || true
else
  echo "    (no booted simulator — skip uninstall)"
fi

echo "==> Regenerate partner launcher icons (persona badge on Big O)"
npm run brand:sync

echo "==> Regenerate native ios/ from app.config.ts"
npx expo prebuild --platform ios --clean

echo "==> CocoaPods ($POD_BIN)"
cd ios
"$POD_BIN" install
cd ..

echo "==> Build native app, install on Simulator, start Metro (cache cleared)"
EXPO_NO_METRO_CACHE=1 npx expo run:ios "$@"
