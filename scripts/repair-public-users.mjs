/**
 * Backfill missing `public.users` rows for auth accounts linked from technicians/customers/vendors.
 *
 * Run when vendor approval fails with "users row missing" or similar role-extension errors.
 *
 * Requires repo root `.env.uat.local` (default) or `.env.production.local` with SEED_ENV=production.
 *
 * Usage:
 *   npm run repair:public-users
 *   npm run repair:public-users -- --phone=+919000000301
 */

import { createClient } from "@supabase/supabase-js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { loadScriptEnv } from "./load-script-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { tier, path: envPath } = loadScriptEnv();
if (envPath) console.log(`Using script env (${tier}): ${envPath}`);

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const phoneArg = process.argv.find((a) => a.startsWith("--phone="))?.split("=")[1]?.trim();

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function coerceRole(raw) {
  const r = String(raw ?? "customer").toLowerCase();
  if (r === "vendor" || r === "technician" || r === "admin" || r === "customer") return r;
  return "customer";
}

function phoneDigits(p) {
  return String(p ?? "").replace(/\D/g, "");
}

async function listAllAuthUsers() {
  const out = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }
  return out;
}

async function main() {
  const authUsers = await listAllAuthUsers();
  const filtered = phoneArg
    ? authUsers.filter((u) => phoneDigits(u.phone) === phoneDigits(phoneArg))
    : authUsers;

  if (phoneArg && filtered.length === 0) {
    console.error(`No auth user found for phone ${phoneArg}`);
    process.exit(1);
  }

  const { data: techRows, error: techErr } = await admin.from("technicians").select("user_id");
  if (techErr) throw techErr;
  const { data: custRows, error: custErr } = await admin.from("customers").select("user_id");
  if (custErr) throw custErr;
  const { data: vendRows, error: vendErr } = await admin.from("vendors").select("user_id");
  if (vendErr) throw vendErr;

  const roleByUserId = new Map();
  for (const r of techRows ?? []) roleByUserId.set(r.user_id, "technician");
  for (const r of custRows ?? []) if (!roleByUserId.has(r.user_id)) roleByUserId.set(r.user_id, "customer");
  for (const r of vendRows ?? []) roleByUserId.set(r.user_id, "vendor");

  const targets = phoneArg ? filtered : filtered.filter((u) => roleByUserId.has(u.id));

  let inserted = 0;
  let updated = 0;

  for (const au of targets) {
    const meta = au.user_metadata ?? {};
    const role =
      roleByUserId.get(au.id) ??
      coerceRole(typeof meta.role === "string" ? meta.role : null);

    const row = {
      id: au.id,
      email: au.email ? au.email.toLowerCase().trim() : null,
      full_name: typeof meta.full_name === "string" && meta.full_name.trim() ? meta.full_name.trim() : null,
      phone:
        (au.phone && String(au.phone).trim()) ||
        (typeof meta.phone === "string" && meta.phone.trim() ? meta.phone.trim() : null),
      role,
    };

    const { data: existing, error: exErr } = await admin.from("users").select("id, role").eq("id", au.id).maybeSingle();
    if (exErr) throw exErr;

    if (!existing) {
      const { error: insErr } = await admin.from("users").insert(row);
      if (insErr) throw insErr;
      inserted += 1;
      console.log(`INSERT public.users ${au.id} role=${role} phone=${row.phone ?? "-"}`);
    } else if (existing.role !== role || !existing) {
      const { error: upErr } = await admin
        .from("users")
        .update({ phone: row.phone, role, email: row.email })
        .eq("id", au.id);
      if (upErr) throw upErr;
      updated += 1;
      console.log(`UPDATE public.users ${au.id} role=${role} (was ${existing.role})`);
    }
  }

  const { data: orphanTech, error: orphanErr } = await admin
    .from("technicians")
    .select("id, user_id, personal_phone");
  if (orphanErr) throw orphanErr;

  const orphanList = [];
  for (const t of orphanTech ?? []) {
    const { data: u } = await admin.from("users").select("id").eq("id", t.user_id).maybeSingle();
    if (!u) orphanList.push(t);
  }

  if (orphanList.length > 0) {
    console.warn("\nTechnicians still missing public.users (auth user may be deleted):");
    for (const t of orphanList) {
      console.warn(`  technician ${t.id} user_id=${t.user_id} phone=${t.personal_phone ?? "-"}`);
    }
  }

  console.log(`\nDone. inserted=${inserted} updated=${updated}`);
  if (inserted + updated > 0) {
    console.log("Retry vendor approval in the partner portal.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
