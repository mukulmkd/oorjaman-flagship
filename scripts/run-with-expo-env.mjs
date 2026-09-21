#!/usr/bin/env node
/**
 * Run a command in apps/<app> with EXPO_PUBLIC_* from `.env.uat.local`
 * (UAT APK / EAS builds only — not used by Metro localhost dev).
 *
 * Usage: node scripts/run-with-expo-env.mjs <customer-app|technician-app> <command>
 *
 * Release APK bundling uses NODE_ENV=production, so Expo reads `.env.production.local`.
 * We temporarily bake UAT values into that file for the command, then restore the
 * previous production file so local PROD env is not permanently clobbered.
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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
const envFile = join(appDir, ".env.uat.local");
const legacyEnvFile = join(appDir, "env", "uat.local");

function resolveUatEnvFile() {
  if (existsSync(envFile)) {
    return envFile;
  }

  if (existsSync(legacyEnvFile)) {
    copyFileSync(legacyEnvFile, envFile);
    console.warn(
      `[run-with-expo-env] Migrated ${legacyEnvFile} → ${envFile}. You can remove apps/${app}/env/uat.local.`,
    );
    return envFile;
  }

  return null;
}

const resolvedEnvFile = resolveUatEnvFile();

if (!resolvedEnvFile) {
  console.error(`Missing ${envFile}`);
  console.error(`Copy apps/${app}/.env.uat.example → apps/${app}/.env.uat.local`);
  process.exit(1);
}

config({ path: resolvedEnvFile });

if (!process.env.EXPO_PUBLIC_DEPLOY_ENV?.trim()) {
  process.env.EXPO_PUBLIC_DEPLOY_ENV = "uat";
}

if (!process.env.NODE_ENV?.trim()) {
  process.env.NODE_ENV = "production";
}

const productionLocal = join(appDir, ".env.production.local");
const productionBackup = join(appDir, ".env.production.local.uat-bake-backup");
let hadProductionLocal = false;

try {
  if (existsSync(productionLocal)) {
    hadProductionLocal = true;
    copyFileSync(productionLocal, productionBackup);
  }

  writeFileSync(productionLocal, readFileSync(resolvedEnvFile, "utf8"), "utf8");
  console.log(`[run-with-expo-env] ${app} ← .env.uat.local`);
  console.log(
    `[run-with-expo-env] temporary bake → apps/${app}/.env.production.local (restored after command)`,
  );

  const result = spawnSync(cmd, {
    shell: true,
    stdio: "inherit",
    env: process.env,
    cwd: appDir,
  });

  process.exitCode = result.status ?? 1;
} finally {
  try {
    if (hadProductionLocal && existsSync(productionBackup)) {
      renameSync(productionBackup, productionLocal);
      console.log(`[run-with-expo-env] restored apps/${app}/.env.production.local`);
    } else if (!hadProductionLocal && existsSync(productionLocal)) {
      unlinkSync(productionLocal);
      console.log(`[run-with-expo-env] removed temporary apps/${app}/.env.production.local`);
    }
  } catch (err) {
    console.error(
      `[run-with-expo-env] FAILED to restore .env.production.local — check ${productionBackup}`,
      err,
    );
  }
}
