import type { ExpoConfig } from "expo/config";
import {
  withIosPodfileFixes,
  withNativeDisplayName,
  withAndroidWhiteAdaptiveIcon,
  withAndroidNotificationBranding,
  withAndroidPhoneOnlyScreens,
} from "@oorjaman/mobile-config";
import {
  expoBuildPropertiesFromSource,
  splashScreenPlugin,
  notificationsPlugin,
} from "@oorjaman/mobile-config/shared-plugins";

const deployEnv = (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? "").trim().toLowerCase();
const isUat = deployEnv === "uat" || deployEnv === "staging";
const displayName = isUat ? "OorjaMan Partner (UAT)" : "OorjaMan Partner";

const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "a89deab7-9f4e-4411-a533-061002c8b049";

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
    supportsTablet: false,
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
    permissions: ["android.permission.CAMERA"],
  },
  // Universal Web (CSR SPA). Do not put native identity fields here.
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
    name: displayName,
  },
  plugins: [
    expoBuildPropertiesFromSource,
    withIosPodfileFixes,
    withNativeDisplayName,
    withAndroidWhiteAdaptiveIcon,
    withAndroidPhoneOnlyScreens,
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
        cameraPermission: "Allow OorjaMan Partner to capture your passport photo and job site evidence.",
      },
    ],
  ] as NonNullable<ExpoConfig["plugins"]>,
  experiments: {
    typedRoutes: true,
  },
  updates: {
    url: `https://u.expo.dev/${easProjectId}`,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    eas: {
      // Fallback lets EAS CLI link without writing app.config.ts (env not loaded for credentials).
      projectId: easProjectId,
    },
  },
};

export default config;
