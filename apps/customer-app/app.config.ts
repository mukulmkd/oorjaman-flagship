import type { ExpoConfig } from "expo/config";
// @ts-expect-error local config plugin (CommonJS)
import withCustomerNativeBranding from "./plugins/withCustomerNativeBranding";

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
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: isUat ? "com.oorjaman.customer.uat" : "com.oorjaman.customer",
    infoPlist: {
      CFBundleDisplayName: displayName,
      CFBundleName: displayName,
    },
    ...(googleMapsApiKey ? { config: { googleMapsApiKey } } : {}),
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#1f8660",
    },
    package: isUat ? "com.oorjaman.customer.uat" : "com.oorjaman.customer",
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
    withCustomerNativeBranding,
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
