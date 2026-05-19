#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot, supabaseCliBin } from "./supabase-cli-bin.mjs";

const configPath = resolve(repoRoot, "supabase", "config.toml");

if (!existsSync(configPath)) {
  console.error("");
  console.error("Supabase config not found at supabase/config.toml.");
  console.error("Run this once:");
  console.error("  npm exec supabase init");
  console.error("Then link project once:");
  console.error("  npm exec supabase link --project-ref <your-project-ref>");
  console.error("");
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const result = spawnSync(supabaseCliBin, ["db", "push", ...extraArgs], {
  stdio: "inherit",
  cwd: repoRoot,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
