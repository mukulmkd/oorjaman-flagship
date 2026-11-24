#!/usr/bin/env node
/**
 * One-shot Maestro smoke against PROD Customer store package.
 * Refuses stress/repeat flags. Does not log in (real OTP required).
 *
 * Usage: node scripts/run-maestro-prod-smoke.mjs [extra maestro args...]
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const extra = process.argv.slice(2);
const banned = extra.some((a) => {
  const lower = a.toLowerCase();
  return (
    lower === "--repeat" ||
    lower.startsWith("--repeat=") ||
    lower === "-r" ||
    lower.includes("stress") ||
    lower.includes("uat")
  );
});
if (banned) {
  console.error(
    "PROD Maestro smoke is one-shot only. Do not pass --repeat, -r, stress, or uat flags.\n" +
      "See project-docs/PROD-SMOKE.md",
  );
  process.exit(1);
}

const flows = [
  "stress/maestro/prod/customer-home-bookings.yaml",
  "stress/maestro/prod/customer-book-nav.yaml",
];

const check = spawnSync("maestro", ["--version"], { encoding: "utf8" });
if (check.error || check.status !== 0) {
  console.error(
    "Maestro CLI not found. Install: https://maestro.mobile.dev/getting-started/installing-maestro",
  );
  process.exit(1);
}

console.log(
  "PROD Customer Maestro smoke — use store app com.oorjaman.customer, already logged in.\n" +
    "Manual OTP + Razorpay/AMC checks: project-docs/PROD-SMOKE.md\n",
);

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
  console.error(`\n${failed} PROD Maestro flow(s) failed.`);
  process.exit(1);
}
console.log("\nPROD Maestro navigation smoke passed. Finish the manual checklist in PROD-SMOKE.md.");
