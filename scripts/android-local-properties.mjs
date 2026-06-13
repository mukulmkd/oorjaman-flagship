#!/usr/bin/env node
/**
 * Writes android/local.properties (gitignored) with sdk.dir for Expo native builds.
 * Uses ANDROID_HOME or ANDROID_SDK_ROOT, else default macOS SDK path.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const defaultSdk = join(homedir(), "Library", "Android", "sdk");
const sdkDir = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? defaultSdk;

if (!existsSync(sdkDir)) {
  console.error(`Android SDK not found at: ${sdkDir}`);
  console.error("Install Android Studio, or set ANDROID_HOME to your SDK path.");
  process.exit(1);
}

const apps = ["customer-app", "technician-app"];
let wrote = 0;

for (const app of apps) {
  const androidDir = join(repoRoot, "apps", app, "android");
  if (!existsSync(androidDir)) continue;
  const out = join(androidDir, "local.properties");
  writeFileSync(out, `sdk.dir=${sdkDir}\n`, "utf8");
  console.log(`wrote ${out}`);
  wrote++;
}

if (wrote === 0) {
  console.error("No apps/*/android folders found. Run npx expo prebuild --platform android first.");
  process.exit(1);
}

console.log(`sdk.dir=${sdkDir}`);
