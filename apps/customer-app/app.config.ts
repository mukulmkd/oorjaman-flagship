import type { ExpoConfig } from "expo/config";

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

const config: ExpoConfig = {
  name: "OorjaMan",
  slug: "customer-app",
  scheme: "oorjaman-customer",
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
    bundleIdentifier: "com.oorjaman.customer",
    ...(googleMapsApiKey ? { config: { googleMapsApiKey } } : {}),
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#1f8660",
    },
    package: "com.oorjaman.customer",
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
    "expo-router",
    "expo-notifications",
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
};

export default config;
