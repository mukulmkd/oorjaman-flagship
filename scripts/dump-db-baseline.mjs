#!/usr/bin/env node
/**
 * SECURITY_REVIEW H3 — capture the *live* schema + RLS policies baseline.
 *
 * The base tables (users/customers/vendors/technicians/subscriptions/bookings/job_reports) and their
 * owner-scoped RLS policies were applied out-of-band and exist in no tracked migration. Rather than
 * hand-reconstruct them (which risks silently changing prod on the next `db push`), dump them from
 * the linked project — UAT is schema-identical to prod — into a version-controlled baseline.
 *
 * Usage:
 *   npm run db:baseline                 # prompts for the DB password
 *   SUPABASE_DB_PASSWORD=... npm run db:baseline
 *   npm run db:baseline -- -p '<db-password>'
 *
 * Output: supabase/baseline/prod_baseline_<YYYY-MM-DD>.sql (schema-only, includes CREATE POLICY).
 *
 * This is a reproducibility / DR artifact — it is NOT auto-applied. To bootstrap a brand-new
 * environment that reproduces prod RLS, apply this file first, then run `npm run db:push`.
 *
 * REQUIRES DOCKER: the Supabase CLI runs `pg_dump` inside a container (to version-match the
 * server). Start Docker Desktop first. No Docker? Use the Docker-free RLS-only fallback:
 * run supabase/baseline/export-rls-policies.sql in the SQL editor and save the result.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabaseCliBin, repoRoot } from "./supabase-cli-bin.mjs";

const outDir = resolve(repoRoot, "supabase", "baseline");
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const outFile = resolve(outDir, `prod_baseline_${stamp}.sql`);

const passthrough = process.argv.slice(2);
const args = ["db", "dump", "--schema", "public", "-f", outFile, ...passthrough];

console.log("Dumping linked project schema + RLS policies →", outFile);
console.log("(schema-only; includes CREATE POLICY / ENABLE ROW LEVEL SECURITY)\n");

const result = spawnSync(getSupabaseCliBin(), args, { stdio: "inherit", cwd: repoRoot });

if (result.status === 0) {
  console.log("\nBaseline captured. Review it, then commit supabase/baseline/.");
  console.log("Sanity-check base policies are present, e.g.:");
  console.log(`  grep -E "create policy (users_|customers_|bookings_|subscriptions_)" "${outFile}"`);
}

process.exit(typeof result.status === "number" ? result.status : 1);
