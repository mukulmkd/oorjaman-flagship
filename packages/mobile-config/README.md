# @oorjaman/mobile-config

Shared **Expo config plugins**, **Metro config**, and **native rebuild scripts** for `customer-app` and `technician-app`.

## Plugins

Import in `app.config.ts`:

```ts
import {
  withIosPodfileFixes,
  withNativeDisplayName,
  withAndroidWhiteAdaptiveIcon,
  withAndroidNotificationBranding,
} from "@oorjaman/mobile-config";
import {
  expoBuildPropertiesFromSource,
  splashScreenPlugin,
  notificationsPlugin,
} from "@oorjaman/mobile-config/shared-plugins";
```

## Metro

```js
const { createMobileMetroConfig } = require("@oorjaman/mobile-config/metro");
module.exports = createMobileMetroConfig(__dirname);
```

## Native rebuild scripts

App `package.json` delegates to `packages/mobile-config/scripts/` with the workspace slug:

```json
"prebuild:android": "bash ../../packages/mobile-config/scripts/prebuild-android.sh customer-app",
"android:rebuild": "bash ../../packages/mobile-config/scripts/rebuild-android.sh customer-app",
"ios:rebuild": "bash ../../packages/mobile-config/scripts/rebuild-ios.sh customer-app"
```

Per-app defaults (bundle ID, Metro ports, labels) live in `profiles/<app>.json`.

`shared-plugins.js` sets Android **release** shrink options (R8 + resource shrink + `useLegacyPackaging`) for smaller UAT APKs from `android:apk:uat`. Re-run `prebuild` / `android:rebuild` after changing build properties.
