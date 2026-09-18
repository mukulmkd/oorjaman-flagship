/**
 * Seeds Gamusa Green Energy as approved Pilot default vendor.
 *
 * Sources:
 *   - UAT backend row (contact@gamusagreen.in / +919000000201)
 *   - Public web: gamusagreenenergy.com (Assam / APDCL-registered solar installer)
 *
 * Requires:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   SEED_ENV=production node scripts/seed-gamusa-pilot-vendor.mjs
 *   node scripts/seed-gamusa-pilot-vendor.mjs   # UAT
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { loadScriptEnv } from "./load-script-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { tier, path: envPath } = loadScriptEnv();
if (envPath) console.log(`Using script env (${tier}): ${envPath}`);

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const VENDOR_EMAIL = "contact@gamusagreen.in";
const VENDOR_PHONE = "+919000000201";
const BUSINESS_NAME = "Gamusa Green Energy";

/** Guwahati / Kamrup Metro pilot coverage (review customer uses 781003). */
const GUWAHATI_PINS = [
  "781001",
  "781003",
  "781005",
  "781006",
  "781007",
  "781008",
  "781012",
  "781016",
  "781018",
  "781021",
  "781022",
  "781024",
  "781025",
  "781026",
  "781028",
  "781029",
  "781032",
  "781035",
  "781036",
  "781037",
];

function buildVendorPayload() {
  const now = new Date().toISOString();
  const zoneId = randomUUID();
  const coverageZones = [
    {
      id: zoneId,
      country_code: "IN",
      country_name: "India",
      state_code: "AS",
      state_name: "Assam",
      city_name: "Guwahati",
      pincodes: GUWAHATI_PINS,
    },
  ];

  // Dummy legal / bank identifiers — UAT only (valid format for intake validators).
  const DUMMY_PAN = "AABCG1234F";
  const DUMMY_GSTIN = "18AABCG1234F1Z5";
  const DUMMY_CIN = "U40300AS2020PTC019876";
  const DUMMY_IFSC = "SBIN0001234";
  const DUMMY_BANK_LAST4 = "4321";

  return {
    business_name: BUSINESS_NAME,
    trade_name: "GGE",
    approval_status: "approved",
    submitted_at: now,
    reviewed_at: now,
    approved_at: now,
    contact_email: VENDOR_EMAIL,
    contact_phone: VENDOR_PHONE,
    website_url: "https://gamusagreenenergy.com/",
    company_type: "private_limited",
    company_registration_number: DUMMY_CIN,
    gstin: DUMMY_GSTIN,
    pan: DUMMY_PAN,
    contact_person_name: "Priya Goswami",
    contact_person_role: "Partner operations",
    contact_person_phone: VENDOR_PHONE,
    contact_person_email: VENDOR_EMAIL,
    registered_address: {
      label: "Registered office — Guwahati",
      line1: "House No. 12, Zoo Road Tiniali",
      line2: "Near Guwahati Refinery",
      city: "Guwahati",
      district: "Kamrup Metropolitan",
      state: "Assam",
      pincode: "781001",
      country: "India",
      formatted: "House No. 12, Zoo Road Tiniali, Near Guwahati Refinery, Guwahati, Assam, 781001",
    },
    operating_regions: ["Assam"],
    service_areas: ["Guwahati", "Kamrup Metropolitan"],
    experience_summary:
      "Assam-based solar solutions partner (APDCL-registered). Residential and commercial rooftop installation, PM Surya Ghar support, and O&M. Pilot cleaning partner for OorjaMan in Guwahati.",
    years_in_business: 3,
    equipment_available: ["rooftop cleaning kits", "safety PPE", "water feed hose"],
    flag_safety_training: true,
    flag_ppe_available: true,
    flag_insurance_coverage: true,
    bank_detail_last4: DUMMY_BANK_LAST4,
    doc_pan_url: "uat-dummy/gamusa/pan.pdf",
    doc_aadhaar_url: "uat-dummy/gamusa/aadhaar.pdf",
    doc_gst_url: "uat-dummy/gamusa/gst.pdf",
    doc_bank_proof_url: "uat-dummy/gamusa/bank-proof.pdf",
    metadata: {
      pilot_partner: true,
      source: "seed-gamusa-pilot-vendor",
      public_web: "https://gamusagreenenergy.com/",
      notes:
        "UAT complete-profile seed so vendor portal login skips the forced stepper. Dummy GST/PAN/bank/docs — replace before production.",
      workforce_headcount: 12,
      bank_details: {
        bank_name: "State Bank of India",
        ifsc: DUMMY_IFSC,
        account_holder_name: BUSINESS_NAME,
        last4: DUMMY_BANK_LAST4,
      },
      service_coverage_zones: coverageZones,
      serviceable_pincodes: GUWAHATI_PINS,
    },
  };
}

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureVendorAuthUser() {
  const password = process.env.DUMMY_AUTH_PASSWORD?.trim() || "TestOtp123!";
  const existing = await findUserByEmail(VENDOR_EMAIL);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email: VENDOR_EMAIL,
      password,
      email_confirm: true,
      phone: VENDOR_PHONE,
      phone_confirm: true,
      user_metadata: {
        role: "vendor",
        full_name: BUSINESS_NAME,
        label: BUSINESS_NAME,
        phone: VENDOR_PHONE,
      },
    });
    if (error) throw error;
    console.log(`updated auth user ${VENDOR_EMAIL} id=${data.user.id}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: VENDOR_EMAIL,
    password,
    email_confirm: true,
    phone: VENDOR_PHONE,
    phone_confirm: true,
    user_metadata: {
      role: "vendor",
      full_name: BUSINESS_NAME,
      label: BUSINESS_NAME,
      phone: VENDOR_PHONE,
    },
  });
  if (error) throw error;
  console.log(`created auth user ${VENDOR_EMAIL} id=${data.user.id}`);
  return data.user;
}

async function ensurePublicUser(userId) {
  await new Promise((r) => setTimeout(r, 800));
  const row = {
    id: userId,
    role: "vendor",
    full_name: BUSINESS_NAME,
    email: VENDOR_EMAIL,
    phone: VENDOR_PHONE,
  };

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from("users").update(row).eq("id", userId);
    if (error) throw error;
    console.log("  public.users updated role=vendor");
    return;
  }

  const { error } = await admin.from("users").insert(row);
  if (error) {
    // Trigger may have raced and created the row.
    const { error: updErr } = await admin.from("users").update(row).eq("id", userId);
    if (updErr) throw updErr;
    console.log("  public.users race-resolved role=vendor");
    return;
  }
  console.log("  public.users inserted role=vendor");
}

async function ensureVendorRow(userId) {
  const payload = buildVendorPayload();
  const { data: existing } = await admin
    .from("vendors")
    .select("id, approval_status")
    .or(`user_id.eq.${userId},business_name.ilike.%Gamusa Green Energy%`)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    // Trigger vendors_guard_approval_writes blocks approval/review column changes.
    const {
      approval_status,
      submitted_at,
      reviewed_at,
      approved_at,
      approved_by,
      rejection_reason,
      ...rest
    } = payload;
    void approval_status;
    void submitted_at;
    void reviewed_at;
    void approved_at;
    void approved_by;
    void rejection_reason;

    const { data, error } = await admin
      .from("vendors")
      .update({
        ...rest,
        user_id: userId,
      })
      .eq("id", existing.id)
      .select("id, business_name, approval_status")
      .single();
    if (error) throw error;
    console.log(
      `  vendor updated ${data.business_name} (${data.approval_status}) id=${data.id}`,
    );
    if (data.approval_status !== "approved") {
      console.warn(
        "  warning: vendor is not approved — approve via admin SQL/dashboard before Pilot use",
      );
    }
    return data;
  }

  const { data, error } = await admin
    .from("vendors")
    .insert({ user_id: userId, ...payload })
    .select("id, business_name, approval_status")
    .single();
  if (error) throw error;
  console.log(
    `  vendor created ${data.business_name} (${data.approval_status}) id=${data.id}`,
  );
  return data;
}

async function setDefaultVendor(vendorId) {
  const { error } = await admin
    .from("platform_settings")
    .update({
      default_vendor_id: vendorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw error;
  console.log(`  platform_settings.default_vendor_id=${vendorId}`);
}

async function linkPlayReviewTechnician(vendorId) {
  const { data: authUser } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  // Prefer direct email lookup via helper
  const techAuth = await findUserByEmail("appreview.technician@oorjaman.com");
  if (!techAuth) {
    console.log("  play-review technician auth user not found — skip link");
    return;
  }
  const { data, error } = await admin
    .from("technicians")
    .update({ vendor_id: vendorId })
    .eq("user_id", techAuth.id)
    .select("id")
    .maybeSingle();
  if (error) console.warn(`  technician link: ${error.message}`);
  else if (data?.id) console.log(`  linked play-review technician ${data.id}`);
  else console.log("  play-review technician row not found — skip link");
  void authUser;
}

async function main() {
  console.log(`Seeding ${BUSINESS_NAME} as Pilot default vendor (${tier})`);
  const user = await ensureVendorAuthUser();
  await ensurePublicUser(user.id);
  const vendor = await ensureVendorRow(user.id);
  await setDefaultVendor(vendor.id);
  await linkPlayReviewTechnician(vendor.id);
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
