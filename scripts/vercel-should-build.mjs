/**
 * Vercel "Ignored Build Step" helper for monorepo portals.
 *
 * Vercel ignored-build semantics (not normal shell):
 *   exit 0 → skip deployment (CANCELED)
 *   exit 1 → run build
 *
 * Usage (per Vercel project): node scripts/vercel-should-build.mjs admin-web
 */
import { execSync } from "node:child_process";

const app = process.argv[2]?.trim();
if (!app) {
  console.error("Usage: node scripts/vercel-should-build.mjs <workspace-name>");
  process.exit(1);
}

const watchPaths = [
  `apps/${app}`,
  "packages",
  "scripts/sync-brand-assets.mjs",
  "vercel.json",
  "package.json",
  "package-lock.json",
  ".npmrc",
];

if (app === "vendor-web") {
  watchPaths.push("scripts/ensure-country-state-city.mjs");
}

const from = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();
const to = process.env.VERCEL_GIT_COMMIT_SHA?.trim() ?? "HEAD";

if (!from) {
  console.log(`[vercel-should-build] ${app}: no VERCEL_GIT_PREVIOUS_SHA — building.`);
  process.exit(1);
}

const pathArgs = watchPaths.map((p) => `"${p}"`).join(" ");

try {
  execSync(`git diff --quiet ${from} ${to} -- ${pathArgs}`, {
    stdio: "inherit",
    shell: true,
  });
  console.log(`[vercel-should-build] ${app}: no relevant changes — skipping build.`);
  process.exit(0);
} catch {
  console.log(`[vercel-should-build] ${app}: changes detected — building.`);
  process.exit(1);
}
