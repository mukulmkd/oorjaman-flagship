import type { ExpoConfig } from "expo/config";
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
  assetBundlePatterns: ["**/*"],
  ios: {
    deploymentTarget: "16.4",
    supportsTablet: true,
    bundleIdentifier: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
  },
  android: {
    icon: "./assets/images/icon.png",
    // O + persona badge; smaller adaptive-foreground for Pixel home-screen safe zone.
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-foreground.png",
      backgroundColor: "#ffffff",
    },
    package: isUat ? "com.oorjaman.technician.uat" : "com.oorjaman.technician",
    softwareKeyboardLayoutMode: "resize",
  },
  plugins: [
    expoBuildPropertiesFromSource,
    withIosPodfileFixes,
    withNativeDisplayName,
    withAndroidWhiteAdaptiveIcon,
    splashScreenPlugin,
    "expo-system-ui",
    "expo-status-bar",
    "expo-router",
    notificationsPlugin,
    withAndroidNotificationBranding,
    "@react-native-community/datetimepicker",
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
