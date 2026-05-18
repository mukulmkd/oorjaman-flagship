#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, "supabase", "config.toml");

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

const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
const extraArgs = process.argv.slice(2);
const result = spawnSync(cmd, ["supabase", "db", "push", ...extraArgs], {
  stdio: "inherit",
  cwd: root,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
