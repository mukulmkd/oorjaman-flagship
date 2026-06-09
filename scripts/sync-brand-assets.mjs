#!/usr/bin/env node
/**
 * Copy brand masters from brand/source/ into every app.
 *
 * Required in brand/source/:
 *   logo-icon.{png,jpg,jpeg}           — mark only, no text
 *   logo-lockup-tagline.{png,jpg,jpeg} — wordmark + tagline
 *
 * Optional:
 *   logo-lockup.{png,jpg,jpeg}         — wordmark without tagline
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
  lockup: ["logo-lockup.png", "logo-lockup.jpg", "logo-lockup.jpeg"],
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

  const lockupSrc = findSource("lockup");
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

  /**
   * Badge placement tuned for iOS squircle / Android adaptive masks (keep inside ~88% safe area).
   */
  function technicianBadgePlacement(canvasSize, badgeSize) {
    return {
      left: Math.round(canvasSize * 0.68 - badgeSize * 0.12),
      top: Math.round(canvasSize * 0.08),
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

    const badgeSize = Math.max(48, Math.round(size * 0.24));
    const badgeBuf = await sharp(Buffer.from(technicianPersonaBadgeSvg(badgeSize))).png().toBuffer();
    const { left, top } = technicianBadgePlacement(size, badgeSize);

    writeBuffer(
      outPath,
      await sharp(base).composite([{ input: badgeBuf, left, top }]).png().toBuffer(),
    );
  }

  /** Trim whitespace and scale the Big O to fill the canvas (transparent background). */
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

  async function emitIcon(outPath, size = 1024) {
    const isAdaptive = outPath.endsWith("adaptive-icon.png");
    await emitAppIcon(outPath, size, isAdaptive ? 0.74 : 0.9);
  }

  async function emitLockup(outPath, src, maxWidth = 1200) {
    if (sharp) {
      writeBuffer(outPath, await toPngBuffer(sharp, src, maxWidth, null));
    } else {
      copyRaw(outPath, src);
    }
  }

  async function emitNotification(outPath) {
    if (sharp) {
      writeBuffer(outPath, await toPngBuffer(sharp, notifSrc, 96, 96));
    } else {
      copyRaw(outPath, notifSrc);
    }
  }

  /** Technician native splash: persona Big O centered on white. */
  async function emitTechnicianNativeSplash(outPath) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const iconSize = 360;
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

    const badgeSize = Math.max(40, Math.round(iconSize * 0.24));
    const badgeBuf = await sharp(Buffer.from(technicianPersonaBadgeSvg(badgeSize))).png().toBuffer();
    const { left: badgeLeft, top: badgeTop } = technicianBadgePlacement(iconSize, badgeSize);
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

  /** Native Expo splash: icon only on white — animated lockup is in-app. */
  async function emitNativeSplash(outPath) {
    if (!sharp) {
      copyRaw(outPath, iconSrc);
      return;
    }
    const iconSize = 320;
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

  const mobileApps = ["customer-app", "technician-app"];
  for (const app of mobileApps) {
    const base = join(repoRoot, "apps", app);
    const images = join(base, "assets/images");
    const brand = join(base, "assets/brand");
    mkdirSync(images, { recursive: true });
    mkdirSync(brand, { recursive: true });

    const isTechnician = app === "technician-app";
    if (isTechnician) {
      await emitTechnicianAppIcon(join(images, "icon.png"));
      await emitTechnicianAppIcon(join(images, "adaptive-icon.png"), 1024, 0.64);
      await emitTechnicianNativeSplash(join(images, "splash-icon.png"));
    } else {
      await emitIcon(join(images, "icon.png"));
      await emitIcon(join(images, "adaptive-icon.png"));
      await emitNativeSplash(join(images, "splash-icon.png"));
    }
    await emitIcon(join(brand, "logo-icon.png"));
    await emitLockup(join(brand, "logo-lockup-tagline.png"), lockupTaglineSrc, 1200);
    if (lockupSrc) {
      await emitLockup(join(brand, "logo-lockup.png"), lockupSrc, 1200);
    }
    await emitNotification(join(images, "notification-icon.png"));

    const lottieSrc = join(repoRoot, "apps/customer-app/assets/brand/splash-progress.json");
    if (existsSync(lottieSrc)) {
      copyRaw(join(brand, "splash-progress.json"), lottieSrc);
    }

    const sunburstSrc = join(repoRoot, "apps/customer-app/assets/brand/sunburst.png");
    if (existsSync(sunburstSrc)) {
      copyRaw(join(brand, "sunburst.png"), sunburstSrc);
    }
  }

  const webApps = ["admin-web", "vendor-web", "support-web", "oorjaman-web"];
  for (const app of webApps) {
    const pub = join(repoRoot, "apps", app, "public");
    mkdirSync(pub, { recursive: true });
    await emitIcon(join(pub, "favicon.png"), 32);
    await emitIcon(join(pub, "apple-touch-icon.png"), 180);
    await emitIcon(join(pub, "logo-icon.png"), 256);
    await emitLockup(join(pub, "logo-lockup-tagline.png"), lockupTaglineSrc, 800);
    if (app === "oorjaman-web") {
      await emitLockup(join(pub, "og-default.png"), lockupTaglineSrc, 1200);
    }
  }

  console.log("\nBrand sync complete. Rebuild native apps to refresh icons (expo prebuild / EAS).");
}

void main();
