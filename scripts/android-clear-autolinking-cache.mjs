#!/usr/bin/env node
/**
 * Gradle caches react-native autolinking config under android/build/generated/autolinking/.
 * If package/namespace changes (e.g. UAT vs prod), the cache can keep a stale packageName
 * derived from rootProject.name (e.g. com.oorjamanpartneruat) and break BuildConfig references.
 */
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const apps = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["customer-app", "technician-app"];

for (const app of apps) {
  const cacheDir = join(repoRoot, "apps", app, "android", "build", "generated", "autolinking");
  if (!existsSync(cacheDir)) continue;
  rmSync(cacheDir, { recursive: true, force: true });
  console.log(`cleared ${cacheDir}`);
}
