#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binName = process.platform === "win32" ? "supabase.cmd" : "supabase";
const localBin = resolve(root, "node_modules", ".bin", binName);

if (!existsSync(localBin)) {
  console.error("");
  console.error("Supabase CLI is not installed. From the repo root run:");
  console.error("  npm install   # installs the pinned CLI from devDependencies (no global install needed)");
  console.error("");
  process.exit(1);
}

export const supabaseCliBin = localBin;
export const repoRoot = root;
