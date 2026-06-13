import type { ExpoConfig } from "expo/config";
import withIosPodfileFixes from "./plugins/withIosPodfileFixes";
import withPartnerNativeBranding from "./plugins/withPartnerNativeBranding";
import withAndroidWhiteAdaptiveIcon from "./plugins/withAndroidWhiteAdaptiveIcon";
import withAndroidNotificationBranding from "./plugins/withAndroidNotificationBranding";

const deployEnv = (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? "").trim().toLowerCase();
const isUat = deployEnv === "uat" || deployEnv === "staging";
const displayName = isUat ? "OorjaMan Partner (UAT)" : "OorjaMan Partner";

const config: ExpoConfig = {
  // Home-screen label on iOS (CFBundleDisplayName) and Android (app_name).
  name: displayName,
  slug: "technician-app",
  scheme: isUat ? "oorjaman-technician-uat" : "oorjaman-technician",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
    infoPlist: {
      CFBundleDisplayName: displayName,
      CFBundleName: displayName,
    },
  },
  android: {
    icon: "./assets/images/icon.png",
    // O + persona badge; smaller adaptive-foreground for Pixel home-screen safe zone.
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-foreground.png",
      backgroundColor: "#ffffff",
    },
    package: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
  },
  plugins: [
    [
      "expo-build-properties",
      {
        ios: {
          // Avoid prebuilt React.framework linker failures (ld: framework 'React' not found).
          buildReactNativeFromSource: true,
        },
      },
    ],
    withIosPodfileFixes,
    withPartnerNativeBranding,
    withAndroidWhiteAdaptiveIcon,
    [
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
    ],
    "expo-system-ui",
    "expo-router",
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#ffffff",
        sounds: ["./assets/sounds/chat_message.wav"],
      },
    ],
    withAndroidNotificationBranding,
    "expo-font",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow OorjaMan Partner to use your location for job routing while you're working.",
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow OorjaMan Partner to attach before and after photos for job reports.",
        cameraPermission: "Allow OorjaMan Partner to capture site photos for job reports.",
      },
    ],
  ] as NonNullable<ExpoConfig["plugins"]>,
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || undefined,
    },
  },
};

export default config;
