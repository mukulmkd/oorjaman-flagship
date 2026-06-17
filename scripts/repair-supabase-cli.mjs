#!/usr/bin/env node
/**
 * Reinstall missing Supabase platform CLI binaries (`supabase-go` shim pair).
 * npm occasionally installs @supabase/cli-* without the co-located supabase-go binary.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSupabaseCliBin, resolveSupabasePlatformPackage, repoRoot } from "./supabase-cli-bin.mjs";

function readSupabaseVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(repoRoot, "node_modules", "supabase", "package.json"), "utf8"),
    );
    return pkg.version ?? "2.106.0";
  } catch {
    return "2.106.0";
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const platform = resolveSupabasePlatformPackage();
if (!platform) {
  console.error("No @supabase/cli-* platform package found for this OS/arch.");
  console.error("Run: npm install");
  process.exit(1);
}

const needsGo = !existsSync(platform.goBin);
const needsShim = !existsSync(platform.shimBin);

if (!needsGo && !needsShim) {
  console.log("Supabase CLI platform binaries look OK.");
  console.log(`Using: ${resolveSupabaseCliBin()}`);
  process.exit(0);
}

const version = readSupabaseVersion();
const pkgName = `@supabase/cli-${platform.suffix}`;
console.log(`Repairing ${pkgName}@${version} (missing supabase-go or supabase shim)...`);

const tmpDir = path.join(os.tmpdir(), `oorjaman-supabase-cli-${platform.suffix}-${Date.now()}`);
mkdirSync(tmpDir, { recursive: true });

try {
  run("npm", ["pack", `${pkgName}@${version}`], { cwd: tmpDir });

  const tgzName = `${pkgName.replace("@", "").replace("/", "-")}-${version}.tgz`;
  const tgzPath = path.join(tmpDir, tgzName);
  if (!existsSync(tgzPath)) {
    console.error(`Expected tarball not found: ${tgzPath}`);
    process.exit(1);
  }

  mkdirSync(path.join(platform.pkgPath, "bin"), { recursive: true });

  if (needsGo) {
    run("tar", ["-xzf", tgzPath, "-C", tmpDir, "package/bin/supabase-go"], { cwd: repoRoot });
    const extracted = path.join(tmpDir, "package", "bin", `supabase-go${platform.ext}`);
    copyFileSync(extracted, platform.goBin);
    if (platform.ext === "") chmodSync(platform.goBin, 0o755);
    console.log(`Restored ${platform.goBin}`);
  }

  if (needsShim) {
    run("tar", ["-xzf", tgzPath, "-C", tmpDir, "package/bin/supabase"], { cwd: repoRoot });
    const extracted = path.join(tmpDir, "package", "bin", `supabase${platform.ext}`);
    copyFileSync(extracted, platform.shimBin);
    if (platform.ext === "") chmodSync(platform.shimBin, 0o755);
    console.log(`Restored ${platform.shimBin}`);
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`Supabase CLI ready: ${resolveSupabaseCliBin()}`);
