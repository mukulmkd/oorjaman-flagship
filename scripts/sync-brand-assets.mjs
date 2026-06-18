#!/usr/bin/env node
/**
 * Copy brand masters from brand/source/ into every app.
 *
 * Required in brand/source/:
 *   logo-icon.{png,jpg,jpeg}           — mark only, no text
 *   logo-lockup-tagline.{png,jpg,jpeg} — wordmark + tagline (OG / marketing only)
 *
 * Optional:
 *   notification-icon.png              — white mono 96×96; else copied from icon
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const sourceDir = join(repoRoot, "brand/source");

const SOURCE_ALIASES = {
  icon: ["logo-icon.png", "logo-icon.jpg", "logo-icon.jpeg", "logo-without-text.png", "logo-without-text.jpg"],
  lockupTagline: [
    "logo-lockup-tagline.png",
    "logo-lockup-tagline.jpg",
    "logo-lockup-tagline.jpeg",
    "logo-with-text.png",
    "logo-with-text.jpg",
    "logo-with-text.jpeg",
    "logo.jpeg",
    "logo.jpg",
  ],
  notification: ["notification-icon.png"],
};

function findSource(kind) {
  const names = SOURCE_ALIASES[kind] ?? [];
  for (const name of names) {
    const p = join(sourceDir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch {
    return null;
  }
}

async function toPngBuffer(sharp, inputPath, width, height) {
  let img = sharp(inputPath);
  const meta = await img.metadata();
  if (width && height) {
    img = img.resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  } else if (width) {
    img = img.resize(width, null, { fit: "inside", withoutEnlargement: false });
  }
  if (meta.format === "png") {
    return img.png().toBuffer();
  }
  return img.png({ quality: 100, compressionLevel: 9 }).toBuffer();
}

function writeBuffer(outPath, buf) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath}`);
}

function copyRaw(outPath, inputPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  copyFileSync(inputPath, outPath);
  console.log(`copied ${outPath}`);
}

async function main() {
  const webOnly =
    process.env.BRAND_SYNC_WEB_ONLY === "1" || process.argv.includes("--web-only");

  const iconSrc = findSource("icon");
  const lockupTaglineSrc = findSource("lockupTagline");
  if (!iconSrc) {
    console.error(
      "Missing brand/source/logo-icon.png (or .jpg) — icon only, no text.\n" +
        "See brand/README.md",
    );
    process.exit(1);
  }
  if (!lockupTaglineSrc) {
    console.error(
      "Missing brand/source/logo-lockup-tagline.png (or .jpg) — logo with tagline.\n" +
        "See brand/README.md",
    );
    process.exit(1);
  }

  const notifSrc = findSource("notification") ?? iconSrc;

  const sharp = await loadSharp();
  if (!sharp) {
    console.warn("sharp not installed — copying files without resize. Run: npm install -D sharp");
  }

  /** Persona badge SVG — matches in-app BrandLogoIcon (partner app only). */
  function technicianPersonaBadgeSvg(badgeSize) {
    const stroke = Math.max(3, Math.round(badgeSize * 0.06));
    const r = badgeSize / 2 - stroke / 2;
    const cx = badgeSize / 2;
    const cy = badgeSize / 2;
    const personScale = (badgeSize / 24) * 0.52;
    const personX = cx - 12 * personScale;
    const personY = cy - 11 * personScale;
    return `<svg width="${badgeSize}" height="${badgeSize}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1C4276" flood-opacity="0.18"/>
    </filter>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#549048" stroke-width="${stroke}" filter="url(#shadow)"/>
  <g transform="translate(${personX}, ${personY}) scale(${personScale})">
    <circle cx="12" cy="7.5" r="3.8" fill="#1C4276"/>
    <path d="M5 19.5c0-3.5 3.1-6 7-6s7 2.5 7 6" fill="#1C4276"/>
  </g>
</svg>`;
  }

  /** App drawer / iOS icon — contain-fit; ~88% keeps side whitespace from feeling stretched. */
  const ANDROID_LAUNCHER_LOGO_FILL = 0.88;
  /** Home-screen adaptive safe zone (~66% of launcher fill) — avoids circle-mask crop. */
  const ANDROID_ADAPTIVE_FOREGROUND_FILL =
    ANDROID_LAUNCHER_LOGO_FILL * 0.66;

  /**
   * Persona badge anchored to the O bounding box (not the canvas corner) so
   * Android circle masks do not clip it. Home adaptive uses a smaller badge.
   */
  function technicianBadgePlacementOnO(
    canvasSize,
    oFillRatio,
    { badgeSizeRatio, insetOnORatio },
  ) {
    const oTarget = Math.round(canvasSize * oFillRatio);
    const oLeft = Math.floor((canvasSize - oTarget) / 2);
    const oTop = Math.floor((canvasSize - oTarget) / 2);
    const badgeSize = Math.max(6, Math.round(canvasSize * badgeSizeRatio));
    const inset = Math.max(4, Math.round(oTarget * insetOnORatio));
    return {
      badgeSize,
      left: oLeft + oTarget - badgeSize - inset,
      top: oTop + inset,
    };
  }

  /** Technician launcher icon: Big O + persona badge on the top-right. */
  async function emitTechnicianAppIcon(outPath, size = 1024, fillRatio = 0.78) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(size * fillRatio);
    const base = await trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((size - target) / 2),
        bottom: Math.ceil((size - target) / 2),
        left: Math.floor((size - target) / 2),
        right: Math.ceil((size - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const { badgeSize, left, top } = technicianBadgePlacementOnO(size, fillRatio, {
      badgeSizeRatio: 0.2,
      insetOnORatio: 0.06,
    });
    const badgeBuf = await sharp(Buffer.from(technicianPersonaBadgeSvg(badgeSize))).png().toBuffer();

    writeBuffer(
      outPath,
      await sharp(base).composite([{ input: badgeBuf, left, top }]).png().toBuffer(),
    );
  }

  const SPLASH_LOGO_IOS_PX = 620;
  /** Matches BrandSplash `O_SIZE` (196pt) — native pre-splash logo width in dp. */
  const SPLASH_ANDROID_IMAGE_WIDTH = 196;

  /** Transparent-background logo (in-app lockups, brand folder). */
  async function emitAppIcon(outPath, size = 1024, fillRatio = 0.9) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(size * fillRatio);
    const iconBuf = await trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((size - target) / 2),
        bottom: Math.ceil((size - target) / 2),
        left: Math.floor((size - target) / 2),
        right: Math.ceil((size - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    writeBuffer(outPath, iconBuf);
  }

  /** Google-style launcher: opaque white square with centred logo composited on top. */
  async function emitFlatLauncherIcon(outPath, logoBuf, size = 1024) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const meta = await sharp(logoBuf).metadata();
    const lw = meta.width ?? size;
    const lh = meta.height ?? size;
    const left = Math.floor((size - lw) / 2);
    const top = Math.floor((size - lh) / 2);
    writeBuffer(
      outPath,
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([{ input: logoBuf, left, top }])
        .png()
        .toBuffer(),
    );
  }

  /**
   * Launcher logo — contain at max size so the full O is never cropped (uneven
   * white sides are fine; matches Google Contacts-style respectful scaling).
   */
  async function emitLauncherLogoSquare(size = 1024, fillRatio = ANDROID_LAUNCHER_LOGO_FILL) {
    if (!sharp) {
      return readFileSync(iconSrc);
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(size * fillRatio);
    return trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((size - target) / 2),
        bottom: Math.ceil((size - target) / 2),
        left: Math.floor((size - target) / 2),
        right: Math.ceil((size - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  /** Technician launcher: same O sizing as customer + persona badge on the O. */
  async function emitTechnicianLauncherLogoBuf(launcherFill, badgeOpts) {
    if (!sharp) {
      return readFileSync(iconSrc);
    }
    const size = 1024;
    const base = await emitLauncherLogoSquare(size, launcherFill);
    const { badgeSize, left, top } = technicianBadgePlacementOnO(size, launcherFill, badgeOpts);
    const badgeBuf = await sharp(Buffer.from(technicianPersonaBadgeSvg(badgeSize))).png().toBuffer();
    return sharp(base).composite([{ input: badgeBuf, left, top }]).png().toBuffer();
  }

  /** Trimmed logo on transparent square — contain padding (in-app / adaptive foreground). */
  async function emitTransparentLogoSquare(size = 1024, fillRatio = ANDROID_LAUNCHER_LOGO_FILL) {
    if (!sharp) {
      return readFileSync(iconSrc);
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(size * fillRatio);
    return trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((size - target) / 2),
        bottom: Math.ceil((size - target) / 2),
        left: Math.floor((size - target) / 2),
        right: Math.ceil((size - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  /**
   * Android pre-splash: transparent O only, fills the imageWidth box (matches BrandSplash O_SIZE).
   */
  async function emitAndroidSplashIcon(outPath, size = 1024) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const logoBuf = await trimmed
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    writeBuffer(outPath, logoBuf);
  }

  /** Technician Android pre-splash: O + badge at BrandSplash scale (imageWidth dp). */
  async function emitTechnicianAndroidSplashIcon(outPath, size = 1024) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(size * 0.78);
    const base = await trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((size - target) / 2),
        bottom: Math.ceil((size - target) / 2),
        left: Math.floor((size - target) / 2),
        right: Math.ceil((size - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const { badgeSize, left, top } = technicianBadgePlacementOnO(size, 0.78, {
      badgeSizeRatio: 0.18,
      insetOnORatio: 0.08,
    });
    const badgeBuf = await sharp(Buffer.from(technicianPersonaBadgeSvg(badgeSize))).png().toBuffer();
    writeBuffer(
      outPath,
      await sharp(base).composite([{ input: badgeBuf, left, top }]).png().toBuffer(),
    );
  }

  function dilateAlphaMask(mask, width, height, radius = 2) {
    const out = new Uint8Array(mask.length);
    const r2 = radius * radius;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y * width + x]) continue;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > r2) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              out[ny * width + nx] = 1;
            }
          }
        }
      }
    }
    return out;
  }

  function complementAlphaMask(mask) {
    const out = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1;
    return out;
  }

  /** Morphological close — dilate then erode; bridges thin gaps between O segments. */
  function closeAlphaMask(mask, width, height, radius = 2) {
    const dilated = dilateAlphaMask(mask, width, height, radius);
    const eroded = complementAlphaMask(
      dilateAlphaMask(complementAlphaMask(dilated), width, height, radius),
    );
    return eroded;
  }

  /**
   * White silhouette with internal segment gaps closed — reads as one O at 24dp.
   * Keeps the outer ring hole; merges thin transparent slits between logo segments.
   */
  async function rgbaToSolidWhiteSilhouette(rgbaSource) {
    const { data, info } = await sharp(rgbaSource)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;

    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      mask[i] = data[i * 4 + 3] > 32 ? 1 : 0;
    }
    const closed = closeAlphaMask(mask, width, height, 2);

    const white = Buffer.alloc(width * height * 4);
    for (let i = 0; i < closed.length; i++) {
      if (closed[i]) {
        const o = i * 4;
        white[o] = 255;
        white[o + 1] = 255;
        white[o + 2] = 255;
        white[o + 3] = 255;
      }
    }

    return sharp(white, {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();
  }

  /** White silhouette PNG from RGBA buffer (O only or O + persona badge). */
  async function emitMonochromeFromBuffer(outPath, rgbaSource) {
    if (!sharp) {
      copyRaw(outPath, findSource("notification") ?? iconSrc);
      return;
    }
    const { data, info } = await sharp(rgbaSource)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const white = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 32) {
        white[i] = 255;
        white[i + 1] = 255;
        white[i + 2] = 255;
        white[i + 3] = 255;
      }
    }

    writeBuffer(
      outPath,
      await sharp(white, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png()
        .toBuffer(),
    );
  }

  /** White O silhouette at launcher fill ratio for Android 13+ themed icons. */
  async function emitAdaptiveMonochrome(outPath, size = 1024, fillRatio = ANDROID_LAUNCHER_LOGO_FILL) {
    if (!sharp) {
      copyRaw(outPath, findSource("notification") ?? iconSrc);
      return;
    }
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(size * fillRatio);
    const rgbaSource = await trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((size - target) / 2),
        bottom: Math.ceil((size - target) / 2),
        left: Math.floor((size - target) / 2),
        right: Math.ceil((size - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await emitMonochromeFromBuffer(outPath, rgbaSource);
  }

  async function emitAdaptiveBackground(outPath, size = 1024) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    writeBuffer(
      outPath,
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
    );
  }

  async function emitCustomerLauncherAssets(images) {
    if (!sharp) {
      copyRaw(join(images, "icon.png"), iconSrc);
      copyRaw(join(images, "splash-android-icon.png"), iconSrc);
      copyRaw(join(images, "adaptive-foreground.png"), iconSrc);
      copyRaw(join(images, "adaptive-background.png"), iconSrc);
      copyRaw(join(images, "monochrome-icon.png"), iconSrc);
      return;
    }
    const logoBuf = await emitLauncherLogoSquare();
    const adaptiveLogoBuf = await emitLauncherLogoSquare(
      1024,
      ANDROID_ADAPTIVE_FOREGROUND_FILL,
    );
    const iconPath = join(images, "icon.png");
    await emitFlatLauncherIcon(iconPath, logoBuf);
    await emitFlatLauncherIcon(join(images, "adaptive-foreground.png"), adaptiveLogoBuf);
    await emitAdaptiveBackground(join(images, "adaptive-background.png"));
    await emitAdaptiveMonochrome(join(images, "monochrome-icon.png"));
    await emitAndroidSplashIcon(join(images, "splash-android-icon.png"));
  }

  async function emitLockup(outPath, src, maxWidth = 1200) {
    if (sharp) {
      writeBuffer(outPath, await toPngBuffer(sharp, src, maxWidth, null));
    } else {
      copyRaw(outPath, src);
    }
  }

  /**
   * Android status-bar icon — white O silhouette on transparent 96×96 only.
   * Status-bar glyph only (white on transparent). The shade uses the full launcher
   * via large_notification_icon — never bake a coloured or black background here.
   */
  const NOTIFICATION_ICON_PX = 96;
  const NOTIFICATION_LOGO_FILL = 0.88;

  async function emitAndroidNotificationIcon(outPath, logoBuffer = null) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }

    const canvas = NOTIFICATION_ICON_PX;
    const target = Math.round(canvas * NOTIFICATION_LOGO_FILL);
    const logoPng =
      logoBuffer ??
      (await sharp(iconSrc)
        .trim({ threshold: 12 })
        .resize(target, target, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .extend({
          top: Math.floor((canvas - target) / 2),
          bottom: Math.ceil((canvas - target) / 2),
          left: Math.floor((canvas - target) / 2),
          right: Math.ceil((canvas - target) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer());

    writeBuffer(outPath, await rgbaToSolidWhiteSilhouette(logoPng));
  }

  async function emitNotification(outPath) {
    await emitAndroidNotificationIcon(outPath);
  }

  /** Partner app: same O mark at notification size (badge is too small for status bar). */
  async function emitTechnicianNotification(outPath) {
    await emitAndroidNotificationIcon(outPath);
  }

  /** Technician native splash: persona Big O centered on white. */
  async function emitTechnicianNativeSplash(outPath) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const iconSize = SPLASH_LOGO_IOS_PX;
    const trimmed = sharp(iconSrc).trim({ threshold: 12 });
    const target = Math.round(iconSize * 0.78);
    const base = await trimmed
      .resize(target, target, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((iconSize - target) / 2),
        bottom: Math.ceil((iconSize - target) / 2),
        left: Math.floor((iconSize - target) / 2),
        right: Math.ceil((iconSize - target) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const { badgeSize, left: badgeLeft, top: badgeTop } = technicianBadgePlacementOnO(
      iconSize,
      0.78,
      { badgeSizeRatio: 0.2, insetOnORatio: 0.06 },
    );
    const badgeBuf = await sharp(Buffer.from(technicianPersonaBadgeSvg(badgeSize))).png().toBuffer();
    const iconBuf = await sharp(base)
      .composite([
        {
          input: badgeBuf,
          left: badgeLeft,
          top: badgeTop,
        },
      ])
      .png()
      .toBuffer();

    const canvas = sharp({
      create: {
        width: 1284,
        height: 2778,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });
    const left = Math.round((1284 - iconSize) / 2);
    const top = Math.round((2778 - iconSize) / 2);
    writeBuffer(
      outPath,
      await canvas
        .composite([{ input: iconBuf, left, top }])
        .png()
        .toBuffer(),
    );
  }

  /** iOS Launch Screen + legacy full-bleed: large centred O (~BrandSplash 196pt scale). */
  async function emitNativeSplash(outPath, iconSize = SPLASH_LOGO_IOS_PX) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const trimmedIcon = sharp(iconSrc).trim({ threshold: 12 });
    const iconBuf = await trimmedIcon
      .resize(iconSize, iconSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const canvas = sharp({
      create: {
        width: 1284,
        height: 2778,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    });
    const left = Math.round((1284 - iconSize) / 2);
    const top = Math.round((2778 - iconSize) / 2);
    writeBuffer(
      outPath,
      await canvas
        .composite([{ input: iconBuf, left, top }])
        .png()
        .toBuffer(),
    );
  }

  const mobileApps = ["customer-app", "technician-app"].filter((app) => {
    const only = process.env.BRAND_SYNC_APP?.trim();
    return !only || app === only;
  });
  if (webOnly) {
    console.log("brand:sync — web portals only (skipped mobile app assets)");
  } else {
  const syncOnly = process.env.BRAND_SYNC_APP?.trim();
  if (syncOnly) {
    console.log(`brand:sync — mobile assets for ${syncOnly} only`);
  }
  for (const app of mobileApps) {
    const base = join(repoRoot, "apps", app);
    const images = join(base, "assets/images");
    const brand = join(base, "assets/brand");
    mkdirSync(images, { recursive: true });
    mkdirSync(brand, { recursive: true });

    const isTechnician = app === "technician-app";
    if (isTechnician) {
      if (!sharp) {
        copyRaw(join(images, "icon.png"), iconSrc);
        copyRaw(join(images, "adaptive-foreground.png"), iconSrc);
        copyRaw(join(images, "adaptive-background.png"), iconSrc);
        copyRaw(join(images, "monochrome-icon.png"), iconSrc);
        copyRaw(join(images, "splash-android-icon.png"), iconSrc);
        copyRaw(join(images, "splash-icon.png"), iconSrc);
      } else {
      const techLogoBuf = await emitTechnicianLauncherLogoBuf(ANDROID_LAUNCHER_LOGO_FILL, {
        badgeSizeRatio: 0.2,
        insetOnORatio: 0.06,
      });
      const techAdaptiveLogoBuf = await emitTechnicianLauncherLogoBuf(
        ANDROID_ADAPTIVE_FOREGROUND_FILL,
        { badgeSizeRatio: 0.16, insetOnORatio: 0.12 },
      );
      const iconPath = join(images, "icon.png");
      await emitFlatLauncherIcon(iconPath, techLogoBuf);
      await emitFlatLauncherIcon(join(images, "adaptive-foreground.png"), techAdaptiveLogoBuf);
      await emitAdaptiveBackground(join(images, "adaptive-background.png"));
      await emitMonochromeFromBuffer(join(images, "monochrome-icon.png"), techLogoBuf);
      await emitTechnicianAndroidSplashIcon(join(images, "splash-android-icon.png"));
      await emitTechnicianNativeSplash(join(images, "splash-icon.png"));
      }
    } else {
      await emitCustomerLauncherAssets(images);
      await emitNativeSplash(join(images, "splash-icon.png"));
    }
    await emitAppIcon(join(brand, "logo-icon.png"));
    if (isTechnician) {
      await emitTechnicianNotification(join(images, "notification-icon.png"));
    } else {
      await emitNotification(join(images, "notification-icon.png"));
    }
    const sunburstSrc = join(repoRoot, "apps/customer-app/assets/brand/sunburst.png");
    if (existsSync(sunburstSrc)) {
      copyRaw(join(brand, "sunburst.png"), sunburstSrc);
    }
  }

  const sharedBrandDir = join(repoRoot, "packages/ui/assets/brand");
  mkdirSync(sharedBrandDir, { recursive: true });
  const customerBrandIcon = join(repoRoot, "apps/customer-app/assets/brand/logo-icon.png");
  const customerBrandSunburst = join(repoRoot, "apps/customer-app/assets/brand/sunburst.png");
  if (existsSync(customerBrandIcon)) {
    copyRaw(join(sharedBrandDir, "logo-icon.png"), customerBrandIcon);
  }
  if (existsSync(customerBrandSunburst)) {
    copyRaw(join(sharedBrandDir, "sunburst.png"), customerBrandSunburst);
  }
  }

  const webApps = ["admin-web", "vendor-web", "support-web", "oorjaman-web"];
  for (const app of webApps) {
    const pub = join(repoRoot, "apps", app, "public");
    mkdirSync(pub, { recursive: true });
    const isVendorPortal = app === "vendor-web";
    const emitWebIcon = isVendorPortal ? emitTechnicianAppIcon : (p, s, f) => emitAppIcon(p, s ?? 1024, f ?? 0.9);
    await emitWebIcon(join(pub, "favicon.png"), 32, isVendorPortal ? 0.9 : undefined);
    await emitWebIcon(join(pub, "apple-touch-icon.png"), 180, isVendorPortal ? 0.9 : undefined);
    await emitWebIcon(join(pub, "logo-icon.png"), 256, isVendorPortal ? 0.9 : undefined);
    if (lockupTaglineSrc) {
      await emitLockup(join(pub, "logo-lockup-tagline.png"), lockupTaglineSrc, 720);
      if (app === "admin-web") {
        await emitLockup(join(pub, "logo-lockup-tagline-print.png"), lockupTaglineSrc, 2800);
      }
    }
    if (app === "oorjaman-web") {
      await emitLockup(join(pub, "og-default.png"), lockupTaglineSrc, 1200);
    }
  }

  if (sharp) {
    const masterNotif = join(sourceDir, "notification-icon.png");
    await emitNotification(masterNotif);
    console.log(
      "wrote brand/source/notification-icon.png (white O on transparent — Android status bar)",
    );
  }

  console.log(
    `\nBrand sync complete (Android splash imageWidth=${SPLASH_ANDROID_IMAGE_WIDTH}). For native Android builds, run per app:`,
  );
  console.log("  npx expo prebuild --platform android");
  console.log("  adb uninstall <package>   # launchers cache icons");
  console.log("  npx expo run:android   # or eas build");
}

void main();
