/**
 * Vercel "Ignored Build Step" helper for monorepo portals / marketing.
 *
 * Vercel ignored-build semantics (not normal shell):
 *   exit 0 → skip deployment (CANCELED)
 *   exit 1 → run build
 *
 * Usage (per Vercel project):
 *   node scripts/vercel-should-build.mjs admin-web --branch develop
 *   node scripts/vercel-should-build.mjs vendor-web --branch develop
 *   node scripts/vercel-should-build.mjs support-web --branch develop
 *   node scripts/vercel-should-build.mjs customer-app --branch develop
 *   node scripts/vercel-should-build.mjs technician-app --branch develop
 *   node scripts/vercel-should-build.mjs oorjaman-web --branch main
 *
 * Also set each project's Git → Production Branch to the same branch in the Dashboard
 * so Production deploys only come from that branch.
 */
import { execSync } from "node:child_process";

function parseArgs(argv) {
  /** @type {{ app: string | null; branch: string | null }} */
  const out = { app: null, branch: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--branch") {
      out.branch = argv[++i]?.trim() || null;
      continue;
    }
    if (!out.app && a && !a.startsWith("-")) {
      out.app = a.trim();
    }
  }
  return out;
}

const { app, branch: requiredBranch } = parseArgs(process.argv);
if (!app) {
  console.error(
    "Usage: node scripts/vercel-should-build.mjs <workspace-name> [--branch develop|main]",
  );
  process.exit(1);
}

const gitRef = process.env.VERCEL_GIT_COMMIT_REF?.trim();
if (requiredBranch) {
  if (!gitRef) {
    console.log(
      `[vercel-should-build] ${app}: --branch ${requiredBranch} set but VERCEL_GIT_COMMIT_REF missing — building.`,
    );
  } else if (gitRef !== requiredBranch) {
    console.log(
      `[vercel-should-build] ${app}: branch "${gitRef}" ≠ "${requiredBranch}" — skipping build.`,
    );
    process.exit(0);
  } else {
    console.log(`[vercel-should-build] ${app}: branch "${gitRef}" OK.`);
  }
}

/** @type {string[]} */
const watchPaths = [`apps/${app}`, "package.json", "package-lock.json", ".npmrc"];

if (app === "oorjaman-web") {
  watchPaths.push("scripts/sync-brand-assets.mjs", "brand");
} else if (app === "customer-app" || app === "technician-app") {
  // Expo Web CSR — shared packages + app vercel.json
  watchPaths.push("packages", `apps/${app}/vercel.json`);
} else {
  // Vite portals consume shared packages + root SPA vercel.json
  watchPaths.push("packages", "scripts/sync-brand-assets.mjs", "vercel.json");
  if (app === "vendor-web") {
    watchPaths.push("scripts/ensure-country-state-city.mjs");
  }
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
  console.log(`[vercel-should-build] ${app}: relevant changes detected — building.`);
  process.exit(1);
}
