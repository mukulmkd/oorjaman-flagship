import type { ExpoConfig } from "expo/config";
import withIosPodfileFixes from "./plugins/withIosPodfileFixes";
import withCustomerNativeBranding from "./plugins/withCustomerNativeBranding";
import withAndroidWhiteAdaptiveIcon from "./plugins/withAndroidWhiteAdaptiveIcon";
import withAndroidNotificationBranding from "./plugins/withAndroidNotificationBranding";

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
    icon: "./assets/images/icon.png",
    // Smaller adaptive-foreground.png fits the 66dp safe zone (home circle mask).
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-foreground.png",
      backgroundColor: "#ffffff",
    },
    package: isUat ? "com.oorjaman.customer.uat" : "com.oorjaman.customer",
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
    withCustomerNativeBranding,
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
