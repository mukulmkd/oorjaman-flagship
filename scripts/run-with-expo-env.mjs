#!/usr/bin/env node
/**
 * Run a command in apps/<app> with EXPO_PUBLIC_* from `env/uat.local`
 * (UAT APK / EAS builds only — not used by Metro localhost dev).
 *
 * Usage: node scripts/run-with-expo-env.mjs <customer-app|technician-app> <command>
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = process.argv[2]?.trim();
const cmd = process.argv.slice(3).join(" ").trim();

if (!app || !cmd) {
  console.error("Usage: node scripts/run-with-expo-env.mjs <customer-app|technician-app> <command>");
  process.exit(1);
}

const appDir = join(repoRoot, "apps", app);
const envFile = join(appDir, "env", "uat.local");
const legacyEnvFile = join(appDir, ".env.uat.local");

function resolveUatEnvFile() {
  if (existsSync(envFile)) {
    return envFile;
  }

  if (existsSync(legacyEnvFile)) {
    copyFileSync(legacyEnvFile, envFile);
    console.warn(
      `[run-with-expo-env] Migrated ${legacyEnvFile} → ${envFile}. Remove the legacy file so Metro dev does not bundle it.`,
    );
    try {
      unlinkSync(legacyEnvFile);
      console.warn(`[run-with-expo-env] Removed legacy ${legacyEnvFile}`);
    } catch {
      console.warn(`[run-with-expo-env] Delete ${legacyEnvFile} manually — it breaks Expo Metro if left in the app root.`);
    }
    return envFile;
  }

  return null;
}

const resolvedEnvFile = resolveUatEnvFile();

if (!resolvedEnvFile) {
  console.error(`Missing ${envFile}`);
  console.error(`Copy apps/${app}/env/uat.local.example → apps/${app}/env/uat.local`);
  process.exit(1);
}

config({ path: resolvedEnvFile });

if (!process.env.EXPO_PUBLIC_DEPLOY_ENV?.trim()) {
  process.env.EXPO_PUBLIC_DEPLOY_ENV = "uat";
}

if (!process.env.NODE_ENV?.trim()) {
  process.env.NODE_ENV = "production";
}

// Release APK builds bundle with NODE_ENV=production. Expo loads `.env.production.local`
// (not `env/uat.local`). Sync UAT values so the embedded bundle has the right keys.
const productionLocal = join(appDir, ".env.production.local");
writeFileSync(productionLocal, readFileSync(resolvedEnvFile, "utf8"), "utf8");

console.log(`[run-with-expo-env] ${app} ← env/uat.local`);
console.log(`[run-with-expo-env] synced → apps/${app}/.env.production.local (embedded in release bundle)`);
const result = spawnSync(cmd, {
  shell: true,
  stdio: "inherit",
  env: process.env,
  cwd: appDir,
});

process.exit(result.status ?? 1);
