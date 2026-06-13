/**
 * Vendor coverage UI needs `country-state-city`. Vercel vendor projects sometimes
 * install from `apps/vendor-web` and skip hoisted workspace deps — install if missing.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const candidates = [
  join(root, "node_modules/country-state-city/package.json"),
  join(root, "apps/vendor-web/node_modules/country-state-city/package.json"),
];

if (candidates.some((p) => existsSync(p))) {
  process.exit(0);
}

console.log("ensure-country-state-city: installing country-state-city@3.2.1 for vendor-web…");
execSync("npm install country-state-city@3.2.1 -w vendor-web", {
  cwd: root,
  stdio: "inherit",
});
