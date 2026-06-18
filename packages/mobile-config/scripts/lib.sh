#!/usr/bin/env bash
# Shared helpers for mobile native rebuild scripts.

load_mobile_app_profile() {
  local slug="${1:?app slug required (customer-app|technician-app)}"
  PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"
  APP_ROOT="$REPO_ROOT/apps/$slug"
  PROFILE_PATH="$PKG_DIR/profiles/$slug.json"

  if [[ ! -d "$APP_ROOT" ]]; then
    echo "ERROR: App directory not found: $APP_ROOT" >&2
    exit 1
  fi
  if [[ ! -f "$PROFILE_PATH" ]]; then
    echo "ERROR: Profile not found: $PROFILE_PATH" >&2
    exit 1
  fi

  eval "$(node -e "
    const p = require(process.argv[1]);
    const ports = (p.metroPorts || [8081]).join(' ');
    console.log(\`APP_LABEL=\${JSON.stringify(p.label)}\`);
    console.log(\`DEFAULT_ANDROID_PACKAGE=\${JSON.stringify(p.defaultAndroidPackage)}\`);
    console.log(\`DEFAULT_IOS_BUNDLE_ID=\${JSON.stringify(p.defaultIosBundleId)}\`);
    console.log(\`METRO_PORTS='\${ports}'\`);
    console.log(\`BRAND_SYNC_ECHO=\${JSON.stringify(p.brandSyncEcho || 'Regenerate brand assets')}\`);
  " "$PROFILE_PATH")"
}

stop_metro_for_profile() {
  echo "==> Stop Metro (${METRO_PORTS// /, }) (wrong app bundle is a common cause of stale UI)"
  for port in $METRO_PORTS; do
    if lsof -ti:"$port" >/dev/null 2>&1; then
      lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    fi
  done
  sleep 1
  pkill -f "expo start" 2>/dev/null || true
  pkill -f "metro" 2>/dev/null || true
}

clear_metro_caches() {
  rm -rf .expo
  rm -rf node_modules/.cache
  rm -rf "$TMPDIR/metro-"* 2>/dev/null || true
  rm -rf "$TMPDIR/haste-map-"* 2>/dev/null || true
}
