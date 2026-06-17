#!/usr/bin/env node
/**
 * Copy a freshly built Gradle APK to a dated UAT filename in apps/<app>/dist/.
 *
 * Usage: node scripts/rename-uat-apk.mjs <customer-app|technician-app> [release|debug]
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = {
  "customer-app": "Customer",
  "technician-app": "Technician",
};

const app = process.argv[2]?.trim();
const variant = (process.argv[3]?.trim() || "release").toLowerCase();

if (!app || !APPS[app]) {
  console.error("Usage: node scripts/rename-uat-apk.mjs <customer-app|technician-app> [release|debug]");
  process.exit(1);
}

if (variant !== "release" && variant !== "debug") {
  console.error('Variant must be "release" or "debug".');
  process.exit(1);
}

function formatDateDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

const gradleApk = variant === "debug" ? "app-debug.apk" : "app-release.apk";
const source = join(
  repoRoot,
  "apps",
  app,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  variant,
  gradleApk,
);

if (!existsSync(source)) {
  console.error(`[rename-uat-apk] APK not found: ${source}`);
  console.error("Run the Gradle assemble task first (npm run android:apk:uat:*).");
  process.exit(1);
}

const label = APPS[app];
const dated = formatDateDDMMYYYY();
const fileName = `OorjaMan-${label}-UAT-${dated}.apk`;
const distDir = join(repoRoot, "apps", app, "dist");
const dest = join(distDir, fileName);

mkdirSync(distDir, { recursive: true });
copyFileSync(source, dest);

console.log(`[rename-uat-apk] ${fileName}`);
console.log(`[rename-uat-apk] ${dest}`);
