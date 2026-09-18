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

echo "==> Tune Gradle JVM for local release builds"
node - "$APP_ROOT/android/gradle.properties" <<'NODE'
const fs = require("node:fs");

const path = process.argv[2];
let contents = fs.readFileSync(path, "utf8");
contents = contents.replace(
  /^org\.gradle\.jvmargs=.*$/m,
  "org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8",
);
if (/^org\.gradle\.workers\.max=/m.test(contents)) {
  contents = contents.replace(/^org\.gradle\.workers\.max=.*$/m, "org.gradle.workers.max=2");
} else {
  contents += "\n# Bound local release-build concurrency to avoid JVM Metaspace exhaustion.\norg.gradle.workers.max=2\n";
}
fs.writeFileSync(path, contents, "utf8");
NODE

echo "==> Android SDK local.properties + clear stale autolinking cache"
node "$REPO_ROOT/scripts/android-local-properties.mjs"
node "$REPO_ROOT/scripts/android-clear-autolinking-cache.mjs" "$APP_SLUG"
