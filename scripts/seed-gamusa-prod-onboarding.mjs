/**
 * Populate Gamusa Green Energy (vendor) + Subam Das (technician) on PROD
 * from the filled OorjaMan Vendor & Technician Onboarding Prerequisites doc.
 *
 * Document uploads are intentionally omitted — fill doc_* later via Storage.
 *
 * Requires `.env.production.local`:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   SEED_ENV=production node scripts/seed-gamusa-prod-onboarding.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { loadScriptEnv } from "./load-script-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { tier, path: envPath } = loadScriptEnv("production");
if (envPath) console.log(`Using script env (${tier}): ${envPath}`);

if (tier !== "production") {
  console.error("This script is PROD-only. Use SEED_ENV=production.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const VENDOR = {
  email: "gamusagreenenergy@gmail.com",
  phone: "+919707755033",
  businessName: "GAMUSA GREEN ENERGY",
  tradeName: "GAMUSA GREEN ENERGY",
  companyType: "PARTNERSHIP",
  // CIN not provided in the filled checklist — leave null until partner supplies it.
  companyRegistrationNumber: null,
  gstin: "18ABCFG8589R1Z8",
  pan: "ABCFG8589R",
  websiteUrl: "https://gamusagreenenergy.com/",
  contactPersonName: "UPASHANA GOSWAMI",
  contactPersonRole: "OPERATIONS & HR",
  contactPersonPhone: "+916003256785",
  contactPersonEmail: "gamusagreenenergy@gmail.com",
  address: {
    label: "Registered office — Guwahati",
    line1: "H NO-32, SOUTH SARANIA",
    line2: null,
    city: "Guwahati",
    district: "Kamrup Metropolitan",
    state: "Assam",
    pincode: "781007",
    country: "India",
    formatted: "H NO-32, SOUTH SARANIA, Guwahati, Assam, 781007",
  },
  operatingRegions: ["Assam"],
  serviceAreas: ["Guwahati", "Jorhat", "Sivasagar"],
  yearsInBusiness: 1,
  workforceHeadcount: 5,
  experienceSummary:
    "As an organization have completed 300+ installations all across Assam and have trained staff available",
  equipmentAvailable: ["CLEANING BRUSH", "CLEANING LIQUID"],
  bankName: "HDFC BANK",
  bankIfsc: "HDFC0000631",
  bankAccountNumber: "50200110729371",
};

const TECHNICIAN = {
  // Email OTP login until SMS OTP is enabled on PROD.
  email: "daxstoner54@gmail.com",
  phone: "+919864665319",
  nameAsPerAadhaar: "SUBAM DAS",
  dateOfBirth: "1997-07-29",
  gender: "male",
  fatherGuardianName: "GOPAL DAS",
  address: {
    label: "Home base — Ulubari",
    line1: "DAKHIN SARANIA, PS-PALTAN BAZAR, ULUBARI",
    line2: null,
    city: "Guwahati",
    district: "Kamrup Metropolitan",
    state: "Assam",
    pincode: "781007",
    country: "India",
    formatted:
      "DAKHIN SARANIA, PS-PALTAN BAZAR, ULUBARI, Kamrup Metropolitan, Assam, 781007",
  },
  pan: "GOVPD4586R",
  aadhaarLast4: "7659",
  skills: ["solar_cleaning"],
  otherSkills: "SOLAR PANEL CLEANING AND MAINTENANCE",
  preferredWorkLocations: ["Guwahati"],
  yearsExperience: 1,
  bankAccountHolderName: "SUBAM DAS",
  bankAccountLast4: "8801",
  bankIfsc: "CBIN0283201",
};

/** Guwahati / Kamrup Metro coverage pins used by marketplace matching. */
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

function bankLast4(accountNumber) {
  const digits = String(accountNumber).replace(/\D/g, "");
  return digits.slice(-4);
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

async function findUserByPhone(phoneE164) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find((u) => {
      const p = (u.phone ?? "").replace(/\D/g, "");
      const want = phoneE164.replace(/\D/g, "");
      return p === want || p.endsWith(want.slice(-10));
    });
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensurePublicUser(userId, { role, fullName, email, phone }) {
  await new Promise((r) => setTimeout(r, 600));
  const row = {
    id: userId,
    role,
    full_name: fullName,
    email,
    phone,
  };
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from("users").update(row).eq("id", userId);
    if (error) throw error;
    console.log(`  public.users updated role=${role}`);
    return;
  }

  const { error } = await admin.from("users").insert(row);
  if (error) {
    const { error: updErr } = await admin.from("users").update(row).eq("id", userId);
    if (updErr) throw updErr;
    console.log(`  public.users race-resolved role=${role}`);
    return;
  }
  console.log(`  public.users inserted role=${role}`);
}

async function ensureVendorAuthUser() {
  const existing = await findUserByEmail(VENDOR.email);
  const meta = {
    role: "vendor",
    full_name: VENDOR.businessName,
    label: VENDOR.businessName,
    phone: VENDOR.phone,
  };

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email: VENDOR.email,
      email_confirm: true,
      phone: VENDOR.phone,
      phone_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    console.log(`vendor auth updated ${VENDOR.email} id=${data.user.id}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: VENDOR.email,
    email_confirm: true,
    phone: VENDOR.phone,
    phone_confirm: true,
    user_metadata: meta,
  });
  if (error) throw error;
  console.log(`vendor auth created ${VENDOR.email} id=${data.user.id}`);
  return data.user;
}

function buildVendorPayload() {
  const now = new Date().toISOString();
  const last4 = bankLast4(VENDOR.bankAccountNumber);
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

  return {
    business_name: VENDOR.businessName,
    trade_name: VENDOR.tradeName,
    contact_email: VENDOR.email,
    contact_phone: VENDOR.phone,
    website_url: VENDOR.websiteUrl,
    company_type: VENDOR.companyType,
    company_registration_number: VENDOR.companyRegistrationNumber,
    gstin: VENDOR.gstin,
    pan: VENDOR.pan,
    contact_person_name: VENDOR.contactPersonName,
    contact_person_role: VENDOR.contactPersonRole,
    contact_person_phone: VENDOR.contactPersonPhone,
    contact_person_email: VENDOR.contactPersonEmail,
    registered_address: VENDOR.address,
    operating_regions: VENDOR.operatingRegions,
    service_areas: VENDOR.serviceAreas,
    experience_summary: VENDOR.experienceSummary,
    years_in_business: VENDOR.yearsInBusiness,
    equipment_available: VENDOR.equipmentAvailable,
    flag_safety_training: true,
    flag_ppe_available: true,
    flag_insurance_coverage: true,
    bank_detail_last4: last4,
    // Docs deferred — partner will upload next.
    doc_pan_url: null,
    doc_aadhaar_url: null,
    doc_gst_url: null,
    doc_bank_proof_url: null,
    metadata: {
      pilot_partner: true,
      source: "seed-gamusa-prod-onboarding",
      onboarding_doc: "OorjaMan-Vendor-Technician-Onboarding-Prerequisites",
      docs_pending: true,
      cin_pending: true,
      public_web: VENDOR.websiteUrl,
      workforce_headcount: VENDOR.workforceHeadcount,
      bank_details: {
        bank_name: VENDOR.bankName,
        ifsc: VENDOR.bankIfsc,
        account_holder_name: VENDOR.businessName,
        account_number: VENDOR.bankAccountNumber,
        last4,
      },
      service_coverage_zones: coverageZones,
      serviceable_pincodes: GUWAHATI_PINS,
      populated_at: now,
    },
  };
}

async function ensureVendorRow(userId) {
  const payload = buildVendorPayload();
  const { data: existing } = await admin
    .from("vendors")
    .select("id, approval_status, user_id")
    .or(
      `user_id.eq.${userId},business_name.ilike.%GAMUSA GREEN ENERGY%,business_name.ilike.%Gamusa Green Energy%`,
    )
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await admin
      .from("vendors")
      .update({
        ...payload,
        user_id: userId,
      })
      .eq("id", existing.id)
      .select("id, business_name, approval_status, contact_email, contact_phone")
      .single();
    if (error) throw error;
    console.log(
      `vendor updated ${data.business_name} (${data.approval_status}) id=${data.id}`,
    );
    if (data.approval_status !== "approved") {
      console.warn(
        "  vendor not approved — run admin approve (or SQL with guard disabled)",
      );
    }
    return data;
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("vendors")
    .insert({
      user_id: userId,
      ...payload,
      approval_status: "approved",
      submitted_at: now,
      reviewed_at: now,
      approved_at: now,
    })
    .select("id, business_name, approval_status, contact_email, contact_phone")
    .single();
  if (error) throw error;
  console.log(
    `vendor created ${data.business_name} (${data.approval_status}) id=${data.id}`,
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
  console.log(`platform_settings.default_vendor_id=${vendorId}`);
}

async function ensureTechnicianAuthUser() {
  const byPhone = await findUserByPhone(TECHNICIAN.phone);
  const byEmail = await findUserByEmail(TECHNICIAN.email);
  const existing = byPhone ?? byEmail;
  const meta = {
    role: "technician",
    full_name: TECHNICIAN.nameAsPerAadhaar,
    phone: TECHNICIAN.phone,
  };

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email: TECHNICIAN.email,
      email_confirm: true,
      phone: TECHNICIAN.phone,
      phone_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    console.log(
      `technician auth updated ${TECHNICIAN.phone} id=${data.user.id}`,
    );
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TECHNICIAN.email,
    email_confirm: true,
    phone: TECHNICIAN.phone,
    phone_confirm: true,
    user_metadata: meta,
  });
  if (error) throw error;
  console.log(
    `technician auth created ${TECHNICIAN.phone} id=${data.user.id}`,
  );
  return data.user;
}

function buildTechnicianPayload(vendorId) {
  const now = new Date().toISOString();
  return {
    vendor_id: vendorId,
    metadata: {
      full_name: TECHNICIAN.nameAsPerAadhaar,
      source: "seed-gamusa-prod-onboarding",
      onboarding_doc: "OorjaMan-Vendor-Technician-Onboarding-Prerequisites",
      docs_pending: true,
      home_city: "Guwahati",
      home_state: "Assam",
      declarations: {
        information_accurate: true,
        safety_commitment: true,
        recorded_at: now,
        safety_acknowledgements: {
          pre_start_checklist: true,
          job_start_code: true,
          safety_measures: true,
          reviewed_guidelines: true,
          recorded_at: now,
        },
      },
      populated_at: now,
    },
    // Insert as verified; finalize SQL also ensures employee_code.
    verification_status: "verified",
    vendor_review_status: "approved",
    vendor_reviewed_at: now,
    verification_submitted_at: now,
    verification_reviewed_at: now,
    is_verified: true,
    is_available: true,
    flag_safety_training: true,
    flag_height_work_cert: false,
    flag_solar_cleaning_experience: true,
    personal_phone: TECHNICIAN.phone,
    contact_email: null,
    name_as_per_aadhaar: TECHNICIAN.nameAsPerAadhaar,
    date_of_birth: TECHNICIAN.dateOfBirth,
    father_guardian_name: TECHNICIAN.fatherGuardianName,
    gender: TECHNICIAN.gender,
    aadhaar_last4: TECHNICIAN.aadhaarLast4,
    pan_number: TECHNICIAN.pan,
    skills: TECHNICIAN.skills,
    other_skills: TECHNICIAN.otherSkills,
    years_experience: TECHNICIAN.yearsExperience,
    experience_summary: TECHNICIAN.otherSkills,
    preferred_work_locations: TECHNICIAN.preferredWorkLocations,
    home_base_address: TECHNICIAN.address,
    bank_account_holder_name: TECHNICIAN.bankAccountHolderName,
    bank_account_last4: TECHNICIAN.bankAccountLast4,
    bank_ifsc: TECHNICIAN.bankIfsc,
    // Docs deferred.
    doc_aadhaar_url: null,
    doc_pan_url: null,
    doc_bank_proof_url: null,
    doc_passport_url: null,
    doc_safety_certificate_url: null,
  };
}

async function ensureTechnicianRow(userId, vendorId) {
  const payload = buildTechnicianPayload(vendorId);
  const { data: existing } = await admin
    .from("technicians")
    .select("id, vendor_review_status, verification_status, employee_code")
    .or(
      `user_id.eq.${userId},personal_phone.eq.${TECHNICIAN.phone},name_as_per_aadhaar.ilike.%SUBAM DAS%`,
    )
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const {
      verification_status,
      vendor_review_status,
      vendor_reviewed_at,
      verification_submitted_at,
      verification_reviewed_at,
      is_verified,
      ...rest
    } = payload;
    void verification_status;
    void vendor_review_status;
    void vendor_reviewed_at;
    void verification_submitted_at;
    void verification_reviewed_at;
    void is_verified;

    const { data, error } = await admin
      .from("technicians")
      .update({ ...rest, user_id: userId })
      .eq("id", existing.id)
      .select(
        "id, name_as_per_aadhaar, personal_phone, vendor_id, vendor_review_status, verification_status, employee_code",
      )
      .single();
    if (error) throw error;
    console.log(
      `technician updated ${data.name_as_per_aadhaar} (${data.vendor_review_status}/${data.verification_status}) id=${data.id}`,
    );
    return data;
  }

  const { data, error } = await admin
    .from("technicians")
    .insert({ user_id: userId, ...payload })
    .select(
      "id, name_as_per_aadhaar, personal_phone, vendor_id, vendor_review_status, verification_status, employee_code",
    )
    .single();
  if (error) throw error;
  console.log(
    `technician created ${data.name_as_per_aadhaar} (${data.vendor_review_status}/${data.verification_status}) id=${data.id}`,
  );
  return data;
}

async function ensureCompletedInvite(vendorId, invitedByUserId) {
  const { data: existing } = await admin
    .from("vendor_technician_invites")
    .select("id, status")
    .eq("vendor_id", vendorId)
    .eq("invite_phone_e164", TECHNICIAN.phone)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("vendor_technician_invites")
      .update({
        status: "completed",
        full_name: TECHNICIAN.nameAsPerAadhaar,
        completed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) console.warn(`  invite update: ${error.message}`);
    else console.log(`  invite marked completed id=${existing.id}`);
    return;
  }

  const token = randomUUID().replace(/-/g, "");
  const { error } = await admin.from("vendor_technician_invites").insert({
    vendor_id: vendorId,
    invited_by_user_id: invitedByUserId,
    invite_phone_e164: TECHNICIAN.phone,
    invite_token: token,
    invite_url: `oorjaman-technician://invite/${token}`,
    status: "completed",
    full_name: TECHNICIAN.nameAsPerAadhaar,
    invited_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    notification_channels: ["email", "sms", "whatsapp"],
    metadata: {
      source: "seed-gamusa-prod-onboarding",
      employer_business_name: VENDOR.businessName,
    },
  });
  if (error) console.warn(`  invite insert: ${error.message}`);
  else console.log("  invite row created (completed)");
}

async function clearCustomerProfileIfAny(userId) {
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.id) return;
  const { error } = await admin.from("customers").delete().eq("id", data.id);
  if (error) console.warn(`  customer cleanup: ${error.message}`);
  else console.log("  removed stale customers row for vendor login user");
}

async function main() {
  console.log("Seeding Gamusa vendor + Subam Das technician (PROD, docs deferred)");

  const vendorAuth = await ensureVendorAuthUser();
  await ensurePublicUser(vendorAuth.id, {
    role: "vendor",
    fullName: VENDOR.businessName,
    email: VENDOR.email,
    phone: VENDOR.phone,
  });
  await clearCustomerProfileIfAny(vendorAuth.id);

  const vendor = await ensureVendorRow(vendorAuth.id);
  await setDefaultVendor(vendor.id);

  const techAuth = await ensureTechnicianAuthUser();
  await ensurePublicUser(techAuth.id, {
    role: "technician",
    fullName: TECHNICIAN.nameAsPerAadhaar,
    email: TECHNICIAN.email,
    phone: TECHNICIAN.phone,
  });

  const tech = await ensureTechnicianRow(techAuth.id, vendor.id);
  await ensureCompletedInvite(vendor.id, vendorAuth.id);

  console.log("\nSummary:");
  console.log(`  vendor_id=${vendor.id}`);
  console.log(`  vendor_login=${VENDOR.email} / ${VENDOR.phone}`);
  console.log(`  technician_id=${tech.id}`);
  console.log(`  technician_phone=${TECHNICIAN.phone}`);
  console.log(
    "  docs: pending (vendor-documents + technician-documents uploads next)",
  );
  console.log(
    "  if technician.employee_code is null, run finalize SQL via MCP/dashboard",
  );
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
