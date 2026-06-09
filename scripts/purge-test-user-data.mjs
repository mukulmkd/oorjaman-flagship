/**
 * Purge transactional test data for one customer and/or one technician while
 * keeping profile rows (customers, technicians, users, auth, site photos, KYC docs).
 *
 * Requires in environment (repo root `.env`):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run purge:test-data -- --customer-phone=+919000000401 --technician-phone=+919000000301 --yes
 *   npm run purge:test-data -- --all-dummy --yes
 *   npm run purge:test-data -- --customer-id=<uuid> --technician-id=<uuid> --dry-run
 *
 * Options:
 *   --customer-phone / --technician-phone   E.164 phone on public.users
 *   --customer-id / --technician-id         Extension table UUIDs
 *   --all-dummy                             Seed dummy customer 401/402 + tech 301/302
 *   --dry-run                               Count rows only; no deletes
 *   --yes                                   Skip confirmation prompt
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { createInterface } from "readline";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DUMMY_CUSTOMER_PHONES = ["+919000000401", "+919000000402"];
const DUMMY_TECHNICIAN_PHONES = ["+919000000301", "+919000000302"];

function parseArgs(argv) {
  const out = {
    customerPhone: null,
    technicianPhone: null,
    customerId: null,
    technicianId: null,
    allDummy: false,
    dryRun: false,
    yes: false,
  };
  for (const arg of argv) {
    if (arg === "--all-dummy") out.allDummy = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--yes") out.yes = true;
    else if (arg.startsWith("--customer-phone=")) out.customerPhone = arg.slice("--customer-phone=".length).trim();
    else if (arg.startsWith("--technician-phone=")) out.technicianPhone = arg.slice("--technician-phone=".length).trim();
    else if (arg.startsWith("--customer-id=")) out.customerId = arg.slice("--customer-id=".length).trim();
    else if (arg.startsWith("--technician-id=")) out.technicianId = arg.slice("--technician-id=".length).trim();
    else if (arg === "--help" || arg === "-h") {
      console.log("See scripts/purge-test-user-data.mjs header for usage.");
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
  const { data: users, error } = await admin
    .from("users")
    .select("id, phone")
    .not("phone", "is", null);
  if (error) throw error;
  const row = (users ?? []).find((u) => u.phone && phonesMatch(phone, u.phone));
  return row ? { id: row.id, phone: row.phone } : null;
}

async function resolveCustomer({ phone, id }) {
  if (id) {
    const { data, error } = await admin.from("customers").select("id, user_id, display_name").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No customer row for id ${id}`);
    return data;
  }
  if (!phone) return null;
  const user = await findUserByPhone(phone);
  if (!user) throw new Error(`No auth/public user for customer phone ${phone}`);
  const { data, error } = await admin
    .from("customers")
    .select("id, user_id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No customer profile for phone ${phone} (user ${user.id})`);
  return data;
}

async function resolveTechnician({ phone, id }) {
  if (id) {
    const { data, error } = await admin
      .from("technicians")
      .select("id, user_id, vendor_id, personal_phone")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No technician row for id ${id}`);
    return data;
  }
  if (!phone) return null;
  const user = await findUserByPhone(phone);
  if (!user) throw new Error(`No auth/public user for technician phone ${phone}`);
  const { data, error } = await admin
    .from("technicians")
    .select("id, user_id, vendor_id, personal_phone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: byPhone, error: perr } = await admin
      .from("technicians")
      .select("id, user_id, vendor_id, personal_phone")
      .eq("personal_phone", phone)
      .maybeSingle();
    if (perr) throw perr;
    if (!byPhone) throw new Error(`No technician profile for phone ${phone}`);
    return byPhone;
  }
  return data;
}

async function countRows(table, column, id) {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, id);
  if (error) throw error;
  return count ?? 0;
}

async function countRowsIn(table, column, ids) {
  if (!ids.length) return 0;
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).in(column, ids);
  if (error) throw error;
  return count ?? 0;
}

async function selectIds(table, column, id) {
  const { data, error } = await admin.from(table).select("id").eq(column, id);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

async function selectBookingIdsForCustomer(customerId) {
  const { data, error } = await admin.from("bookings").select("id").eq("customer_id", customerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

async function selectBookingIdsForTechnician(technicianId) {
  const { data, error } = await admin.from("bookings").select("id").eq("technician_id", technicianId);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

async function selectSupportAttachmentPaths({ customerId, technicianId }) {
  const filters = [];
  if (customerId) filters.push(`customer_id.eq.${customerId}`);
  if (technicianId) filters.push(`technician_id.eq.${technicianId}`);
  if (!filters.length) return [];

  const { data: convs, error: cErr } = await admin
    .from("support_conversations")
    .select("id")
    .or(filters.join(","));
  if (cErr) throw cErr;
  const convIds = (convs ?? []).map((c) => c.id);
  if (!convIds.length) return [];

  const { data: msgs, error: mErr } = await admin.from("support_messages").select("id").in("conversation_id", convIds);
  if (mErr) throw mErr;
  const msgIds = (msgs ?? []).map((m) => m.id);
  if (!msgIds.length) return [];

  const { data: atts, error: aErr } = await admin
    .from("support_message_attachments")
    .select("storage_path")
    .in("message_id", msgIds);
  if (aErr) throw aErr;
  return (atts ?? []).map((a) => a.storage_path).filter(Boolean);
}

async function removeStoragePaths(bucket, paths) {
  if (!paths.length) return 0;
  const unique = [...new Set(paths)];
  const chunkSize = 100;
  let removed = 0;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw error;
    removed += chunk.length;
  }
  return removed;
}

async function removeJobPhotosForBookings(bookingIds) {
  if (!bookingIds.length) return 0;
  let removed = 0;
  for (const bookingId of bookingIds) {
    const { data, error } = await admin.storage.from("job-photos").list(bookingId, { limit: 200 });
    if (error) {
      if (String(error.message ?? "").toLowerCase().includes("not found")) continue;
      throw error;
    }
    const paths = (data ?? []).map((f) => `${bookingId}/${f.name}`);
    if (!paths.length) continue;
    removed += await removeStoragePaths("job-photos", paths);
  }
  return removed;
}

async function deleteWhere(table, column, id, dryRun) {
  if (dryRun) return await countRows(table, column, id);
  const { error } = await admin.from(table).delete().eq(column, id);
  if (error) throw error;
  return null;
}

async function deleteWhereIn(table, column, ids, dryRun) {
  if (!ids.length) return 0;
  if (dryRun) return await countRowsIn(table, column, ids);
  const { error } = await admin.from(table).delete().in(column, ids);
  if (error) throw error;
  return null;
}

async function purgeCustomerTransactional(customer, { dryRun }) {
  const customerId = customer.id;
  const label = customer.display_name ?? customerId;
  console.log(`\n- Customer ${label} (${customerId}) -`);

  const bookingIds = await selectBookingIdsForCustomer(customerId);
  const subscriptionIds = await selectIds("subscriptions", "customer_id", customerId);
  const supportPaths = await selectSupportAttachmentPaths({ customerId, technicianId: null });

  const summary = {
    job_reports: await countRowsIn("job_reports", "booking_id", bookingIds),
    bookings: bookingIds.length,
    subscriptions: subscriptionIds.length,
    payments: await countRows("payments", "customer_id", customerId),
    customer_site_activity_events: await countRows("customer_site_activity_events", "customer_id", customerId),
    support_conversations: await countRows("support_conversations", "customer_id", customerId),
    customer_push_tokens: await countRows("customer_push_tokens", "customer_id", customerId),
    customer_push_outbox: await countRows("customer_push_outbox", "customer_id", customerId),
    job_photo_objects: bookingIds.length,
    support_attachments: supportPaths.length,
  };

  console.log("  Rows to remove:", summary);

  if (dryRun) return summary;

  if (bookingIds.length) {
    await deleteWhereIn("job_reports", "booking_id", bookingIds, false);
    await deleteWhereIn("bookings", "id", bookingIds, false);
  }

  if (subscriptionIds.length) {
    await deleteWhereIn("subscriptions", "id", subscriptionIds, false);
  }

  await deleteWhere("payments", "customer_id", customerId, false);
  await deleteWhere("customer_site_activity_events", "customer_id", customerId, false);
  await deleteWhere("support_conversations", "customer_id", customerId, false);
  await deleteWhere("customer_push_tokens", "customer_id", customerId, false);
  await deleteWhere("customer_push_outbox", "customer_id", customerId, false);

  const jobPhotosRemoved = await removeJobPhotosForBookings(bookingIds);
  const supportRemoved = await removeStoragePaths("support-attachments", supportPaths);

  console.log(`  Deleted. Storage: ${jobPhotosRemoved} job photo(s), ${supportRemoved} support attachment(s).`);
  console.log("  Kept: customers row, users/auth, service addresses, site photos, profile fields.");

  return summary;
}

async function purgeTechnicianTransactional(technician, { dryRun }) {
  const technicianId = technician.id;
  const label = technician.personal_phone ?? technicianId;
  console.log(`\n- Technician ${label} (${technicianId}) -`);

  const bookingIds = await selectBookingIdsForTechnician(technicianId);
  const supportPaths = await selectSupportAttachmentPaths({ customerId: null, technicianId });

  const summary = {
    job_reports: await countRowsIn("job_reports", "booking_id", bookingIds),
    bookings: bookingIds.length,
    technician_locations: await countRows("technician_locations", "technician_id", technicianId),
    technician_activity_events: await countRows("technician_activity_events", "technician_id", technicianId),
    support_conversations: await countRows("support_conversations", "technician_id", technicianId),
    technician_push_tokens: await countRows("technician_push_tokens", "technician_id", technicianId),
    technician_push_outbox: await countRows("technician_push_outbox", "technician_id", technicianId),
    job_photo_objects: bookingIds.length,
    support_attachments: supportPaths.length,
  };

  console.log("  Rows to remove:", summary);

  if (dryRun) return summary;

  if (bookingIds.length) {
    await deleteWhereIn("job_reports", "booking_id", bookingIds, false);
    await deleteWhereIn("bookings", "id", bookingIds, false);
  }

  await deleteWhere("technician_locations", "technician_id", technicianId, false);
  await deleteWhere("technician_activity_events", "technician_id", technicianId, false);
  await deleteWhere("support_conversations", "technician_id", technicianId, false);
  await deleteWhere("technician_push_tokens", "technician_id", technicianId, false);
  await deleteWhere("technician_push_outbox", "technician_id", technicianId, false);

  const jobPhotosRemoved = await removeJobPhotosForBookings(bookingIds);
  const supportRemoved = await removeStoragePaths("support-attachments", supportPaths);

  console.log(`  Deleted. Storage: ${jobPhotosRemoved} job photo(s), ${supportRemoved} support attachment(s).`);
  console.log("  Kept: technicians row, users/auth, KYC docs, vendor link, onboarding profile.");

  return summary;
}

async function confirmProceed(targets, dryRun) {
  if (dryRun) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(
      `\nThis will permanently delete transactional data for:\n${targets.map((t) => `  • ${t}`).join("\n")}\nProfile rows are kept. Continue? [y/N] `,
      resolve,
    );
  });
  rl.close();
  return /^y(es)?$/i.test(String(answer).trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  /** @type {{ customer?: object; technician?: object; label: string }[]} */
  const jobs = [];

  if (args.allDummy) {
    for (const phone of DUMMY_CUSTOMER_PHONES) {
      const customer = await resolveCustomer({ phone, id: null });
      jobs.push({ customer, label: `customer ${phone}` });
    }
    for (const phone of DUMMY_TECHNICIAN_PHONES) {
      const technician = await resolveTechnician({ phone, id: null });
      jobs.push({ technician, label: `technician ${phone}` });
    }
  } else {
    const customer = await resolveCustomer({
      phone: args.customerPhone,
      id: args.customerId,
    });
    const technician = await resolveTechnician({
      phone: args.technicianPhone,
      id: args.technicianId,
    });
    if (!customer && !technician) {
      console.error(
        "Specify at least one target: --customer-phone, --customer-id, --technician-phone, --technician-id, or --all-dummy.",
      );
      process.exit(1);
    }
    if (customer) jobs.push({ customer, label: `customer ${customer.display_name ?? customer.id}` });
    if (technician) jobs.push({ technician, label: `technician ${technician.personal_phone ?? technician.id}` });
  }

  if (!args.yes) {
    const ok = await confirmProceed(
      jobs.map((j) => j.label),
      args.dryRun,
    );
    if (!ok) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log(args.dryRun ? "\nDRY RUN - no data will be deleted.\n" : "\nPurging transactional data…");

  for (const job of jobs) {
    if (job.customer) await purgeCustomerTransactional(job.customer, { dryRun: args.dryRun });
    if (job.technician) await purgeTechnicianTransactional(job.technician, { dryRun: args.dryRun });
  }

  console.log(args.dryRun ? "\nDry run complete." : "\nDone. Profiles were not modified.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
