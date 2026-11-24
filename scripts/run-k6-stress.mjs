#!/usr/bin/env node
/**
 * Run a k6 stress script against UAT only.
 * Loads root .env.uat.local then stress/.env.local; refuses PROD project ref.
 *
 * Usage: node scripts/run-k6-stress.mjs smoke|booking [--dashboard]
 *
 * Dashboard: live UI at http://127.0.0.1:5665 + HTML export under stress/k6/reports/
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const PROD_REF = "nppfpegqnmclbcmmogux";

const args = process.argv.slice(2);
const which = (args.find((a) => !a.startsWith("-")) || "smoke").trim();
const wantDashboard =
  args.includes("--dashboard") ||
  args.includes("--dash") ||
  ["1", "true", "yes"].includes((process.env.STRESS_DASHBOARD || "").toLowerCase());

const scripts = {
  smoke: join(root, "stress/k6/smoke.js"),
  booking: join(root, "stress/k6/booking-read-write.js"),
};
const scriptPath = scripts[which];
if (!scriptPath) {
  console.error(`Unknown target "${which}". Use: smoke | booking`);
  process.exit(1);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = {
  ...parseEnvFile(join(root, ".env.uat.local")),
  ...parseEnvFile(join(root, "stress/.env.local")),
};

const pick = (key, fallbacks = []) => {
  for (const k of [key, ...fallbacks]) {
    const fromProc = process.env[k];
    if (fromProc != null && String(fromProc).trim()) return String(fromProc).trim();
    if (fileEnv[k] != null && String(fileEnv[k]).trim()) return String(fileEnv[k]).trim();
  }
  return "";
};

const url = pick("SUPABASE_URL");
const anon = pick("SUPABASE_ANON_KEY", ["EXPO_PUBLIC_SUPABASE_ANON_KEY"]);
const dummyPassword = pick("DUMMY_AUTH_PASSWORD") || "TestOtp123!";

if (!url || !anon) {
  console.error(
    "Need SUPABASE_URL and SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY) in .env.uat.local or stress/.env.local",
  );
  process.exit(1);
}
if (url.includes(PROD_REF)) {
  console.error(`Refusing PROD Supabase (${PROD_REF}). Point env at UAT only.`);
  process.exit(1);
}

const k6Env = {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: anon,
  CUSTOMER_EMAIL: pick("CUSTOMER_EMAIL") || "raju.mahalingam@gmail.com",
  CUSTOMER_PASSWORD: pick("CUSTOMER_PASSWORD") || dummyPassword,
  TECHNICIAN_EMAIL: pick("TECHNICIAN_EMAIL") || "amit.das@gamusagreen.in",
  TECHNICIAN_PASSWORD: pick("TECHNICIAN_PASSWORD") || dummyPassword,
  CUSTOMER_ACCESS_TOKEN: pick("CUSTOMER_ACCESS_TOKEN"),
  TECHNICIAN_ACCESS_TOKEN: pick("TECHNICIAN_ACCESS_TOKEN"),
  VUS: pick("VUS"),
  DURATION: pick("DURATION"),
  STRESS_ALLOW_CREATE: pick("STRESS_ALLOW_CREATE") || "0",
  STRESS_VENDOR_ID: pick("STRESS_VENDOR_ID"),
  STRESS_CUSTOMER_ID: pick("STRESS_CUSTOMER_ID"),
};

const envArgs = [];
for (const [key, val] of Object.entries(k6Env)) {
  if (!val) continue;
  envArgs.push("-e", `${key}=${val}`);
}

const check = spawnSync("k6", ["version"], { encoding: "utf8" });
if (check.error || check.status !== 0) {
  console.error(
    "k6 not found. Install: https://grafana.com/docs/k6/latest/set-up/install-k6/",
  );
  process.exit(1);
}

const childEnv = { ...process.env };
if (wantDashboard) {
  const reportsDir = join(root, "stress/k6/reports");
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportPath = join(reportsDir, `${which}-${stamp}.html`);
  childEnv.K6_WEB_DASHBOARD = "true";
  childEnv.K6_WEB_DASHBOARD_OPEN = process.env.K6_WEB_DASHBOARD_OPEN || "true";
  childEnv.K6_WEB_DASHBOARD_PORT = process.env.K6_WEB_DASHBOARD_PORT || "5665";
  childEnv.K6_WEB_DASHBOARD_PERIOD = process.env.K6_WEB_DASHBOARD_PERIOD || "5s";
  childEnv.K6_WEB_DASHBOARD_EXPORT = process.env.K6_WEB_DASHBOARD_EXPORT || exportPath;
  console.log(`Web dashboard → http://127.0.0.1:${childEnv.K6_WEB_DASHBOARD_PORT}`);
  console.log(`HTML report   → ${exportPath}`);
  console.log("(k6 may keep running until you close the dashboard browser tab)");
}

console.log(`Running k6 ${which} → ${scriptPath}`);
const result = spawnSync("k6", ["run", ...envArgs, scriptPath], {
  stdio: "inherit",
  env: childEnv,
  cwd: root,
});
process.exit(result.status ?? 1);
