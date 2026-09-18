#!/usr/bin/env node
/**
 * UAT-only demo harness: accept + assign latest booking for the play-review customer
 * to Gamusa technician Amit Das. Mirrors vendorAcceptBookingRequest outcomes without
 * modifying app source. Uses service role against UAT (.env.uat.local).
 *
 * Usage: node scripts/product-demo/phase2_assign_booking.mjs
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = join(root, ".env.uat.local");
if (!existsSync(envFile)) {
  console.error("Missing .env.uat.local");
  process.exit(1);
}
config({ path: envFile });

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.uat.local");
  process.exit(1);
}

const CUSTOMER_EMAIL = "appreview.customer@oorjaman.com";
const TECH_EMAIL = "amit.das@gamusagreen.in";
const GAMUSA_VENDOR_ID = "abcdf706-2f75-49c8-9fcb-a5745df0fc07";

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: userRows, error: uErr } = await admin
    .from("users")
    .select("id, email")
    .eq("email", CUSTOMER_EMAIL)
    .maybeSingle();
  if (uErr) throw uErr;
  if (!userRows) throw new Error(`No public.users row for ${CUSTOMER_EMAIL}`);

  const { data: customer, error: cErr } = await admin
    .from("customers")
    .select("id")
    .eq("user_id", userRows.id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!customer) throw new Error("No customers row for play-review customer");

  const { data: techUser } = await admin.from("users").select("id").eq("email", TECH_EMAIL).maybeSingle();
  if (!techUser) throw new Error(`No user for ${TECH_EMAIL}`);
  const { data: tech, error: tErr } = await admin
    .from("technicians")
    .select("id, vendor_id, is_verified, verification_status")
    .eq("user_id", techUser.id)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!tech?.is_verified || tech.verification_status !== "verified") {
    throw new Error("Technician not verified");
  }

  const { data: bookings, error: bErr } = await admin
    .from("bookings")
    .select("id, status, booking_code, metadata, reference_code, scheduled_start, scheduled_end")
    .eq("customer_id", customer.id)
    .in("status", ["confirmed", "pending_payment", "accepted"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (bErr) throw bErr;
  if (!bookings?.length) throw new Error("No recent bookings for customer");

  const booking =
    bookings.find((b) => b.status === "confirmed" || b.status === "pending_payment") || bookings[0];

  const code =
    booking.booking_code ||
    String(Math.floor(100000 + Math.random() * 900000));
  // Job finish code (happy code) — mirrors vendorAcceptBookingRequest
  const happyCode = String(Math.floor(1000 + Math.random() * 9000));
  const now = new Date().toISOString();
  const meta =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? { ...booking.metadata }
      : {};
  meta.vendor_acceptance = {
    accepted_at: now,
    technician_readiness_ack: true,
    safety_compliance_ack: true,
    uniform_safety_kit_ack: true,
    safety_briefing_ack: true,
    technician_id: tech.id,
  };
  meta.service_otp = {
    start_code: code,
    happy_code: happyCode,
    generated_at: now,
  };

  const { data: updated, error: upErr } = await admin
    .from("bookings")
    .update({
      status: "accepted",
      vendor_id: tech.vendor_id || GAMUSA_VENDOR_ID,
      technician_id: tech.id,
      booking_code: code,
      metadata: meta,
    })
    .eq("id", booking.id)
    .select("id, status, booking_code, reference_code, technician_id, scheduled_start, scheduled_end, metadata")
    .single();
  if (upErr) throw upErr;

  console.log(
    JSON.stringify(
      {
        ok: true,
        booking_id: updated.id,
        status: updated.status,
        booking_code: updated.booking_code,
        happy_code: happyCode,
        reference_code: updated.reference_code,
        technician_id: updated.technician_id,
        scheduled_start: updated.scheduled_start,
        scheduled_end: updated.scheduled_end,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
