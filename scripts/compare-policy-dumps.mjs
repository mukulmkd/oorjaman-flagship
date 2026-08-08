#!/usr/bin/env node
/**
 * Compare two RLS-policy exports (from supabase/baseline/export-rls-policies.sql) to detect
 * UAT <-> PROD drift without Docker/pg_dump.
 *
 * Workflow:
 *   1. Run supabase/baseline/export-rls-policies.sql in the UAT SQL editor  -> save uat-dump.json
 *   2. Run the same query in the PROD SQL editor                            -> save prod-dump.json
 *   3. npm run db:policy-diff                       (defaults to those two files)
 *      npm run db:policy-diff -- fileA.json fileB.json
 *
 * Exit code 0 = identical, 1 = drift found (prints each differing policy).
 */
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [aArg, bArg] = process.argv.slice(2);
const aFile = resolve(repoRoot, aArg ?? "supabase/baseline/uat-dump.json");
const bFile = resolve(repoRoot, bArg ?? "supabase/baseline/prod-dump.json");
const aLabel = aArg ? aArg : "UAT";
const bLabel = bArg ? bArg : "PROD";

function load(file, label) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${label} dump: ${file}`);
    console.error("Export it by running supabase/baseline/export-rls-policies.sql in that SQL editor.");
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")).map((r) => String(r.ddl).trim());
}

function keyOf(stmt) {
  const p = stmt.match(/create policy (\S+) on (\S+)/);
  if (p) return `policy ${p[1]} on ${p[2]}`;
  const rls = stmt.match(/alter table (\S+) enable row level security/);
  if (rls) return `rls ${rls[1]}`;
  return stmt.slice(0, 60);
}

function mapOf(list) {
  const m = new Map();
  for (const s of list) m.set(keyOf(s), s);
  return m;
}

const A = mapOf(load(aFile, aLabel));
const B = mapOf(load(bFile, bLabel));
const keys = [...new Set([...A.keys(), ...B.keys()])].sort();

let diffs = 0;
for (const k of keys) {
  const a = A.get(k);
  const b = B.get(k);
  if (a === b) continue;
  diffs++;
  console.log(`\n### ${k}`);
  if (!a) console.log(`  ${aLabel}: (absent)   ${bLabel}: present`);
  else if (!b) console.log(`  ${aLabel}: present    ${bLabel}: (absent)`);
  else {
    console.log(`  --- ${aLabel} ---\n${a}`);
    console.log(`  --- ${bLabel} ---\n${b}`);
  }
}

console.log(
  `\n${aLabel}: ${A.size} keys | ${bLabel}: ${B.size} keys | differing: ${diffs}`,
);
process.exit(diffs === 0 ? 0 : 1);
