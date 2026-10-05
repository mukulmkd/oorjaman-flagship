/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Partner (technician) self-service account deletion (Apple / Play compliant).
 * Removes sign-in, personal profile, identity documents, and live location history.
 * Completed bookings stay; the technician link is cleared by the existing foreign key.
 */
import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import {
  enforceEdgeRateLimit,
  subjectUserAndIp,
} from "../_shared/rate-limit.ts";

const OPEN_BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "vendor_acknowledged",
  "accepted",
  "in_progress",
] as const;

const TECHNICIAN_DOCS_BUCKET = "technician-documents";

const TECHNICIAN_SELECT =
  "id, metadata, doc_aadhaar_url, doc_pan_url, doc_bank_proof_url, doc_passport_url, doc_safety_certificate_url";

const DOC_COLUMNS = [
  "doc_aadhaar_url",
  "doc_pan_url",
  "doc_bank_proof_url",
  "doc_passport_url",
  "doc_safety_certificate_url",
] as const;

Deno.serve(async (req: Request) => {
  const cors = resolveCors(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const jwt = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt);
  if (userErr || !user) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  const rateLimited = await enforceEdgeRateLimit({
    admin: adminClient,
    req,
    functionName: "delete-technician-account",
    subject: subjectUserAndIp(user.id, req),
    cors,
  });
  if (rateLimited) return rateLimited;

  const { data: userRow, error: userRowErr } = await adminClient
    .from("users")
    .select("id, role, is_active, metadata")
    .eq("id", user.id)
    .maybeSingle();

  if (userRowErr) {
    return json({ ok: false, error: userRowErr.message }, 500);
  }
  if (!userRow || userRow.role !== "technician") {
    return json({ ok: false, error: "Only partner accounts can be deleted here." }, 403);
  }

  const { data: technician, error: technicianErr } = await adminClient
    .from("technicians")
    .select(TECHNICIAN_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (technicianErr) {
    return json({ ok: false, error: technicianErr.message }, 500);
  }

  if (technician?.id) {
    const { data: openBookings, error: bookingErr } = await adminClient
      .from("bookings")
      .select("id, actual_start")
      .eq("technician_id", technician.id)
      .in("status", [...OPEN_BOOKING_STATUSES]);

    if (bookingErr) {
      return json({ ok: false, error: bookingErr.message }, 500);
    }
    if ((openBookings?.length ?? 0) > 0) {
      const visitStarted = (openBookings ?? []).some((row) => Boolean(row.actual_start));
      return json(
        {
          ok: false,
          error: visitStarted
            ? "Finish the visit that has already started before you can delete your account."
            : openBookingReassignMessage(openBookings?.length ?? 0),
          code: visitStarted ? "visit_started" : "active_bookings",
        },
        409,
      );
    }
  }

  const docPaths = DOC_COLUMNS.map((column) => {
    const value = technician?.[column];
    return typeof value === "string" ? value.trim() : "";
  }).filter((path) => path.length > 0 && !path.startsWith("http"));

  const storageErr = await removeTechnicianDocuments(adminClient, user.id, docPaths);
  if (storageErr) {
    return json({ ok: false, error: storageErr }, 500);
  }

  if (technician?.id) {
    const detached = await detachTechnicianFromRecords(adminClient, technician.id);
    if (detached) return json({ ok: false, error: detached }, 500);
  }

  if (userRow.is_active === false) {
    const { error: alreadyDeletedErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (alreadyDeletedErr) {
      return json(
        {
          ok: false,
          error: alreadyDeletedErr.message ?? "Failed to remove sign-in credentials.",
          code: "auth_delete_failed",
        },
        500,
      );
    }
    return json({ ok: true, already_deleted: true });
  }

  const now = new Date().toISOString();

  if (technician?.id) {
    const priorTechnicianMeta =
      technician.metadata &&
      typeof technician.metadata === "object" &&
      !Array.isArray(technician.metadata)
        ? (technician.metadata as Record<string, unknown>)
        : {};

    const { error: scrubTechnicianErr } = await adminClient
      .from("technicians")
      .update({
        name_as_per_aadhaar: "Deleted technician",
        personal_phone: null,
        contact_email: null,
        date_of_birth: null,
        gender: null,
        father_guardian_name: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        aadhaar_last4: null,
        pan_number: null,
        doc_aadhaar_url: null,
        doc_pan_url: null,
        doc_bank_proof_url: null,
        doc_passport_url: null,
        doc_safety_certificate_url: null,
        bank_account_holder_name: null,
        bank_account_last4: null,
        bank_ifsc: null,
        home_base_address: null,
        preferred_work_locations: null,
        experience_summary: null,
        other_skills: null,
        safety_training_org: null,
        is_available: false,
        is_verified: false,
        metadata: {
          ...priorTechnicianMeta,
          deleted_at: now,
          deletion_source: "technician_app",
        },
      })
      .eq("id", technician.id);

    if (scrubTechnicianErr) {
      return json({ ok: false, error: scrubTechnicianErr.message }, 500);
    }
  }

  const priorMeta =
    userRow.metadata && typeof userRow.metadata === "object" && !Array.isArray(userRow.metadata)
      ? (userRow.metadata as Record<string, unknown>)
      : {};

  const { error: scrubUserErr } = await adminClient
    .from("users")
    .update({
      is_active: false,
      full_name: "Deleted user",
      phone: null,
      email: null,
      phone_verified_at: null,
      email_verified_at: null,
      metadata: {
        ...priorMeta,
        deleted_at: now,
        deletion_source: "technician_app",
      },
    })
    .eq("id", user.id);

  if (scrubUserErr) {
    return json({ ok: false, error: scrubUserErr.message }, 500);
  }

  const { error: authDelErr } = await adminClient.auth.admin.deleteUser(user.id);
  if (authDelErr) {
    return json(
      {
        ok: false,
        error: authDelErr.message ?? "Failed to remove sign-in credentials.",
        code: "auth_delete_failed",
      },
      500,
    );
  }

  return json({ ok: true });
});

function openBookingReassignMessage(count: number): string {
  const visits = count === 1 ? "this visit" : "these visits";
  const where = count === 1 ? "the visit" : "each visit";
  return `Ask your employer to move ${visits} to another technician. They open ${where} in the vendor portal and choose Change technician. Then you can delete your account.`;
}

type EdgeAdmin = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  storage: {
    from: (bucket: string) => {
      list: (
        path: string,
        options: { limit: number },
      ) => PromiseLike<{ data: { name: string }[] | null; error: { message: string } | null }>;
      remove: (paths: string[]) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

async function detachTechnicianFromRecords(
  adminClient: EdgeAdmin,
  technicianId: string,
): Promise<string | null> {
  const { error: bookingErr } = await adminClient
    .from("bookings")
    .update({ technician_id: null })
    .eq("technician_id", technicianId);
  if (bookingErr) return bookingErr.message;

  const { error: reportErr } = await adminClient
    .from("job_reports")
    .update({ technician_id: null })
    .eq("technician_id", technicianId);
  if (reportErr) return reportErr.message;

  const { error: activityErr } = await adminClient
    .from("technician_activity_events")
    .delete()
    .eq("technician_id", technicianId);
  if (activityErr) return activityErr.message;

  const { error: locationErr } = await adminClient
    .from("technician_locations")
    .delete()
    .eq("technician_id", technicianId);
  return locationErr?.message ?? null;
}

async function removeTechnicianDocuments(
  adminClient: EdgeAdmin,
  userId: string,
  storedPaths: string[],
): Promise<string | null> {
  const bucket = adminClient.storage.from(TECHNICIAN_DOCS_BUCKET);
  const paths = new Set<string>(storedPaths);

  const { data: listed, error: listErr } = await bucket.list(userId, { limit: 100 });
  if (listErr) return listErr.message;
  for (const file of listed ?? []) {
    if (file.name) paths.add(`${userId}/${file.name}`);
  }

  if (paths.size === 0) return null;
  const { error: removeErr } = await bucket.remove([...paths]);
  return removeErr?.message ?? null;
}
