/**
 * Creates dev/UAT test users with phone + email + password (dummy auth).
 *
 * Requires in environment (repo root `.env.uat.local` by default):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   DUMMY_AUTH_PASSWORD   (default TestOtp123! - must match app dummy auth env)
 *   SEED_ENV=production   (loads `.env.production.local` instead — use with care)
 *
 * Run: npm run seed:dummy-users
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
const password = process.env.DUMMY_AUTH_PASSWORD?.trim() || "TestOtp123!";

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (see scripts/seed-dummy-test-users.mjs header).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Must stay in sync with `dummyEmailFromPhoneE164` in `@oorjaman/api` auth-api.ts */
function dummyEmailFromPhoneE164(phone) {
  const digits = phone.replace(/\D/g, "");
  return `u${digits}@oorjaman-dummy.test`;
}

function phoneDigits(p) {
  if (p == null || p === "") return "";
  return String(p).replace(/\D/g, "");
}

/** Supabase may store phones without `+` or with different spacing - compare digits. */
function phonesMatch(canonical, stored) {
  const a = phoneDigits(canonical);
  const b = phoneDigits(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10) return a.slice(-10) === b.slice(-10);
  return false;
}

/** @type {{ phone: string; role: string; fullName: string; email: string }[]} */
const DEFS = [
  { phone: "+919000000101", role: "admin", fullName: "Priya Sharma", email: "priya.sharma@oorjaman.in" },
  { phone: "+919000000102", role: "admin", fullName: "Vikram Mehta", email: "vikram.mehta@oorjaman.in" },
  { phone: "+919000000111", role: "support", fullName: "Ananya Reddy", email: "ananya.reddy@oorjaman.in" },
  { phone: "+919000000112", role: "support", fullName: "Karthik Nair", email: "karthik.nair@oorjaman.in" },
  { phone: "+919000000201", role: "vendor", fullName: "Gamusa Green Energy", email: "contact@gamusagreen.in" },
  { phone: "+919000000202", role: "vendor", fullName: "Bharat Sun Systems", email: "contact@bharatsun.in" },
  { phone: "+919000000301", role: "technician", fullName: "Amit Das", email: "amit.das@gamusagreen.in" },
  { phone: "+919000000302", role: "technician", fullName: "Sanjay Pillai", email: "sanjay.pillai@bharatsun.in" },
  { phone: "+919000000303", role: "technician", fullName: "Ravi Iyer", email: "ravi.iyer@gamusagreen.in" },
  { phone: "+919000000304", role: "technician", fullName: "Deepak Menon", email: "deepak.menon@gamusagreen.in" },
  { phone: "+919000000305", role: "technician", fullName: "Suresh Babu", email: "suresh.babu@bharatsun.in" },
  { phone: "+919000000306", role: "technician", fullName: "Manoj Krishnan", email: "manoj.krishnan@bharatsun.in" },
  { phone: "+919000000401", role: "customer", fullName: "Raju Mahalingam", email: "raju.mahalingam@gmail.com" },
  { phone: "+919000000402", role: "customer", fullName: "Rajesh Kumar", email: "rajesh.kumar@gmail.com" },
  { phone: "+919000000403", role: "customer", fullName: "Teammate Customer 1", email: "teammate.customer1@oorjaman.test" },
  { phone: "+919000000404", role: "customer", fullName: "Teammate Customer 2", email: "teammate.customer2@oorjaman.test" },
  { phone: "+919000000405", role: "customer", fullName: "Teammate Customer 3", email: "teammate.customer3@oorjaman.test" },
  { phone: "+919000000406", role: "customer", fullName: "Teammate Customer 4", email: "teammate.customer4@oorjaman.test" },
];

/** Gamusa Green (201) vs Bharat Sun (202) for technician roster split. */
const TECH_VENDOR_PHONE = {
  "+919000000301": "+919000000201",
  "+919000000303": "+919000000201",
  "+919000000304": "+919000000201",
  "+919000000302": "+919000000202",
  "+919000000305": "+919000000202",
  "+919000000306": "+919000000202",
};

const SEED_SERVICE_ADDRESS = {
  label: "Home",
  line1: "12 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

function defByPhone(phone) {
  const row = DEFS.find((d) => d.phone === phone);
  if (!row) throw new Error(`Missing seed definition for ${phone}`);
  return row;
}

async function findAuthUserIdByPhone(phone) {
  const wantEmail = dummyEmailFromPhoneE164(phone).toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => {
      if (u.phone && phonesMatch(phone, u.phone)) return true;
      const em = u.email?.toLowerCase();
      return Boolean(em && em === wantEmail);
    });
    if (hit) return hit.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureAuthUser({ phone, role, fullName, email: displayEmail }) {
  const authEmail = dummyEmailFromPhoneE164(phone);
  const authPatch = {
    phone,
    email: authEmail,
    password,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: { role, phone, full_name: fullName, label: fullName },
  };

  let uid = await findAuthUserIdByPhone(phone);

  if (uid) {
    const { error } = await admin.auth.admin.updateUserById(uid, authPatch);
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser(authPatch);
    if (!error && data?.user?.id) {
      uid = data.user.id;
    } else if (
      error &&
      (error.code === "phone_exists" ||
        String(error.message ?? "").toLowerCase().includes("already registered"))
    ) {
      uid = await findAuthUserIdByPhone(phone);
      if (!uid) throw error;
      const { error: uerr } = await admin.auth.admin.updateUserById(uid, authPatch);
      if (uerr) throw uerr;
    } else if (error) {
      throw error;
    }
  }

  await ensurePublicUser({ id: uid, phone, email: displayEmail, role, fullName });
  return uid;
}

async function ensurePublicUser({ id, phone, email, role, fullName }) {
  const { error } = await admin.from("users").upsert(
    {
      id,
      email: email.toLowerCase(),
      phone,
      role,
      full_name: fullName,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function ensurePlatformSettings() {
  const { data, error } = await admin.from("platform_settings").select("id").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insErr } = await admin.from("platform_settings").insert({ id: 1 });
  if (insErr) throw insErr;
  console.log("INSERT platform_settings id=1 (defaults)");
}

async function ensureSeedCustomer(userId, def, now) {
  const { error } = await admin.from("customers").upsert(
    {
      user_id: userId,
      display_name: def.fullName,
      contact_email: def.email,
      service_default_address: SEED_SERVICE_ADDRESS,
      service_lat: 12.9716,
      service_lng: 77.5946,
      location_recorded_at: now,
      solar_capacity_kw: 5,
      solar_panel_count: 12,
      installation_category: "residential",
      solar_roof_material: "rcc",
      onboarding_completed_at: now,
      metadata: {
        registration: {
          information_accurate: true,
          terms_safety_privacy: true,
          contact_for_scheduling: true,
          completed_at: now,
        },
      },
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

async function ensureSeedTechnician(userId, def, vendorId) {
  const { data: existing, error: fetchErr } = await admin
    .from("technicians")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const base = {
    vendor_id: vendorId,
    personal_phone: def.phone,
    name_as_per_aadhaar: def.fullName,
    skills: ["solar_cleaning"],
    is_available: true,
    metadata: { invite_full_name: def.fullName },
  };

  if (existing?.id) {
    const { error } = await admin.from("technicians").update(base).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await admin.from("technicians").insert({ user_id: userId, ...base });
    if (error) throw error;
  }

  const { error: finErr } = await admin.rpc("seed_finalize_test_technician", { p_user_id: userId });
  if (finErr) {
    throw new Error(
      `seed_finalize_test_technician RPC failed (${finErr.message}). Run npm run db:push then re-run seed:dummy-users.`,
    );
  }
}

async function ensureTechnicianInvite(vendorId, invitedByUserId, def, now) {
  const token = `ti_seed_tech_${def.phone.replace(/\D/g, "")}`;
  const { error } = await admin.from("vendor_technician_invites").upsert(
    {
      vendor_id: vendorId,
      invited_by_user_id: invitedByUserId,
      invite_phone_e164: def.phone,
      invite_token: token,
      invite_url: `oorjaman-technician://invite/${token}`,
      status: "completed",
      full_name: def.fullName,
      invited_at: now,
      completed_at: now,
    },
    { onConflict: "invite_token" },
  );
  if (error) throw error;
}

async function main() {
  await ensurePlatformSettings();

  /** @type {Record<string, string>} */
  const ids = {};

  for (const row of DEFS) {
    const id = await ensureAuthUser(row);
    ids[`${row.role}:${row.phone}`] = id;
    console.log(`Auth OK ${row.fullName} (${row.phone}) → ${id}`);
  }

  const now = new Date().toISOString();

  const vendor1 = defByPhone("+919000000201");
  const vendor2 = defByPhone("+919000000202");
  const v1 = ids["vendor:+919000000201"];
  const v2 = ids["vendor:+919000000202"];

  const vendorSeedRow = (userId, def) => ({
    user_id: userId,
    business_name: def.fullName,
    approval_status: "approved",
    reviewed_at: now,
    approved_at: now,
    contact_phone: def.phone,
  });

  const { error: upsertVendorsErr } = await admin.from("vendors").upsert(
    [vendorSeedRow(v1, vendor1), vendorSeedRow(v2, vendor2)],
    { onConflict: "user_id" },
  );
  if (upsertVendorsErr) throw upsertVendorsErr;

  const { data: venRows, error: vq } = await admin.from("vendors").select("id,user_id").in("user_id", [v1, v2]);
  if (vq) throw vq;
  const vendorIdByUser = Object.fromEntries((venRows ?? []).map((r) => [r.user_id, r.id]));
  const vendorIdByPhone = {
    "+919000000201": vendorIdByUser[v1],
    "+919000000202": vendorIdByUser[v2],
  };

  for (const row of DEFS.filter((d) => d.role === "customer")) {
    const userId = ids[`customer:${row.phone}`];
    await ensureSeedCustomer(userId, row, now);
    console.log(`Customer profile OK ${row.fullName} (${row.phone})`);
  }

  for (const row of DEFS.filter((d) => d.role === "technician")) {
    const userId = ids[`technician:${row.phone}`];
    const vendorPhone = TECH_VENDOR_PHONE[row.phone];
    const vendorId = vendorIdByPhone[vendorPhone];
    const invitedBy = ids[`vendor:${vendorPhone}`];
    await ensureSeedTechnician(userId, row, vendorId);
    await ensureTechnicianInvite(vendorId, invitedBy, row, now);
    console.log(`Technician profile OK ${row.fullName} (${row.phone}) → vendor ${vendorPhone}`);
  }

  for (const row of DEFS.filter((d) => d.role === "support")) {
    const userId = ids[`support:${row.phone}`];
    const { error } = await admin.from("support_agents").upsert(
      {
        user_id: userId,
        display_name: row.fullName,
        is_active: true,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  }

  for (const row of DEFS) {
    const id = ids[`${row.role}:${row.phone}`];
    if (!id) continue;
    await ensurePublicUser({
      id,
      phone: row.phone,
      email: row.email,
      role: row.role,
      fullName: row.fullName,
    });
  }

  const customerPhones = DEFS.filter((d) => d.role === "customer").map((d) => d.phone);
  const techPhones = DEFS.filter((d) => d.role === "technician").map((d) => d.phone);

  console.log("\nDone. Dummy auth password:", password);
  console.log("Customers (ready to book):", customerPhones.join(", "));
  console.log("Technicians (verified + vendor-approved):", techPhones.join(", "));
  console.log("Login: enter phone in app → OTP from dummy hint → same password backs sign-in.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
