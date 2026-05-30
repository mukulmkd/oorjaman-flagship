import type { ExpoConfig } from "expo/config";

const deployEnv = (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? "").trim().toLowerCase();
const isUat = deployEnv === "uat" || deployEnv === "staging";

const config: ExpoConfig = {
  name: isUat ? "OorjaMan Technician (UAT)" : "OorjaMan Technician",
  slug: "technician-app",
  scheme: isUat ? "oorjaman-technician-uat" : "oorjaman-technician",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1f8660",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#1f8660",
    },
    package: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
  },
  plugins: [
    "expo-router",
    [
      "expo-notifications",
      {
        sounds: ["./assets/sounds/chat_message.wav"],
      },
    ],
    "expo-font",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow Oorjaman Technician to use your location for job routing while you're working.",
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Oorjaman Technician to attach before and after photos for job reports.",
        cameraPermission: "Allow Oorjaman Technician to capture site photos for job reports.",
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
