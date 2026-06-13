const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");
const fs = require("fs");
const path = require("path");

const LARGE_ICON_META = "expo.modules.notifications.large_notification_icon";

const LARGE_ICON_BASELINE_DP = 64;
const DPI_VALUES = {
  mdpi: { folderName: "drawable-mdpi", scale: 1 },
  hdpi: { folderName: "drawable-hdpi", scale: 1.5 },
  xhdpi: { folderName: "drawable-xhdpi", scale: 2 },
  xxhdpi: { folderName: "drawable-xxhdpi", scale: 3 },
  xxxhdpi: { folderName: "drawable-xxxhdpi", scale: 4 },
};

const LARGE_ICON_DRAWABLE = "notification_app_icon";

/**
 * Android notification layout:
 * - Left / status bar: white O small icon (expo-notifications) on white circle (#ffffff).
 * - Right: full launcher via largeIcon (flat PNG — adaptive @mipmap/ic_launcher cannot decode).
 */
function withAndroidNotificationBranding(config) {
  config = withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      LARGE_ICON_META,
      `@drawable/${LARGE_ICON_DRAWABLE}`,
      "resource",
    );

    return config;
  });

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const launcherIcon = path.join(projectRoot, "assets/images/icon.png");
      const resRoot = path.join(projectRoot, "android/app/src/main/res");

      if (fs.existsSync(launcherIcon)) {
        await Promise.all(
          Object.values(DPI_VALUES).map(async ({ folderName, scale }) => {
            const dpiFolder = path.join(resRoot, folderName);
            await fs.promises.mkdir(dpiFolder, { recursive: true });
            const sizePx = Math.round(LARGE_ICON_BASELINE_DP * scale);
            const { source } = await generateImageAsync(
              {
                projectRoot,
                cacheType: `oorjaman-notification-large-${sizePx}`,
              },
              {
                src: launcherIcon,
                width: sizePx,
                height: sizePx,
                resizeMode: "contain",
                backgroundColor: "#ffffff",
              },
            );
            await fs.promises.writeFile(
              path.join(dpiFolder, `${LARGE_ICON_DRAWABLE}.png`),
              source,
            );
          }),
        );
      }

      return config;
    },
  ]);
}

module.exports = withAndroidNotificationBranding;
