#!/usr/bin/env node
/**
 * Regenerate supabase/schema.sql and supabase/policies.sql from supabase/migrations/.
 *
 * Usage: node scripts/build-supabase-reference.mjs
 *
 * Prefer `supabase db dump --local` when Docker is available (see SUPABASE-UAT-PROD.md).
 * This script concatenates migrations and splits RLS/policy statements into policies.sql.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { repoRoot } from "./supabase-cli-bin.mjs";

const migrationsDir = resolve(repoRoot, "supabase", "migrations");
const schemaPath = resolve(repoRoot, "supabase", "schema.sql");
const policiesPath = resolve(repoRoot, "supabase", "policies.sql");
const policiesBasePath = resolve(repoRoot, "supabase", "policies-base.sql");

const SCHEMA_HEADER = `-- =============================================================================
-- OorjaManDB - full public schema (Supabase / PostgreSQL)
-- AUTO-GENERATED from supabase/migrations/ via: node scripts/build-supabase-reference.mjs
-- Do not edit by hand for structural changes - add a migration, then re-run this script.
--
-- Deploy: use supabase db push (migrations are source of truth for UAT/Prod).
-- Manual bootstrap: apply this file, then policies.sql, then storage.sql if needed.
-- Requires: Supabase Auth (auth.users)
-- =============================================================================

create extension if not exists "pgcrypto";

`;

const POLICIES_HEADER = `-- =============================================================================
-- Row Level Security - OorjaManDB
-- AUTO-GENERATED from supabase/migrations/ via: node scripts/build-supabase-reference.mjs
-- Apply AFTER schema.sql (or after db push). Migrations remain authoritative for deploy.
-- =============================================================================

`;

function stripLeadingComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

/** Split SQL file into statements (respects $$ ... $$ blocks). */
function splitStatements(sql) {
  const statements = [];
  let buf = "";
  let dollar = null;
  const lines = sql.split("\n");
  for (const line of lines) {
    if (dollar === null) {
      const open = line.match(/\$([a-zA-Z_]*)\$/);
      if (open && !line.trimEnd().endsWith(";")) {
        const tag = open[0];
        if ((line.match(/\$/g) || []).length === 1) {
          dollar = tag;
        }
      }
    } else if (line.includes(dollar)) {
      dollar = null;
    }
    buf += `${line}\n`;
    if (dollar === null && /;\s*$/.test(line.trim())) {
      const stmt = stripLeadingComments(buf.trim());
      if (stmt) statements.push(stmt);
      buf = "";
    }
  }
  const tail = stripLeadingComments(buf.trim());
  if (tail) statements.push(tail);
  return statements;
}

function isPolicyStatement(stmt) {
  const s = stmt.replace(/\s+/g, " ").trim().toLowerCase();
  if (s.startsWith("drop policy")) return true;
  if (s.startsWith("create policy")) return true;
  if (/^alter table .* enable row level security/.test(s)) return true;
  if (s.startsWith("create or replace function public.is_admin")) return true;
  if (s.startsWith("create or replace function public.my_customer_id"))
    return true;
  if (s.startsWith("create or replace function public.my_vendor_id"))
    return true;
  if (s.startsWith("create or replace function public.my_technician_id"))
    return true;
  if (s.startsWith("create or replace function public.is_approved_vendor_user"))
    return true;
  if (s.startsWith("grant execute on function public.is_admin")) return true;
  if (s.startsWith("grant execute on function public.my_")) return true;
  if (s.startsWith("grant execute on function public.is_approved_vendor"))
    return true;
  if (s.startsWith("create or replace function public.is_")) return true;
  if (s.startsWith("create or replace function public.my_")) return true;
  if (
    s.includes("is_support_desk_user") &&
    s.startsWith("create or replace function")
  )
    return true;
  if (
    s.includes("is_support_agent") &&
    s.startsWith("create or replace function")
  )
    return true;
  if (s.startsWith("grant ") && s.includes("storage.")) return true;
  if (s.startsWith("insert into storage.buckets")) return true;
  if (s.startsWith("drop policy if exists") && s.includes("storage.objects"))
    return true;
  return false;
}

function isSchemaOnlySkip(stmt) {
  const s = stmt.replace(/\s+/g, " ").trim().toLowerCase();
  // Realtime publication tweaks - safe in schema or skip (often no-op on fresh DB)
  if (s.includes("alter publication supabase_realtime")) return false;
  return false;
}

function listMigrations() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function main() {
  const schemaParts = [];
  const policyParts = [];
  const migrationNames = listMigrations();

  for (const file of migrationNames) {
    const raw = readFileSync(join(migrationsDir, file), "utf8");
    let banner = `-- ----- ${file} -----\n`;
    for (const stmt of splitStatements(raw)) {
      if (isSchemaOnlySkip(stmt)) continue;
      const sql = stmt.endsWith(";") ? stmt : `${stmt};`;
      if (isPolicyStatement(stmt)) {
        policyParts.push(banner + sql + "\n");
        banner = "";
      } else {
        schemaParts.push(banner + sql + "\n");
        banner = "";
      }
    }
  }

  const schemaBody = schemaParts.join("\n");
  const policiesBody = policyParts.join("\n");

  const policiesBase = readFileSync(policiesBasePath, "utf8").trim();

  writeFileSync(
    schemaPath,
    SCHEMA_HEADER + schemaBody + "\n-- End of schema (generated)\n",
    "utf8",
  );
  writeFileSync(
    policiesPath,
    `${POLICIES_HEADER}${policiesBase}\n\n-- ----- migration-derived policies -----\n\n${policiesBody}\n-- End of policies (generated)\n`,
    "utf8",
  );

  console.log(`Wrote ${schemaPath} (${schemaParts.length} statements)`);
  console.log(`Wrote ${policiesPath} (${policyParts.length} statements)`);
  console.log(`From ${migrationNames.length} migrations.`);
}

main();
