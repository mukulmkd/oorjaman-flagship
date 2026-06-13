#!/usr/bin/env node
/**
 * Resolve the Supabase CLI executable for repo scripts.
 * Prefers the platform `supabase-go` binary; falls back to co-located `supabase`.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const PLATFORMS = {
  darwin: { arm64: ["darwin-arm64"], x64: ["darwin-x64"] },
  linux: {
    arm64: ["linux-arm64", "linux-arm64-musl"],
    x64: ["linux-x64", "linux-x64-musl"],
  },
  win32: { arm64: ["windows-arm64"], x64: ["windows-x64"] },
};

function platformCandidates() {
  const platformMap = PLATFORMS[process.platform];
  if (!platformMap) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  const candidates = platformMap[os.arch()];
  if (!candidates) {
    throw new Error(`Unsupported architecture: ${os.arch()} on ${process.platform}`);
  }
  return candidates;
}

export function resolveSupabasePlatformPackage() {
  const ext = process.platform === "win32" ? ".exe" : "";
  for (const suffix of platformCandidates()) {
    try {
      const pkgPath = path.dirname(require.resolve(`@supabase/cli-${suffix}/package.json`));
      const goBin = path.join(pkgPath, "bin", `supabase-go${ext}`);
      const shimBin = path.join(pkgPath, "bin", `supabase${ext}`);
      return { suffix, pkgPath, goBin, shimBin, ext };
    } catch {
      // try next suffix
    }
  }
  return null;
}

export function resolveSupabaseCliBin() {
  const override = process.env.SUPABASE_CLI_BINARY_OVERRIDE?.trim();
  if (override && existsSync(override)) {
    return override;
  }

  const platform = resolveSupabasePlatformPackage();
  if (platform) {
    if (existsSync(platform.goBin)) return platform.goBin;
    if (existsSync(platform.shimBin)) return platform.shimBin;
  }

  const binName = process.platform === "win32" ? "supabase.cmd" : "supabase";
  const localBin = path.join(root, "node_modules", ".bin", binName);
  if (existsSync(localBin)) return localBin;

  return null;
}

export function getSupabaseCliBin() {
  const bin = resolveSupabaseCliBin();
  if (!bin) {
    console.error("");
    console.error("Supabase CLI is not installed. From the repo root run:");
    console.error("  npm install");
    console.error("  npm run db:repair-cli");
    console.error("");
    process.exit(1);
  }
  return bin;
}

/** @deprecated Use getSupabaseCliBin() — kept for existing script imports. */
export const supabaseCliBin = getSupabaseCliBin();

export const repoRoot = root;
