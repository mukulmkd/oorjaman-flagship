#!/usr/bin/env node
/**
 * Clean UAT booking-related dummy data for the product-demo accounts
 * before an end-to-end dual-app recording.
 *
 * Keeps profiles / auth / addresses. Removes bookings + dependent rows + job photos.
 *
 * Accounts:
 *   appreview.customer@oorjaman.com
 *   amit.das@gamusagreen.in
 *
 * Usage (from repo root):
 *   node scripts/product-demo/clean_uat_demo_bookings.mjs
 *   node scripts/product-demo/clean_uat_demo_bookings.mjs --dry-run
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
const dryRun = process.argv.includes("--dry-run");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function userIdByEmail(email) {
  const { data, error } = await admin.from("users").select("id, email").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No public.users row for ${email}`);
  return data.id;
}

async function deleteIn(table, column, ids) {
  if (!ids.length) return 0;
  if (dryRun) {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .in(column, ids);
    if (error) throw error;
    return count ?? 0;
  }
  const { error } = await admin.from(table).delete().in(column, ids);
  if (error) throw error;
  return ids.length;
}

async function nullifyBookingFk(table, column, ids) {
  if (!ids.length || dryRun) return 0;
  const { error } = await admin.from(table).update({ [column]: null }).in(column, ids);
  if (error) {
    // Column may be NOT NULL — fall through to delete attempt upstream
    console.warn(`  warn nullify ${table}.${column}: ${error.message}`);
    return 0;
  }
  return 1;
}

async function removeJobPhotos(bookingIds) {
  if (!bookingIds.length || dryRun) return 0;
  let removed = 0;
  for (const bookingId of bookingIds) {
    const { data, error } = await admin.storage.from("job-photos").list(bookingId, { limit: 200 });
    if (error) {
      if (String(error.message ?? "").toLowerCase().includes("not found")) continue;
      console.warn(`  warn list job-photos/${bookingId}: ${error.message}`);
      continue;
    }
    const paths = (data ?? []).map((f) => `${bookingId}/${f.name}`);
    if (!paths.length) continue;
    const { error: rErr } = await admin.storage.from("job-photos").remove(paths);
    if (rErr) console.warn(`  warn remove job-photos: ${rErr.message}`);
    else removed += paths.length;
  }
  return removed;
}

async function main() {
  console.log(dryRun ? "DRY RUN — no deletes" : "CLEANING UAT demo bookings…");
  console.log(`Customer: ${CUSTOMER_EMAIL}`);
  console.log(`Technician: ${TECH_EMAIL}`);

  const custUserId = await userIdByEmail(CUSTOMER_EMAIL);
  const techUserId = await userIdByEmail(TECH_EMAIL);

  const { data: customer, error: cErr } = await admin
    .from("customers")
    .select("id")
    .eq("user_id", custUserId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!customer) throw new Error("No customers row for play-review customer");

  const { data: tech, error: tErr } = await admin
    .from("technicians")
    .select("id")
    .eq("user_id", techUserId)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!tech) throw new Error("No technicians row for Amit");

  const { data: custBookings, error: b1 } = await admin
    .from("bookings")
    .select("id, status, reference_code")
    .eq("customer_id", customer.id);
  if (b1) throw b1;

  const { data: techBookings, error: b2 } = await admin
    .from("bookings")
    .select("id, status, reference_code")
    .eq("technician_id", tech.id);
  if (b2) throw b2;

  const byId = new Map();
  for (const b of [...(custBookings ?? []), ...(techBookings ?? [])]) byId.set(b.id, b);
  const bookingIds = [...byId.keys()];
  console.log(`Bookings to remove: ${bookingIds.length}`);
  for (const b of byId.values()) {
    console.log(`  - ${b.reference_code ?? b.id} (${b.status})`);
  }

  const dependent = [
    ["job_reports", "booking_id"],
    ["payments", "booking_id"],
    ["customer_site_activity_events", "booking_id"],
    ["technician_activity_events", "booking_id"],
    ["notification_events", "booking_id"],
    ["subscription_visit_slots", "booking_id"],
    ["customer_oorjaman_credit_redemptions", "booking_id"],
    ["amc_wallet_entries", "booking_id"],
    ["vendor_settlements", "booking_id"],
  ];

  const summary = {};
  for (const [table, col] of dependent) {
    try {
      summary[table] = await deleteIn(table, col, bookingIds);
      console.log(`  ${table}: ${summary[table]}`);
    } catch (e) {
      console.warn(`  skip ${table}: ${e.message}`);
      summary[table] = `error: ${e.message}`;
    }
  }

  // Soft-clear optional FKs that should not block booking delete
  await nullifyBookingFk("support_conversations", "booking_id", bookingIds);
  await nullifyBookingFk("customer_oorjaman_credit_grants", "source_booking_id", bookingIds);
  await nullifyBookingFk("vendor_deferred_penalties", "applied_booking_id", bookingIds);
  await nullifyBookingFk("vendor_deferred_penalties", "source_booking_id", bookingIds);

  summary.bookings = await deleteIn("bookings", "id", bookingIds);
  console.log(`  bookings: ${summary.bookings}`);

  const photos = await removeJobPhotos(bookingIds);
  console.log(`  job-photos objects removed: ${photos}`);

  // Verify empty
  const { count: leftCust } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id);
  const { count: leftTech } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("technician_id", tech.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        removed_booking_ids: bookingIds.length,
        remaining_customer_bookings: leftCust ?? 0,
        remaining_technician_bookings: leftTech ?? 0,
        kept: "customers, technicians, users/auth, service addresses, profile docs",
      },
      null,
      2,
    ),
  );

  if (!dryRun && ((leftCust ?? 0) > 0 || (leftTech ?? 0) > 0)) {
    process.exitCode = 2;
    console.error("WARNING: some bookings remain — check FK blockers above");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
