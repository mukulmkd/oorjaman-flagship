const {
  withDangerousMod,
  withAndroidManifest,
  AndroidConfig,
} = require("expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");
const fs = require("fs");
const path = require("path");

/**
 * Pixel home screen uses adaptive-icon layers; the app drawer uses flat ic_launcher.
 * A green ring on home only is usually Pixel Launcher caching or its color pipeline —
 * we ship opaque white foreground + white background bitmap + white monochrome so
 * the launcher has nothing green to extract.
 */
const DPI_VALUES = {
  mdpi: { folderName: "mipmap-mdpi", scale: 1 },
  hdpi: { folderName: "mipmap-hdpi", scale: 1.5 },
  xhdpi: { folderName: "mipmap-xhdpi", scale: 2 },
  xxhdpi: { folderName: "mipmap-xxhdpi", scale: 3 },
  xxxhdpi: { folderName: "mipmap-xxxhdpi", scale: 4 },
};

const LEGACY_BASELINE_PX = 48;
const ADAPTIVE_BASELINE_PX = 108;

async function writeResizedWebp(projectRoot, outPath, src, sizePx, options) {
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: `oorjaman-${path.basename(outPath)}-${sizePx}` },
    {
      src,
      width: sizePx,
      height: sizePx,
      resizeMode: "contain",
      ...options,
    },
  );
  await fs.promises.writeFile(outPath, source);
}

async function rewriteLauncherMipmaps(projectRoot, resRoot) {
  const drawerIcon = path.join(projectRoot, "assets/images/icon.png");
  const homeForeground = path.join(
    projectRoot,
    "assets/images/adaptive-foreground.png",
  );
  const whiteBackground = path.join(
    projectRoot,
    "assets/images/adaptive-background.png",
  );
  const whiteMonochrome = path.join(
    projectRoot,
    "assets/images/monochrome-icon.png",
  );

  if (!fs.existsSync(drawerIcon) || !fs.existsSync(homeForeground)) {
    return;
  }

  await Promise.all(
    Object.values(DPI_VALUES).map(async ({ folderName, scale }) => {
      const dpiFolder = path.join(resRoot, folderName);
      await fs.promises.mkdir(dpiFolder, { recursive: true });

      const legacySize = Math.round(LEGACY_BASELINE_PX * scale);
      const adaptiveSize = Math.round(ADAPTIVE_BASELINE_PX * scale);

      await writeResizedWebp(
        projectRoot,
        path.join(dpiFolder, "ic_launcher.webp"),
        drawerIcon,
        legacySize,
        { backgroundColor: "#ffffff" },
      );

      await writeResizedWebp(
        projectRoot,
        path.join(dpiFolder, "ic_launcher_foreground.webp"),
        homeForeground,
        adaptiveSize,
        { backgroundColor: "#ffffff" },
      );

      if (fs.existsSync(whiteBackground)) {
        await writeResizedWebp(
          projectRoot,
          path.join(dpiFolder, "ic_launcher_background.webp"),
          whiteBackground,
          adaptiveSize,
          { backgroundColor: "#ffffff" },
        );
      }

      if (fs.existsSync(whiteMonochrome)) {
        await writeResizedWebp(
          projectRoot,
          path.join(dpiFolder, "ic_launcher_monochrome.webp"),
          whiteMonochrome,
          adaptiveSize,
          { backgroundColor: "transparent" },
        );
      }

      for (const legacyRound of ["ic_launcher_round.webp"]) {
        const roundPath = path.join(dpiFolder, legacyRound);
        if (fs.existsSync(roundPath)) {
          await fs.promises.unlink(roundPath);
        }
      }
    }),
  );
}

function patchAdaptiveXml(resRoot) {
  const adaptiveDir = path.join(resRoot, "mipmap-anydpi-v26");
  if (!fs.existsSync(adaptiveDir)) return;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>`;

  for (const xmlName of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    fs.writeFileSync(path.join(adaptiveDir, xmlName), xml);
  }
}

function withAndroidWhiteAdaptiveIcon(config) {
  config = withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    delete app.$["android:roundIcon"];
    return config;
  });

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const resRoot = path.join(root, "android/app/src/main/res");

      await rewriteLauncherMipmaps(root, resRoot);
      patchAdaptiveXml(resRoot);

      const colorsPath = path.join(resRoot, "values/colors.xml");
      if (fs.existsSync(colorsPath)) {
        let colors = fs.readFileSync(colorsPath, "utf8");
        if (colors.includes('name="iconBackground"')) {
          colors = colors.replace(
            /<color name="iconBackground">[^<]*<\/color>/,
            '<color name="iconBackground">#ffffff</color>',
          );
        }
        fs.writeFileSync(colorsPath, colors);
      }

      return config;
    },
  ]);
}

module.exports = withAndroidWhiteAdaptiveIcon;
