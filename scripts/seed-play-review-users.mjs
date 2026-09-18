/**
 * Creates Google Play review Auth users (email + fixed password, no OTP).
 *
 * Requires repo-root env (`.env.production.local` when SEED_ENV=production, else `.env.uat.local`):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   PLAY_REVIEW_PASSWORD (default OorjaManPlayReview2026!)
 *
 * Run:
 *   SEED_ENV=production node scripts/seed-play-review-users.mjs
 *   node scripts/seed-play-review-users.mjs   # UAT
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
const password =
  process.env.PLAY_REVIEW_PASSWORD?.trim() || "OorjaManPlayReview2026!";

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (see scripts/seed-play-review-users.mjs header).",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  {
    email: "appreview.customer@oorjaman.com",
    role: "customer",
    fullName: "Play Review Customer",
    phone: "+919000009901",
  },
  {
    email: "appreview.technician@oorjaman.com",
    role: "technician",
    fullName: "Play Review Technician",
    phone: "+919000009902",
  },
];

/** Guwahati (Kamrup Metro) review persona — used for customer site + technician home base. */
const GUWAHATI = {
  label: "Home — Guwahati",
  line1: "House No. 12, Bye Lane 3, Zoo Road Tiniali",
  line2: "Near Assam State Zoo",
  city: "Guwahati",
  district: "Kamrup Metropolitan",
  state: "Assam",
  pincode: "781003",
  country: "India",
  lat: 26.1536,
  lng: 91.7794,
};

function guwahatiAddressJson() {
  const formatted = [
    GUWAHATI.line1,
    GUWAHATI.line2,
    `${GUWAHATI.city}, ${GUWAHATI.state}`,
    GUWAHATI.pincode,
  ].join(", ");
  return {
    label: GUWAHATI.label,
    line1: GUWAHATI.line1,
    line2: GUWAHATI.line2,
    city: GUWAHATI.city,
    district: GUWAHATI.district,
    state: GUWAHATI.state,
    pincode: GUWAHATI.pincode,
    country: GUWAHATI.country,
    formatted,
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

async function upsertAuthUser({ email, role, fullName, phone }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email,
      password,
      email_confirm: true,
      phone,
      phone_confirm: true,
      user_metadata: { role, full_name: fullName },
    });
    if (error) throw error;
    console.log(`updated ${email} (${role}) id=${data.user.id}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone,
    phone_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw error;
  console.log(`created ${email} (${role}) id=${data.user.id}`);
  return data.user;
}

function playReviewCustomerPayload(fullName) {
  const now = new Date().toISOString();
  const address = guwahatiAddressJson();
  const addressId = "play-review-guwahati-home";
  return {
    display_name: fullName,
    contact_email: "appreview.customer@oorjaman.com",
    alternate_phone: "+919000009901",
    billing_address: address,
    service_default_address: address,
    service_lat: GUWAHATI.lat,
    service_lng: GUWAHATI.lng,
    location_accuracy_m: 25,
    location_recorded_at: now,
    solar_capacity_kw: 5,
    solar_panel_count: 10,
    installation_category: "residential",
    solar_roof_type: "flat",
    solar_roof_material: "rcc",
    last_cleaning_at: "2026-06-15",
    safety_roof_access: "stairs",
    safety_water_availability: "yes",
    safety_hazards: "None — Play Store review dummy site",
    notes: "Play Store review persona. Site in Guwahati, Assam.",
    onboarding_completed_at: now,
    metadata: {
      play_review: true,
      default_service_address_id: addressId,
      service_addresses: [
        {
          id: addressId,
          label: GUWAHATI.label,
          address,
          created_at: now,
          service_lat: GUWAHATI.lat,
          service_lng: GUWAHATI.lng,
          location_accuracy_m: 25,
          location_recorded_at: now,
        },
      ],
      installation_enrichment: {
        panel_brand: "Waaree",
        inverter_brand: "Growatt",
        epc_vendor_name: "Local Guwahati EPC",
      },
      registration: {
        consents: {
          information_accurate: true,
          terms_safety_privacy: true,
          contact_for_scheduling: true,
          recorded_at: now,
        },
      },
    },
  };
}

function playReviewTechnicianPayload(fullName, vendorId) {
  const now = new Date().toISOString();
  const address = guwahatiAddressJson();
  const row = {
    metadata: {
      full_name: fullName,
      play_review: true,
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
    },
    verification_status: "verified",
    vendor_review_status: "approved",
    vendor_reviewed_at: now,
    verification_submitted_at: now,
    verification_reviewed_at: now,
    is_verified: true,
    is_available: true,
    flag_safety_training: true,
    flag_height_work_cert: true,
    flag_solar_cleaning_experience: true,
    personal_phone: "+919000009902",
    contact_email: "appreview.technician@oorjaman.com",
    name_as_per_aadhaar: fullName,
    date_of_birth: "1995-06-15",
    father_guardian_name: "Play Review Guardian",
    gender: "male",
    emergency_contact_name: "Play Review Emergency",
    emergency_contact_phone: "+919000009903",
    aadhaar_last4: "0000",
    pan_number: "AAAAA0000A",
    skills: ["solar_cleaning", "water_fed_poles"],
    other_skills: "Residential rooftop access, inverter visual checks",
    service_radius_km: 25,
    safety_training_org: "OorjaMan Safety Training",
    doc_aadhaar_url: "play-review/placeholder-aadhaar",
    doc_pan_url: "play-review/placeholder-pan",
    doc_bank_proof_url: "play-review/placeholder-bank",
    doc_passport_url: "play-review/placeholder-passport",
    doc_safety_certificate_url: "play-review/placeholder-safety-cert",
    bank_account_holder_name: fullName,
    bank_account_last4: "0000",
    bank_ifsc: "SBIN0000123",
    experience_summary:
      "Play Store review technician based in Guwahati, Assam. Residential rooftop cleaning.",
    years_experience: 3,
    preferred_work_locations: ["Guwahati"],
    home_base_address: address,
  };
  if (vendorId) row.vendor_id = vendorId;
  return row;
}

async function ensureCustomerProfile(userId, fullName) {
  const payload = playReviewCustomerPayload(fullName);
  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("customers")
      .update(payload)
      .eq("id", existing.id);
    if (error) console.warn(`  customer update: ${error.message}`);
    else console.log("  customer Guwahati persona filled");
    return;
  }

  const { error } = await admin.from("customers").insert({
    user_id: userId,
    ...payload,
  });
  if (error) console.warn(`  customer insert: ${error.message}`);
  else console.log("  customer profile created with Guwahati persona");
}

async function ensureTechnicianProfile(userId, fullName) {
  const { data: vendor } = await admin
    .from("vendors")
    .select("id")
    .eq("approval_status", "approved")
    .limit(1)
    .maybeSingle();

  const payload = playReviewTechnicianPayload(fullName, vendor?.id ?? null);
  const { data: existing } = await admin
    .from("technicians")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    // Existing rows: avoid vendor-review / verification columns (DB triggers block changes).
    const personaOnly = {
      metadata: payload.metadata,
      personal_phone: payload.personal_phone,
      contact_email: payload.contact_email,
      name_as_per_aadhaar: payload.name_as_per_aadhaar,
      date_of_birth: payload.date_of_birth,
      father_guardian_name: payload.father_guardian_name,
      gender: payload.gender,
      emergency_contact_name: payload.emergency_contact_name,
      emergency_contact_phone: payload.emergency_contact_phone,
      aadhaar_last4: payload.aadhaar_last4,
      pan_number: payload.pan_number,
      skills: payload.skills,
      other_skills: payload.other_skills,
      service_radius_km: payload.service_radius_km,
      safety_training_org: payload.safety_training_org,
      doc_aadhaar_url: payload.doc_aadhaar_url,
      doc_pan_url: payload.doc_pan_url,
      doc_bank_proof_url: payload.doc_bank_proof_url,
      doc_passport_url: payload.doc_passport_url,
      doc_safety_certificate_url: payload.doc_safety_certificate_url,
      bank_account_holder_name: payload.bank_account_holder_name,
      bank_account_last4: payload.bank_account_last4,
      bank_ifsc: payload.bank_ifsc,
      experience_summary: payload.experience_summary,
      years_experience: payload.years_experience,
      preferred_work_locations: payload.preferred_work_locations,
      home_base_address: payload.home_base_address,
      flag_safety_training: payload.flag_safety_training,
      flag_height_work_cert: payload.flag_height_work_cert,
      flag_solar_cleaning_experience: payload.flag_solar_cleaning_experience,
      is_available: payload.is_available,
    };
    if (payload.vendor_id) personaOnly.vendor_id = payload.vendor_id;
    const { error } = await admin
      .from("technicians")
      .update(personaOnly)
      .eq("id", existing.id);
    if (error) console.warn(`  technician update: ${error.message}`);
    else console.log("  technician Guwahati persona filled");
    return;
  }

  const { error } = await admin.from("technicians").insert({
    user_id: userId,
    ...payload,
  });
  if (error) console.warn(`  technician insert: ${error.message}`);
  else
    console.log(
      vendor?.id
        ? `  technician profile created (vendor ${vendor.id})`
        : "  technician profile created (no approved vendor to link)",
    );
  console.log(
    "  note: if verification stays pending, run the disable-trigger finalize SQL from scripts/uat-approve-profiles-and-clear-ops.sql pattern",
  );
}

async function main() {
  console.log(`Play review password: ${password}`);
  for (const account of ACCOUNTS) {
    const user = await upsertAuthUser(account);
    // Give trigger a moment to create public.users
    await new Promise((r) => setTimeout(r, 400));
    const { error: roleErr } = await admin
      .from("users")
      .update({ role: account.role, full_name: account.fullName })
      .eq("id", user.id);
    if (roleErr) {
      // Auth trigger may lag; upsert users then retry role.
      console.warn(`  users.role: ${roleErr.message}`);
      await new Promise((r) => setTimeout(r, 1200));
      const { error: retryErr } = await admin
        .from("users")
        .update({ role: account.role, full_name: account.fullName })
        .eq("id", user.id);
      if (retryErr) console.warn(`  users.role retry: ${retryErr.message}`);
    }

    if (account.role === "customer") {
      await ensureCustomerProfile(user.id, account.fullName);
    } else if (account.role === "technician") {
      await ensureTechnicianProfile(user.id, account.fullName);
    }
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
