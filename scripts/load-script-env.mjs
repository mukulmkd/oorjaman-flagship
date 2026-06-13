/**
 * Load repo-root env for npm scripts (seed, repair, purge).
 * Default tier is UAT — pass SEED_ENV=production only when you mean prod.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function resolveTier() {
  const raw = (process.env.SEED_ENV ?? process.env.SCRIPT_ENV ?? "uat").trim().toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  return "uat";
}

/** @param {"uat"|"production"} [tier] */
export function loadScriptEnv(tier = resolveTier()) {
  const candidates =
    tier === "production"
      ? [".env.production.local", ".env"]
      : [".env.uat.local", ".env.development.local", ".env"];

  for (const name of candidates) {
    const path = join(repoRoot, name);
    if (existsSync(path)) {
      config({ path });
      if (process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        return { tier, path };
      }
    }
  }

  return { tier, path: null };
}
