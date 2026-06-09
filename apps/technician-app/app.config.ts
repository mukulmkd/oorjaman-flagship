import type { ExpoConfig } from "expo/config";
// @ts-expect-error local config plugin (CommonJS)
import withPartnerNativeBranding from "./plugins/withPartnerNativeBranding";

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
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#1f8660",
    },
    package: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
  },
  plugins: [
    withPartnerNativeBranding,
    "expo-system-ui",
    "expo-router",
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#1f8660",
        sounds: ["./assets/sounds/chat_message.wav"],
      },
    ],
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
  ],
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
