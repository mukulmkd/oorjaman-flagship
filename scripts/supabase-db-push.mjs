#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSupabaseCliBin,
  repoRoot,
  resolveSupabasePlatformPackage,
} from "./supabase-cli-bin.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(repoRoot, "supabase", "config.toml");

if (!existsSync(configPath)) {
  console.error("");
  console.error("Supabase config not found at supabase/config.toml.");
  console.error("Run this once:");
  console.error("  npx supabase init");
  console.error("Then link project once:");
  console.error("  npx supabase link --project-ref <your-project-ref>");
  console.error("");
  process.exit(1);
}

const platform = resolveSupabasePlatformPackage();
if (platform && !existsSync(platform.goBin)) {
  console.log("Supabase CLI missing supabase-go — repairing platform package…");
  const repair = spawnSync(process.execPath, [resolve(scriptDir, "repair-supabase-cli.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (repair.status !== 0) {
    process.exit(repair.status ?? 1);
  }
}

const extraArgs = process.argv.slice(2);
const result = spawnSync(getSupabaseCliBin(), ["db", "push", ...extraArgs], {
  stdio: "inherit",
  cwd: repoRoot,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
