const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Declares phone-sized screens only so Play filters tablets / many large-screen
 * devices. Pair with `ios.supportsTablet: false` in app.config.
 *
 * Takes effect on the next native prebuild / EAS Android build (not OTA).
 */
function withAndroidPhoneOnlyScreens(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest) {
      throw new Error(
        "withAndroidPhoneOnlyScreens: AndroidManifest.xml is missing a <manifest> root.",
      );
    }

    manifest["supports-screens"] = [
      {
        $: {
          "android:smallScreens": "true",
          "android:normalScreens": "true",
          "android:largeScreens": "false",
          "android:xlargeScreens": "false",
          "android:anyDensity": "true",
        },
      },
    ];

    return config;
  });
}

module.exports = withAndroidPhoneOnlyScreens;
