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

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
const deployEnv = (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? "").trim().toLowerCase();
const isUat = deployEnv === "uat" || deployEnv === "staging";
const displayName = isUat ? "OorjaMan (UAT)" : "OorjaMan";

const config: ExpoConfig = {
  // Home-screen label on iOS (CFBundleDisplayName) and Android (app_name).
  name: displayName,
  slug: "customer-app",
  scheme: isUat ? "oorjaman-customer-uat" : "oorjaman-customer",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  ios: {
    deploymentTarget: "16.4",
    supportsTablet: true,
    bundleIdentifier: isUat ? "com.oorjaman.customer.uat" : "com.oorjaman.customer",
    ...(googleMapsApiKey ? { config: { googleMapsApiKey } } : {}),
  },
  android: {
    icon: "./assets/images/icon.png",
    // Smaller adaptive-foreground.png fits the 66dp safe zone (home circle mask).
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-foreground.png",
      backgroundColor: "#ffffff",
    },
    package: isUat ? "com.oorjaman.customer.uat" : "com.oorjaman.customer",
    softwareKeyboardLayoutMode: "resize",
    permissions: ["android.permission.CAMERA"],
    ...(googleMapsApiKey
      ? {
          config: {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          },
        }
      : {}),
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
    "expo-font",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "OorjaMan uses your location to tag rooftop site photos with GPS, match nearby cleaning partners, and improve visit ETAs.",
        locationAlwaysAndWhenInUsePermission:
          "OorjaMan uses your location to tag rooftop site photos with GPS, match nearby cleaning partners, and improve visit ETAs.",
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "OorjaMan needs photo access so you can attach geo-tagged images of your solar site.",
        cameraPermission:
          "OorjaMan needs camera access to capture geo-tagged photos of your rooftop for our crew.",
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
