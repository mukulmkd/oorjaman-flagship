import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { isDummyAuthEmail } from "../auth/auth-api";
import { adminProcessNotificationQueue } from "../notifications/notification-events-api";
import { renewalNudgeTemplateContext } from "../notifications/notification-copy";
import { renderNotificationTemplate } from "../notifications/render-notification-template";
import { SupabaseApiError } from "../result";
import { readSubscriptionServiceAddressId } from "./subscription-address";

export const RENEWAL_NUDGE_EVENT_TYPE = "subscription_renewal_nudge" as const;

export type RenewalNudgeChannel = "email" | "sms" | "whatsapp";
export type RenewalNudgeAudience = "expiring_soon" | "lapsed";

export type SubscriptionRenewalNudgeCandidate = {
  subscription_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  plan_name: string;
  ends_at: string;
  renewal_audience: RenewalNudgeAudience;
  /** Days until contract end (0 if already ended). */
  days_to_expiry: number;
  /** Days since contract ended (0 if not yet ended). */
  days_since_expiry: number;
};

export type RenewalNudgeChannelSummary = {
  event_type: typeof RENEWAL_NUDGE_EVENT_TYPE;
  channels: Array<{
    channel: RenewalNudgeChannel;
    enabled_demo: boolean;
    enabled_live: boolean;
  }>;
};

export type RenewalNudgeQueueStats = {
  queued_renewal_count: number;
};

export type ScheduleAndSendRenewalNudgesResult = {
  scheduled: number;
  skipped: number;
  delivery: {
    ok: boolean;
    processed: number;
    sent: number;
    failed: number;
    queued: number;
  };
};

const DEFAULT_CHANNELS: RenewalNudgeChannel[] = ["email", "sms", "whatsapp"];

type SubRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "id" | "customer_id" | "plan_name" | "ends_at" | "status" | "service_address_id" | "metadata"
>;

async function hydrateRenewalCandidates(
  client: SupabaseClient<Database>,
  rows: SubRow[],
  audience: RenewalNudgeAudience,
): Promise<SubscriptionRenewalNudgeCandidate[]> {
  if (rows.length === 0) return [];
  const now = Date.now();

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, user_id, display_name, contact_email")
    .in("id", customerIds);
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c] as const));

  const userIds = [...new Set((customers ?? []).map((c) => c.user_id))];
  const { data: users, error: userErr } = await client
    .from("users")
    .select("id, email, phone")
    .in("id", userIds);
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userById = new Map((users ?? []).map((u) => [u.id, u] as const));

  return rows.map((s) => {
    const c = customerById.get(s.customer_id);
    const u = c ? userById.get(c.user_id) : null;
    const endMs = new Date(s.ends_at).getTime();
    const daysToExpiry = Math.max(0, Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)));
    const daysSinceExpiry = Math.max(0, Math.ceil((now - endMs) / (24 * 60 * 60 * 1000)));
    return {
      subscription_id: s.id,
      customer_id: s.customer_id,
      customer_name: c?.display_name ?? null,
      customer_email:
        c?.contact_email ?? (u?.email && !isDummyAuthEmail(u.email) ? u.email : null),
      customer_phone: u?.phone ?? null,
      plan_name: s.plan_name,
      ends_at: s.ends_at,
      renewal_audience: audience,
      days_to_expiry: audience === "expiring_soon" ? daysToExpiry : 0,
      days_since_expiry: audience === "lapsed" ? daysSinceExpiry : 0,
    };
  });
}

function addressKey(customerId: string, sub: SubRow): string {
  const addrId = readSubscriptionServiceAddressId(sub as Database["public"]["Tables"]["subscriptions"]["Row"]);
  return `${customerId}:${addrId ?? sub.id}`;
}

/** Active or trialing AMC ending within the next N days. */
export async function adminListSubscriptionRenewalNudgeCandidates(
  client: SupabaseClient<Database>,
  options?: { daysAhead?: number; limit?: number },
): Promise<SubscriptionRenewalNudgeCandidate[]> {
  const daysAhead = Math.max(1, Math.min(60, Math.round(Number(options?.daysAhead ?? 14))));
  const limit = Math.max(1, Math.min(500, Math.round(Number(options?.limit ?? 200))));
  const upperIso = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: subs, error: subErr } = await client
    .from("subscriptions")
    .select("id, customer_id, plan_name, ends_at, status, service_address_id, metadata")
    .in("status", ["active", "trialing"])
    .gte("ends_at", nowIso)
    .lte("ends_at", upperIso)
    .order("ends_at", { ascending: true })
    .limit(limit);
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);
  return hydrateRenewalCandidates(client, subs ?? [], "expiring_soon");
}

/**
 * Lapsed AMC: contract ended recently, no replacement active plan on the same service address.
 * Matches customer-app renewal prompts.
 */
export async function adminListLapsedSubscriptionRenewalNudgeCandidates(
  client: SupabaseClient<Database>,
  options?: { daysSinceEnded?: number; limit?: number },
): Promise<SubscriptionRenewalNudgeCandidate[]> {
  const daysSinceEnded = Math.max(1, Math.min(365, Math.round(Number(options?.daysSinceEnded ?? 90))));
  const limit = Math.max(1, Math.min(500, Math.round(Number(options?.limit ?? 300))));
  const nowIso = new Date().toISOString();
  const lowerIso = new Date(Date.now() - daysSinceEnded * 24 * 60 * 60 * 1000).toISOString();

  const { data: endedSubs, error: endErr } = await client
    .from("subscriptions")
    .select("id, customer_id, plan_name, ends_at, status, service_address_id, metadata")
    .lt("ends_at", nowIso)
    .gte("ends_at", lowerIso)
    .order("ends_at", { ascending: false })
    .limit(limit * 4);
  if (endErr) throw new SupabaseApiError(endErr.message, endErr);

  const ended = endedSubs ?? [];
  if (ended.length === 0) return [];

  const customerIds = [...new Set(ended.map((s) => s.customer_id))];
  const { data: activeSubs, error: actErr } = await client
    .from("subscriptions")
    .select("id, customer_id, plan_name, ends_at, status, service_address_id, metadata")
    .in("customer_id", customerIds)
    .in("status", ["active", "trialing"])
    .gte("ends_at", nowIso);
  if (actErr) throw new SupabaseApiError(actErr.message, actErr);

  const activeAddressKeys = new Set(
    (activeSubs ?? []).map((s) => addressKey(s.customer_id, s)),
  );

  const seen = new Set<string>();
  const picked: SubRow[] = [];
  for (const s of ended) {
    const key = addressKey(s.customer_id, s);
    if (activeAddressKeys.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(s);
    if (picked.length >= limit) break;
  }

  return hydrateRenewalCandidates(client, picked, "lapsed");
}

export async function adminResolveRenewalNudgeCandidatesByIds(
  client: SupabaseClient<Database>,
  subscriptionIds: string[],
  options?: { daysAhead?: number; daysSinceEnded?: number },
): Promise<SubscriptionRenewalNudgeCandidate[]> {
  const idSet = new Set(subscriptionIds.map((x) => x.trim()).filter(Boolean));
  if (idSet.size === 0) return [];

  const [expiring, lapsed] = await Promise.all([
    adminListSubscriptionRenewalNudgeCandidates(client, {
      daysAhead: options?.daysAhead ?? 60,
      limit: 500,
    }),
    adminListLapsedSubscriptionRenewalNudgeCandidates(client, {
      daysSinceEnded: options?.daysSinceEnded ?? 365,
      limit: 500,
    }),
  ]);

  const byId = new Map<string, SubscriptionRenewalNudgeCandidate>();
  for (const c of [...expiring, ...lapsed]) {
    if (idSet.has(c.subscription_id)) byId.set(c.subscription_id, c);
  }
  return subscriptionIds
    .map((id) => byId.get(id.trim()))
    .filter((c): c is SubscriptionRenewalNudgeCandidate => Boolean(c));
}

export async function adminGetRenewalNudgeChannelSummary(
  client: SupabaseClient<Database>,
): Promise<RenewalNudgeChannelSummary> {
  const { data, error } = await client
    .from("notification_channel_settings")
    .select("channel, enabled_demo, enabled_live")
    .eq("event_type", RENEWAL_NUDGE_EVENT_TYPE)
    .in("channel", DEFAULT_CHANNELS);
  if (error) throw new SupabaseApiError(error.message, error);

  const channels = DEFAULT_CHANNELS.map((channel) => {
    const row = (data ?? []).find((r) => r.channel === channel);
    return {
      channel,
      enabled_demo: row?.enabled_demo ?? true,
      enabled_live: row?.enabled_live ?? false,
    };
  });

  return { event_type: RENEWAL_NUDGE_EVENT_TYPE, channels };
}

export async function adminGetRenewalNudgeQueueStats(
  client: SupabaseClient<Database>,
): Promise<RenewalNudgeQueueStats> {
  const { count, error } = await client
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", RENEWAL_NUDGE_EVENT_TYPE)
    .eq("status", "queued");
  if (error) throw new SupabaseApiError(error.message, error);
  return { queued_renewal_count: count ?? 0 };
}

async function loadRecentlyNudgedSubscriptionIds(
  client: SupabaseClient<Database>,
  cooldownDays: number,
): Promise<Set<string>> {
  const cutoffIso = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows, error: recentErr } = await client
    .from("notification_events")
    .select("payload, created_at")
    .eq("event_type", RENEWAL_NUDGE_EVENT_TYPE)
    .gte("created_at", cutoffIso);
  if (recentErr) throw new SupabaseApiError(recentErr.message, recentErr);
  const recentlyNudgedIds = new Set<string>();
  for (const row of recentRows ?? []) {
    const payload = row.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const subId = (payload as Record<string, unknown>).subscription_id;
      if (typeof subId === "string" && subId.trim()) recentlyNudgedIds.add(subId.trim());
    }
  }
  return recentlyNudgedIds;
}

export async function adminQueueSubscriptionRenewalNudges(
  client: SupabaseClient<Database>,
  input: {
    subscriptionIds: string[];
    channels?: RenewalNudgeChannel[];
    cooldownDays?: number;
    daysAhead?: number;
    daysSinceEnded?: number;
  },
): Promise<number> {
  const channels = [...new Set(input.channels ?? DEFAULT_CHANNELS)].filter(Boolean);
  if (channels.length === 0) throw new SupabaseApiError("Select at least one channel.");

  const selected = await adminResolveRenewalNudgeCandidatesByIds(client, input.subscriptionIds, {
    daysAhead: input.daysAhead,
    daysSinceEnded: input.daysSinceEnded,
  });
  if (selected.length === 0) return 0;

  const cooldownDays = Math.max(0, Math.min(30, Math.round(Number(input.cooldownDays ?? 3))));
  const recentlyNudgedIds = await loadRecentlyNudgedSubscriptionIds(client, cooldownDays);
  const filtered = selected.filter((c) => !recentlyNudgedIds.has(c.subscription_id));
  if (filtered.length === 0) return 0;

  const rows: Database["public"]["Tables"]["notification_events"]["Insert"][] = filtered.map((c) => ({
    booking_id: null,
    recipient_vendor_id: null,
    event_type: RENEWAL_NUDGE_EVENT_TYPE,
    channels: channels as unknown as Json,
    status: "queued",
    payload: {
      subscription_id: c.subscription_id,
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      customer_phone: c.customer_phone,
      plan_name: c.plan_name,
      ends_at: c.ends_at,
      days_to_expiry: c.days_to_expiry,
      days_since_expiry: c.days_since_expiry,
      renewal_audience: c.renewal_audience,
      ...renewalNudgeTemplateContext({
        customer_name: c.customer_name,
        plan_name: c.plan_name,
        ends_at: c.ends_at,
        days_to_expiry: c.days_to_expiry,
        days_since_expiry: c.days_since_expiry,
        renewal_audience: c.renewal_audience,
      }),
    } as Json,
    attempt_count: 0,
    next_attempt_at: new Date().toISOString(),
    demo_mode: true,
  }));

  const { error } = await client.from("notification_events").insert(rows);
  if (error) throw new SupabaseApiError(error.message, error);
  return rows.length;
}

export async function adminPreviewSubscriptionRenewalNudge(
  client: SupabaseClient<Database>,
  input: { subscriptionId: string; channels?: RenewalNudgeChannel[] },
): Promise<Array<{ channel: RenewalNudgeChannel; subject: string | null; body: string }>> {
  const [candidate] = await adminResolveRenewalNudgeCandidatesByIds(client, [input.subscriptionId], {
    daysAhead: 60,
    daysSinceEnded: 365,
  });
  if (!candidate) throw new SupabaseApiError("Subscription not found in renewal lists.");

  const channels = [...new Set((input.channels ?? DEFAULT_CHANNELS).filter(Boolean))];
  const { data: templates, error } = await client
    .from("notification_templates")
    .select("channel, subject, body")
    .eq("event_type", RENEWAL_NUDGE_EVENT_TYPE)
    .eq("is_active", true)
    .in("channel", channels);
  if (error) throw new SupabaseApiError(error.message, error);

  const context = renewalNudgeTemplateContext({
    customer_name: candidate.customer_name,
    plan_name: candidate.plan_name,
    ends_at: candidate.ends_at,
    days_to_expiry: candidate.days_to_expiry,
    days_since_expiry: candidate.days_since_expiry,
    renewal_audience: candidate.renewal_audience,
  });

  const out: Array<{ channel: RenewalNudgeChannel; subject: string | null; body: string }> = [];
  for (const channel of channels) {
    const row = (templates ?? []).find((t) => t.channel === channel);
    if (!row) continue;
    out.push({
      channel: channel as RenewalNudgeChannel,
      subject: row.subject ? renderNotificationTemplate(row.subject, context) : null,
      body: renderNotificationTemplate(row.body, context),
    });
  }
  return out;
}

/** Schedule renewal reminders, then process only the renewal queue (not other notification types). */
export async function adminScheduleAndSendSubscriptionRenewalNudges(
  client: SupabaseClient<Database>,
  input: {
    subscriptionIds: string[];
    channels?: RenewalNudgeChannel[];
    cooldownDays?: number;
    daysAhead?: number;
    daysSinceEnded?: number;
    processLimit?: number;
  },
): Promise<ScheduleAndSendRenewalNudgesResult> {
  const requested = input.subscriptionIds.length;
  const scheduled = await adminQueueSubscriptionRenewalNudges(client, input);
  const skipped = Math.max(0, requested - scheduled);
  const delivery = await adminProcessNotificationQueue(client, {
    limit: input.processLimit ?? 80,
    eventType: RENEWAL_NUDGE_EVENT_TYPE,
  });
  return { scheduled, skipped, delivery };
}
