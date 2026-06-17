/**
 * Remove orphan one-time checkout rows from the old create-then-pay flow:
 *   • bookings.status = pending_payment (never completed payment)
 *   • bookings.status = cancelled with reason "Checkout closed before payment"
 *
 * Deletes linked pending/failed payments, job reports, and activity events.
 * Does not touch confirmed/completed visits or AMC subscriptions.
 *
 * Requires repo root `.env.uat.local` (default) or `.env.production.local` with SEED_ENV=production:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run cleanup:orphan-checkouts -- --dry-run
 *   npm run cleanup:orphan-checkouts -- --yes
 *   npm run cleanup:orphan-checkouts -- --customer-phone=+919000000401 --dry-run
 *
 * Options:
 *   --customer-phone   Limit to one customer (E.164 / seed phone)
 *   --dry-run          List counts only; no deletes
 *   --yes              Skip confirmation prompt
 */

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { loadScriptEnv } from "./load-script-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { tier, path: envPath } = loadScriptEnv();
if (envPath) console.log(`Using script env (${tier}): ${envPath}`);

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ABANDON_CANCEL_REASON = "Checkout closed before payment";

function parseArgs(argv) {
  const out = { customerPhone: null, dryRun: false, yes: false };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--yes") out.yes = true;
    else if (arg.startsWith("--customer-phone=")) out.customerPhone = arg.slice("--customer-phone=".length).trim();
    else if (arg === "--help" || arg === "-h") {
      console.log("See scripts/cleanup-orphan-checkout-bookings.mjs header for usage.");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return out;
}

function phoneDigits(p) {
  if (p == null || p === "") return "";
  return String(p).replace(/\D/g, "");
}

function phonesMatch(canonical, stored) {
  const a = phoneDigits(canonical);
  const b = phoneDigits(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10) return a.slice(-10) === b.slice(-10);
  return false;
}

async function findUserByPhone(phone) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.phone && phonesMatch(phone, u.phone));
    if (hit) return hit;
    if (data.users.length < 200) break;
    page += 1;
  }
  const { data: users, error } = await admin.from("users").select("id, phone").not("phone", "is", null);
  if (error) throw error;
  const row = (users ?? []).find((u) => u.phone && phonesMatch(phone, u.phone));
  return row ? { id: row.id, phone: row.phone } : null;
}

async function resolveCustomerId(phone) {
  const user = await findUserByPhone(phone);
  if (!user) throw new Error(`No user for phone ${phone}`);
  const { data, error } = await admin.from("customers").select("id, display_name").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No customer profile for phone ${phone}`);
  return data;
}

async function fetchOrphanCandidates(customerId) {
  const select =
    "id, status, cancellation_reason, customer_id, created_at, reference_code, metadata";

  let pendingQ = admin
    .from("bookings")
    .select(select)
    .eq("status", "pending_payment")
    .order("created_at", { ascending: true });
  let abandonedQ = admin
    .from("bookings")
    .select(select)
    .eq("status", "cancelled")
    .eq("cancellation_reason", ABANDON_CANCEL_REASON)
    .order("created_at", { ascending: true });

  if (customerId) {
    pendingQ = pendingQ.eq("customer_id", customerId);
    abandonedQ = abandonedQ.eq("customer_id", customerId);
  }

  const [pendingRes, abandonedRes] = await Promise.all([pendingQ, abandonedQ]);
  if (pendingRes.error) throw pendingRes.error;
  if (abandonedRes.error) throw abandonedRes.error;

  const byId = new Map();
  for (const row of [...(pendingRes.data ?? []), ...(abandonedRes.data ?? [])]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

async function bookingHasSuccessPayment(bookingId) {
  const { data, error } = await admin
    .from("payments")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "success")
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

async function countRowsIn(table, column, ids) {
  if (!ids.length) return 0;
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).in(column, ids);
  if (error) throw error;
  return count ?? 0;
}

async function deleteWhereIn(table, column, ids) {
  if (!ids.length) return;
  const { error } = await admin.from(table).delete().in(column, ids);
  if (error) throw error;
}

function summarizeCandidates(rows) {
  const pending = rows.filter((r) => r.status === "pending_payment").length;
  const abandoned = rows.filter((r) => r.status === "cancelled").length;
  return { total: rows.length, pending, abandoned };
}

async function confirmProceed(summary, dryRun) {
  if (dryRun) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(
      `\nDelete ${summary.total} orphan checkout booking(s) (${summary.pending} pending_payment, ${summary.abandoned} abandoned cancel) and linked rows? [y/N] `,
      resolve,
    );
  });
  rl.close();
  return /^y(es)?$/i.test(String(answer).trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let customerId = null;
  let customerLabel = "all customers";
  if (args.customerPhone) {
    const customer = await resolveCustomerId(args.customerPhone);
    customerId = customer.id;
    customerLabel = `${customer.display_name ?? customer.id} (${args.customerPhone})`;
  }

  console.log(`\nScanning orphan checkout bookings for ${customerLabel}…`);

  const candidates = await fetchOrphanCandidates(customerId);
  const safeToDelete = [];

  for (const row of candidates) {
    if (await bookingHasSuccessPayment(row.id)) {
      console.warn(`  SKIP ${row.id} — has a successful payment (unexpected for orphan).`);
      continue;
    }
    safeToDelete.push(row);
  }

  const summary = summarizeCandidates(safeToDelete);
  const bookingIds = safeToDelete.map((r) => r.id);

  if (bookingIds.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  const linked = {
    payments: await countRowsIn("payments", "booking_id", bookingIds),
    job_reports: await countRowsIn("job_reports", "booking_id", bookingIds),
    customer_site_activity_events: await countRowsIn("customer_site_activity_events", "booking_id", bookingIds),
    technician_activity_events: await countRowsIn("technician_activity_events", "booking_id", bookingIds),
    notification_events: await countRowsIn("notification_events", "booking_id", bookingIds),
  };

  console.log("\nCandidates:");
  for (const row of safeToDelete) {
    const ref = row.reference_code?.trim() || row.id.slice(0, 8);
    console.log(`  • ${ref}  ${row.status}  ${row.created_at}`);
  }

  console.log("\nWill remove:");
  console.log(`  bookings:                      ${summary.total}`);
  console.log(`  payments (linked):             ${linked.payments}`);
  console.log(`  job_reports:                   ${linked.job_reports}`);
  console.log(`  customer_site_activity_events: ${linked.customer_site_activity_events}`);
  console.log(`  technician_activity_events:    ${linked.technician_activity_events}`);
  console.log(`  notification_events:           ${linked.notification_events}`);

  if (args.dryRun) {
    console.log("\nDRY RUN — no rows deleted.");
    return;
  }

  if (!args.yes) {
    const ok = await confirmProceed(summary, false);
    if (!ok) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log("\nDeleting…");

  await deleteWhereIn("job_reports", "booking_id", bookingIds);
  await deleteWhereIn("payments", "booking_id", bookingIds);
  await deleteWhereIn("customer_site_activity_events", "booking_id", bookingIds);
  await deleteWhereIn("technician_activity_events", "booking_id", bookingIds);
  await deleteWhereIn("notification_events", "booking_id", bookingIds);
  await deleteWhereIn("bookings", "id", bookingIds);

  console.log(`\nDone. Removed ${bookingIds.length} orphan checkout booking(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
