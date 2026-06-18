#!/usr/bin/env bash
# Regenerate android/ from app.config.ts (brand sync + Gradle helpers).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

APP_SLUG="${1:?Usage: prebuild-android.sh <customer-app|technician-app>}"
load_mobile_app_profile "$APP_SLUG"

cd "$APP_ROOT"

echo "==> $BRAND_SYNC_ECHO (this app only)"
BRAND_SYNC_APP="$APP_SLUG" npm run brand:sync

echo "==> Regenerate native android/ only (ios/ is not modified)"
unset EXPO_USE_PRECOMPILED_MODULES
npx expo prebuild --platform android --clean --no-install

echo "==> Android SDK local.properties + clear stale autolinking cache"
node "$REPO_ROOT/scripts/android-local-properties.mjs"
node "$REPO_ROOT/scripts/android-clear-autolinking-cache.mjs" "$APP_SLUG"
