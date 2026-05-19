#!/usr/bin/env node
/**
 * Deploy a Supabase Edge Function from supabase/functions/<name>.
 *
 * Usage:
 *   npm run functions:deploy -- send-customer-expo-push
 *   npm run functions:deploy -- send-technician-expo-push
 *   npm run functions:deploy -- supabase/functions/send-customer-expo-push
 *   node scripts/supabase-function-deploy.mjs send-technician-expo-push --no-verify-jwt
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { repoRoot, supabaseCliBin } from "./supabase-cli-bin.mjs";

const configPath = resolve(repoRoot, "supabase", "config.toml");
const functionsRoot = resolve(repoRoot, "supabase", "functions");

function usage() {
  console.error("");
  console.error("Usage: npm run functions:deploy -- <function-name> [supabase deploy flags...]");
  console.error("");
  console.error("Examples:");
  console.error("  npm run functions:deploy -- send-customer-expo-push");
  console.error("  npm run functions:deploy -- process-notification-events");
  console.error("");
  console.error("Available functions:");
  for (const name of listFunctionNames()) {
    console.error(`  - ${name}`);
  }
  console.error("");
}

function listFunctionNames() {
  if (!existsSync(functionsRoot)) return [];
  return readdirSync(functionsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "node_modules")
    .map((e) => e.name)
    .filter((name) => existsSync(resolve(functionsRoot, name, "index.ts")))
    .sort();
}

function resolveFunctionName(raw) {
  if (!raw) return null;
  let name = raw.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (name.startsWith("supabase/functions/")) {
    name = name.slice("supabase/functions/".length);
  }
  if (name.includes("/")) {
    name = basename(name);
  }
  if (!name || name.includes("..")) return null;
  return name;
}

if (!existsSync(configPath)) {
  console.error("");
  console.error("Supabase config not found at supabase/config.toml.");
  console.error("Link your project once:");
  console.error("  npm exec supabase link --project-ref <your-project-ref>");
  console.error("");
  process.exit(1);
}

const argv = process.argv.slice(2);
const nameArg = argv.find((a) => !a.startsWith("-"));
const deployFlags = argv.filter((a) => a !== nameArg);
const functionName = resolveFunctionName(nameArg);

if (!functionName) {
  usage();
  process.exit(1);
}

const entryPath = resolve(functionsRoot, functionName, "index.ts");
if (!existsSync(entryPath)) {
  console.error("");
  console.error(`Edge function not found: supabase/functions/${functionName}/index.ts`);
  console.error("");
  console.error("Available functions:");
  for (const name of listFunctionNames()) {
    console.error(`  - ${name}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`Deploying edge function: ${functionName}`);

const result = spawnSync(supabaseCliBin, ["functions", "deploy", functionName, ...deployFlags], {
  stdio: "inherit",
  cwd: repoRoot,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
