/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Customer self-service account deletion (Apple / Play compliant).
 * Soft-anonymizes public.users + customers, cancels open AMCs, then auth.admin.deleteUser.
 */
import { corsHeaders as resolveCors } from "../_shared/cors.ts";

const ACTIVE_BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "vendor_acknowledged",
  "accepted",
  "in_progress",
] as const;

const ACTIVE_SUBSCRIPTION_STATUSES = ["trialing", "active", "paused", "past_due"] as const;

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

  const { data: userRow, error: userRowErr } = await adminClient
    .from("users")
    .select("id, role, is_active, metadata")
    .eq("id", user.id)
    .maybeSingle();

  if (userRowErr) {
    return json({ ok: false, error: userRowErr.message }, 500);
  }
  if (!userRow || userRow.role !== "customer") {
    return json({ ok: false, error: "Only customer accounts can be deleted here." }, 403);
  }
  if (userRow.is_active === false) {
    // Idempotent: still remove auth if a prior run left a session.
    await adminClient.auth.admin.deleteUser(user.id);
    return json({ ok: true, already_deleted: true });
  }

  const { data: customer, error: customerErr } = await adminClient
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (customerErr) {
    return json({ ok: false, error: customerErr.message }, 500);
  }

  if (customer?.id) {
    const { count: openBookings, error: bookingErr } = await adminClient
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id)
      .in("status", [...ACTIVE_BOOKING_STATUSES]);

    if (bookingErr) {
      return json({ ok: false, error: bookingErr.message }, 500);
    }
    if ((openBookings ?? 0) > 0) {
      return json(
        {
          ok: false,
          error:
            "You have an active or upcoming booking. Cancel or complete it before deleting your account.",
          code: "active_bookings",
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const { error: subErr } = await adminClient
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_reason: "customer_account_deleted",
      })
      .eq("customer_id", customer.id)
      .in("status", [...ACTIVE_SUBSCRIPTION_STATUSES]);

    if (subErr) {
      return json({ ok: false, error: subErr.message }, 500);
    }

    const { error: scrubCustomerErr } = await adminClient
      .from("customers")
      .update({
        display_name: "Deleted user",
        contact_email: null,
        alternate_phone: null,
        billing_address: null,
        service_default_address: null,
        notes: null,
        service_lat: null,
        service_lng: null,
        location_accuracy_m: null,
        location_recorded_at: null,
        safety_hazards: null,
        metadata: {
          deleted_at: now,
          deletion_source: "customer_app",
        },
      })
      .eq("id", customer.id);

    if (scrubCustomerErr) {
      return json({ ok: false, error: scrubCustomerErr.message }, 500);
    }
  }

  const priorMeta =
    userRow.metadata && typeof userRow.metadata === "object" && !Array.isArray(userRow.metadata)
      ? (userRow.metadata as Record<string, unknown>)
      : {};

  const deletedAt = new Date().toISOString();
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
        deleted_at: deletedAt,
        deletion_source: "customer_app",
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
