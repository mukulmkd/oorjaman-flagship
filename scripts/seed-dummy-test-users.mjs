/**
 * Creates 10 dev-only users (2 admins, 2 support, 2 vendors, 2 technicians, 2 customers) with phone + email + password.
 *
 * Requires in environment (e.g. repo root `.env` loaded via dotenv):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   DUMMY_AUTH_PASSWORD   (default TestOtp123! - must match EXPO_PUBLIC_DUMMY_AUTH_PASSWORD / VITE_DUMMY_AUTH_PASSWORD in apps)
 *
 * Run: npm run seed:dummy-users
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

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

/** @type {{ phone: string; role: string; label: string }[]} */
const DEFS = [
  { phone: "+919000000101", role: "admin", label: "Admin 1" },
  { phone: "+919000000102", role: "admin", label: "Admin 2" },
  { phone: "+919000000111", role: "support", label: "Support 1" },
  { phone: "+919000000112", role: "support", label: "Support 2" },
  { phone: "+919000000201", role: "vendor", label: "Vendor 1" },
  { phone: "+919000000202", role: "vendor", label: "Vendor 2" },
  { phone: "+919000000301", role: "technician", label: "Technician 1" },
  { phone: "+919000000302", role: "technician", label: "Technician 2" },
  { phone: "+919000000401", role: "customer", label: "Customer 1" },
  { phone: "+919000000402", role: "customer", label: "Customer 2" },
];

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

async function ensureAuthUser({ phone, role, label }) {
  const email = dummyEmailFromPhoneE164(phone);
  const authPatch = {
    phone,
    email,
    password,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: { role, phone, label },
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

  // public.users is provisioned by auth triggers (phone/email + verification timestamps).
  return uid;
}

async function main() {
  /** @type {Record<string, string>} */
  const ids = {};

  for (const row of DEFS) {
    const id = await ensureAuthUser(row);
    ids[`${row.role}:${row.phone}`] = id;
    console.log(`Auth OK ${row.label} (${row.phone}) → ${id}`);
  }

  const now = new Date().toISOString();

  const v1 = ids["vendor:+919000000201"];
  const v2 = ids["vendor:+919000000202"];

  // `vendors_guard_approval_writes` only allows admins to change approval fields on UPDATE.
  // The service role has no `auth.uid()`, so `is_admin()` is false - upsert(…, onConflict) would
  // UPDATE existing rows and fail. Remove seed rows and INSERT fresh approved rows instead.
  const { error: delVendorsErr } = await admin.from("vendors").delete().in("user_id", [v1, v2]);
  if (delVendorsErr) throw delVendorsErr;

  const { error: ins1 } = await admin.from("vendors").insert({
    user_id: v1,
    business_name: "Gamusa Green Energy",
    approval_status: "approved",
    reviewed_at: now,
    approved_at: now,
    contact_phone: "+919000000201",
  });
  if (ins1) throw ins1;

  const { error: ins2 } = await admin.from("vendors").insert({
    user_id: v2,
    business_name: "Bharat Sun Systems",
    approval_status: "approved",
    reviewed_at: now,
    approved_at: now,
    contact_phone: "+919000000202",
  });
  if (ins2) throw ins2;

  const { data: venRows, error: vq } = await admin.from("vendors").select("id,user_id").in("user_id", [v1, v2]);
  if (vq) throw vq;
  const vendorIdByUser = Object.fromEntries((venRows ?? []).map((r) => [r.user_id, r.id]));

  const { error: c1 } = await admin.from("customers").upsert(
    {
      user_id: ids["customer:+919000000401"],
      display_name: "Raju Mahalingam",
    },
    { onConflict: "user_id" },
  );
  if (c1) throw c1;

  const { error: c2 } = await admin.from("customers").upsert(
    {
      user_id: ids["customer:+919000000402"],
      display_name: "Rajesh Kumar",
    },
    { onConflict: "user_id" },
  );
  if (c2) throw c2;

  const { error: t1 } = await admin.from("technicians").upsert(
    {
      user_id: ids["technician:+919000000301"],
      vendor_id: vendorIdByUser[v1],
      personal_phone: "+919000000301",
    },
    { onConflict: "user_id" },
  );
  if (t1) throw t1;

  const { error: t2 } = await admin.from("technicians").upsert(
    {
      user_id: ids["technician:+919000000302"],
      vendor_id: vendorIdByUser[v2],
      personal_phone: "+919000000302",
    },
    { onConflict: "user_id" },
  );
  if (t2) throw t2;

  const { error: s1 } = await admin.from("support_agents").upsert(
    {
      user_id: ids["support:+919000000111"],
      display_name: "Test Support One",
      is_active: true,
    },
    { onConflict: "user_id" },
  );
  if (s1) throw s1;

  const { error: s2 } = await admin.from("support_agents").upsert(
    {
      user_id: ids["support:+919000000112"],
      display_name: "Test Support Two",
      is_active: true,
    },
    { onConflict: "user_id" },
  );
  if (s2) throw s2;

  const { error: inv1 } = await admin.from("vendor_technician_invites").upsert(
    {
      vendor_id: vendorIdByUser[v1],
      invited_by_user_id: v1,
      invite_phone_e164: "+919000000301",
      invite_token: "ti_seed_tech_301",
      invite_url: "oorjaman-technician://invite/ti_seed_tech_301",
      status: "completed",
      full_name: "Test Technician One",
      invited_at: now,
      completed_at: now,
    },
    { onConflict: "invite_token" },
  );
  if (inv1) throw inv1;

  const { error: inv2 } = await admin.from("vendor_technician_invites").upsert(
    {
      vendor_id: vendorIdByUser[v2],
      invited_by_user_id: v2,
      invite_phone_e164: "+919000000302",
      invite_token: "ti_seed_tech_302",
      invite_url: "oorjaman-technician://invite/ti_seed_tech_302",
      status: "completed",
      full_name: "Test Technician Two",
      invited_at: now,
      completed_at: now,
    },
    { onConflict: "invite_token" },
  );
  if (inv2) throw inv2;

  console.log("\nDone. Use dummy OTP flow in apps with the same password backing sign-in:", password);
  console.log(
    "Phones: admins +919000000101–102, support +919000000111–112, vendors +919000000201–202, tech +919000000301–302, customers +919000000401–402.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
