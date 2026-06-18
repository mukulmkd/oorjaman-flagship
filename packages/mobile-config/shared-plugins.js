/** Shared expo-build-properties, splash, and notification plugin tuples for both mobile apps. */

const expoBuildPropertiesFromSource = [
  "expo-build-properties",
  {
    ios: {
      buildReactNativeFromSource: true,
      usePrecompiledModules: false,
    },
    android: {
      // Release APK only (android:apk:uat / assembleRelease). Shrinks QA shareable APKs;
      // production Play AABs benefit from the same R8/resource passes.
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
      // Compress native .so in the APK (smaller file for QA sideload; slight cold-start tradeoff).
      useLegacyPackaging: true,
    },
  },
] ;

const splashScreenPlugin = [
  "expo-splash-screen",
  {
    backgroundColor: "#ffffff",
    ios: {
      backgroundColor: "#ffffff",
      image: "./assets/images/splash-icon.png",
      enableFullScreenImage_legacy: true,
    },
    android: {
      backgroundColor: "#ffffff",
      image: "./assets/images/splash-android-icon.png",
      imageWidth: 196,
    },
  },
] ;

const notificationsPlugin = [
  "expo-notifications",
  {
    icon: "./assets/images/notification-icon.png",
    color: "#ffffff",
    sounds: ["./assets/sounds/chat_message.wav"],
  },
] ;

module.exports = {
  expoBuildPropertiesFromSource,
  splashScreenPlugin,
  notificationsPlugin,
};
