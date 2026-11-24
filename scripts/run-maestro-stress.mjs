#!/usr/bin/env node
/**
 * Run Maestro UAT device flows.
 *
 * Usage: node scripts/run-maestro-stress.mjs customer|partner [extra maestro args...]
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const suite = (process.argv[2] || "customer").trim();
const extra = process.argv.slice(3);

const suites = {
  customer: [
    "stress/maestro/customer-login-home.yaml",
    "stress/maestro/customer-book-smoke.yaml",
  ],
  partner: [
    "stress/maestro/partner-login-jobs.yaml",
    "stress/maestro/partner-permissions-not-now.yaml",
  ],
};

const flows = suites[suite];
if (!flows) {
  console.error(`Unknown suite "${suite}". Use: customer | partner`);
  process.exit(1);
}

const check = spawnSync("maestro", ["--version"], { encoding: "utf8" });
if (check.error || check.status !== 0) {
  console.error(
    "Maestro CLI not found. Install: https://maestro.mobile.dev/getting-started/installing-maestro",
  );
  process.exit(1);
}

let failed = 0;
for (const rel of flows) {
  const path = join(root, rel);
  console.log(`\n→ maestro test ${rel}`);
  const result = spawnSync("maestro", ["test", path, ...extra], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) failed += 1;
}

if (failed) {
  console.error(`\n${failed} Maestro flow(s) failed.`);
  process.exit(1);
}
console.log("\nAll Maestro flows in suite passed.");
