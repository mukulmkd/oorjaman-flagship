import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getMyCustomer } from "../customers/customer-api";
import { getMyTechnicianProfile } from "../technicians/technician-api";
import type {
  CustomerRow,
  Database,
  Json,
  SupportAgentRow,
  SupportConversationPriority,
  SupportConversationRow,
  SupportParticipantAudience,
  SupportConversationStatus,
  SupportMacroRow,
  SupportMessageAttachmentRow,
  SupportMessageRow,
  SupportResolutionTag,
  UserRow,
} from "../database.types";
import { formattedSiteAddressFromJson } from "../bookings/customer-booking-payload";
import { getServiceAddressEntry } from "../customers/service-address-book";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { syncUserDisplayNameFromSupportAgent } from "../users/user-display-name";
import {
  getSupportCategory,
  getSupportSubcategory,
  supportCategoryLabel,
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from "./support-catalog";
import {
  getTechnicianSupportCategory,
  getTechnicianSupportSubcategory,
  technicianSupportCategoryLabel,
  TECHNICIAN_SUPPORT_CATEGORIES,
} from "./support-catalog-technician";

export {
  SUPPORT_CATEGORIES,
  TECHNICIAN_SUPPORT_CATEGORIES,
  supportCategoryLabel,
  technicianSupportCategoryLabel,
  getSupportCategory,
  getSupportSubcategory,
  getTechnicianSupportCategory,
  getTechnicianSupportSubcategory,
};
export type { SupportCategory, SupportParticipantAudience };

export type SupportInboxAudienceFilter = SupportParticipantAudience | "all";

export type CreateSupportConversationInput = {
  category_slug: string;
  subcategory_slug: string;
  details_text: string;
  booking_id?: string | null;
  subscription_id?: string | null;
  service_address_id?: string | null;
};

export function listSupportCatalog(audience: SupportParticipantAudience = "customer"): SupportCategory[] {
  return audience === "technician" ? TECHNICIAN_SUPPORT_CATEGORIES : SUPPORT_CATEGORIES;
}

export async function createSupportConversationAsCustomer(
  client: SupabaseClient<Database>,
  input: CreateSupportConversationInput,
): Promise<SupportConversationRow> {
  const customer = await getMyCustomer(client);
  if (!customer) {
    throw new SupabaseApiError("Customer profile required - sign in again.");
  }

  const category = getSupportCategory(input.category_slug.trim());
  const sub = getSupportSubcategory(input.category_slug.trim(), input.subcategory_slug.trim());
  if (!category || !sub) {
    throw new SupabaseApiError("Choose a valid help category.");
  }

  const details = input.details_text.trim();
  if (details.length < 10) {
    throw new SupabaseApiError("Please describe your issue in at least 10 characters.");
  }

  const subject = supportCategoryLabel(category.slug, sub.slug);

  const { data: convRow, error: convErr } = await client
    .from("support_conversations")
    .insert({
      participant_audience: "customer",
      customer_id: customer.id,
      category_slug: category.slug,
      subcategory_slug: sub.slug,
      status: "queued",
      subject,
      details_text: details,
      booking_id: input.booking_id?.trim() || null,
      subscription_id: input.subscription_id?.trim() || null,
      service_address_id: input.service_address_id?.trim() || null,
    })
    .select()
    .single();
  if (convErr) throw new SupabaseApiError(convErr.message, convErr);
  const conversation = takeSingleRow(convRow, convErr);

  const intakeMessages: { sender_role: "customer"; body: string; metadata?: Json }[] = [
    {
      sender_role: "customer",
      body: category.label,
      metadata: { intake_step: "category", category_slug: category.slug } as Json,
    },
    {
      sender_role: "customer",
      body: sub.label,
      metadata: { intake_step: "subcategory", subcategory_slug: sub.slug } as Json,
    },
    {
      sender_role: "customer",
      body: details,
      metadata: { intake_step: "details" } as Json,
    },
  ];

  const { error: msgErr } = await client.from("support_messages").insert(
    intakeMessages.map((m) => ({
      conversation_id: conversation.id,
      sender_role: m.sender_role,
      body: m.body,
      metadata: m.metadata ?? {},
    })),
  );
  if (msgErr) throw new SupabaseApiError(msgErr.message, msgErr);

  return conversation;
}

const INACTIVITY_CLOSE_MS = 30 * 60 * 1000;

/** Closes queued/active chats with no customer message in 30+ minutes (DB RPC + system message). */
export async function closeInactiveSupportChatsForCustomer(
  client: SupabaseClient<Database>,
): Promise<number> {
  const customer = await getMyCustomer(client);
  if (!customer) return 0;

  const { data, error } = await client.rpc("close_inactive_support_chats_for_customer", {
    p_customer_id: customer.id,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return typeof data === "number" ? data : 0;
}

export function isSupportConversationOpen(conv: SupportConversationRow): boolean {
  return conv.status === "queued" || conv.status === "active";
}

export function supportParticipantLastMessageAt(conv: SupportConversationRow): string {
  if (conv.participant_audience === "technician") {
    return conv.last_technician_message_at ?? conv.created_at;
  }
  return conv.last_customer_message_at ?? conv.created_at;
}

export function supportConversationInactiveMs(conv: SupportConversationRow, nowMs = Date.now()): number {
  return nowMs - new Date(supportParticipantLastMessageAt(conv)).getTime();
}

export function shouldTreatSupportConversationAsInactive(
  conv: SupportConversationRow,
  nowMs = Date.now(),
): boolean {
  if (!isSupportConversationOpen(conv)) return false;
  return supportConversationInactiveMs(conv, nowMs) >= INACTIVITY_CLOSE_MS;
}

export async function listActiveSupportConversationsForCustomer(
  client: SupabaseClient<Database>,
): Promise<SupportConversationRow[]> {
  await closeInactiveSupportChatsForCustomer(client);
  const rows = await listMySupportConversations(client, { limit: 20 });
  return rows.filter(
    (r) => isSupportConversationOpen(r) && !shouldTreatSupportConversationAsInactive(r),
  );
}

export async function getOpenSupportConversationForCustomer(
  client: SupabaseClient<Database>,
): Promise<SupportConversationRow | null> {
  const active = await listActiveSupportConversationsForCustomer(client);
  return active[0] ?? null;
}

export async function listMySupportConversations(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<SupportConversationRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const { data, error } = await client
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(limit);
  return takeRows(data, error);
}

export async function getSupportConversationById(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationRow> {
  const { data, error } = await client
    .from("support_conversations")
    .select("*")
    .eq("id", conversationId.trim())
    .single();
  return takeSingleRow(data, error);
}

export async function listSupportMessages(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportMessageRow[]> {
  const { data, error } = await client
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId.trim())
    .neq("sender_role", "internal")
    .order("created_at", { ascending: true });
  return takeRows(data, error);
}

/** Support desk thread (includes internal notes). */
export async function listSupportMessagesForDesk(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportMessageRow[]> {
  const { data, error } = await client
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId.trim())
    .order("created_at", { ascending: true });
  return takeRows(data, error);
}

export async function sendSupportMessageAsCustomer(
  client: SupabaseClient<Database>,
  params: { conversation_id: string; body: string },
): Promise<SupportMessageRow> {
  const body = params.body.trim();
  if (!body) throw new SupabaseApiError("Message cannot be empty.");

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to send a message.");
  }

  const { data, error } = await client
    .from("support_messages")
    .insert({
      conversation_id: params.conversation_id.trim(),
      sender_user_id: userData.user.id,
      sender_role: "customer",
      body,
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function sendSupportMessageAsAdmin(
  client: SupabaseClient<Database>,
  params: { conversation_id: string; body: string },
): Promise<SupportMessageRow> {
  const body = params.body.trim();
  if (!body) throw new SupabaseApiError("Message cannot be empty.");

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to send a message.");
  }

  const convId = params.conversation_id.trim();
  const conv = await getSupportConversationById(client, convId);

  if (!conv.assigned_admin_user_id) {
    const nextStatus: SupportConversationStatus =
      conv.status === "queued" || conv.status === "intake" ? "active" : conv.status;
    const { error: assignErr } = await client
      .from("support_conversations")
      .update({
        assigned_admin_user_id: userData.user.id,
        status: nextStatus,
      })
      .eq("id", convId);
    if (assignErr) throw new SupabaseApiError(assignErr.message, assignErr);
  }

  const { data, error } = await client
    .from("support_messages")
    .insert({
      conversation_id: convId,
      sender_user_id: userData.user.id,
      sender_role: "admin",
      body,
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

export function subscribeSupportMessages(
  client: SupabaseClient<Database>,
  conversationId: string,
  onChange: () => void,
): RealtimeChannel {
  const topic = `support-messages:${conversationId}:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return channel;
}

/** Live updates when assignment, status, or CSAT fields change. */
export function subscribeSupportConversation(
  client: SupabaseClient<Database>,
  conversationId: string,
  onChange: () => void,
): RealtimeChannel {
  const topic = `support-conversation:${conversationId}:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "support_conversations",
        filter: `id=eq.${conversationId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return channel;
}

export function unsubscribeSupportChannel(
  client: SupabaseClient<Database>,
  channel: RealtimeChannel,
): void {
  void client.removeChannel(channel);
}

/** All support message inserts visible to this customer (RLS-scoped). */
export function subscribeSupportMessagesForCustomer(
  client: SupabaseClient<Database>,
  onInsert: (message: SupportMessageRow) => void,
): RealtimeChannel {
  const topic = `support-messages-customer:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
      },
      (payload) => {
        const row = payload.new as SupportMessageRow | null;
        if (row?.id) onInsert(row);
      },
    )
    .subscribe();
  return channel;
}

export async function countUnreadSupportMessagesForCustomer(
  client: SupabaseClient<Database>,
): Promise<number> {
  const { data, error } = await client.rpc("count_unread_support_messages_for_customer");
  if (error) throw new SupabaseApiError(error.message, error);
  const n = typeof data === "number" ? data : Number(data ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export async function markSupportConversationReadByCustomer(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationRow> {
  const { data, error } = await client.rpc("mark_support_conversation_read_by_customer", {
    p_conversation_id: conversationId.trim(),
  });
  return takeSingleRow(data, error);
}

export type CreateTechnicianSupportConversationInput = CreateSupportConversationInput;

export async function createSupportConversationAsTechnician(
  client: SupabaseClient<Database>,
  input: CreateTechnicianSupportConversationInput,
): Promise<SupportConversationRow> {
  const technician = await getMyTechnicianProfile(client);
  if (!technician) {
    throw new SupabaseApiError("Technician profile required - sign in again.");
  }

  const category = getTechnicianSupportCategory(input.category_slug.trim());
  const sub = getTechnicianSupportSubcategory(input.category_slug.trim(), input.subcategory_slug.trim());
  if (!category || !sub) {
    throw new SupabaseApiError("Choose a valid help category.");
  }

  const details = input.details_text.trim();
  if (details.length < 10) {
    throw new SupabaseApiError("Please describe your issue in at least 10 characters.");
  }

  const subject = technicianSupportCategoryLabel(category.slug, sub.slug);

  const { data: convRow, error: convErr } = await client
    .from("support_conversations")
    .insert({
      participant_audience: "technician",
      technician_id: technician.id,
      category_slug: category.slug,
      subcategory_slug: sub.slug,
      status: "queued",
      subject,
      details_text: details,
      booking_id: input.booking_id?.trim() || null,
    })
    .select()
    .single();
  if (convErr) throw new SupabaseApiError(convErr.message, convErr);
  const conversation = takeSingleRow(convRow, convErr);

  const intakeMessages: { sender_role: "technician"; body: string; metadata?: Json }[] = [
    {
      sender_role: "technician",
      body: category.label,
      metadata: { intake_step: "category", category_slug: category.slug } as Json,
    },
    {
      sender_role: "technician",
      body: sub.label,
      metadata: { intake_step: "subcategory", subcategory_slug: sub.slug } as Json,
    },
    {
      sender_role: "technician",
      body: details,
      metadata: { intake_step: "details" } as Json,
    },
  ];

  const { error: msgErr } = await client.from("support_messages").insert(
    intakeMessages.map((m) => ({
      conversation_id: conversation.id,
      sender_role: m.sender_role,
      body: m.body,
      metadata: m.metadata ?? {},
    })),
  );
  if (msgErr) throw new SupabaseApiError(msgErr.message, msgErr);

  return conversation;
}

export async function closeInactiveSupportChatsForTechnician(
  client: SupabaseClient<Database>,
): Promise<number> {
  const technician = await getMyTechnicianProfile(client);
  if (!technician) return 0;

  const { data, error } = await client.rpc("close_inactive_support_chats_for_technician", {
    p_technician_id: technician.id,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return typeof data === "number" ? data : 0;
}

export async function listActiveSupportConversationsForTechnician(
  client: SupabaseClient<Database>,
): Promise<SupportConversationRow[]> {
  await closeInactiveSupportChatsForTechnician(client);
  const rows = await listMySupportConversations(client, { limit: 20 });
  return rows.filter(
    (r) =>
      r.participant_audience === "technician" &&
      isSupportConversationOpen(r) &&
      !shouldTreatSupportConversationAsInactive(r),
  );
}

export async function getOpenSupportConversationForTechnician(
  client: SupabaseClient<Database>,
): Promise<SupportConversationRow | null> {
  const active = await listActiveSupportConversationsForTechnician(client);
  return active[0] ?? null;
}

export async function sendSupportMessageAsTechnician(
  client: SupabaseClient<Database>,
  params: { conversation_id: string; body: string },
): Promise<SupportMessageRow> {
  const body = params.body.trim();
  if (!body) throw new SupabaseApiError("Message cannot be empty.");

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to send a message.");
  }

  const { data, error } = await client
    .from("support_messages")
    .insert({
      conversation_id: params.conversation_id.trim(),
      sender_user_id: userData.user.id,
      sender_role: "technician",
      body,
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

export function subscribeSupportMessagesForTechnician(
  client: SupabaseClient<Database>,
  onInsert: (message: SupportMessageRow) => void,
): RealtimeChannel {
  const topic = `support-messages-technician:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
      },
      (payload) => {
        const row = payload.new as SupportMessageRow | null;
        if (row?.id) onInsert(row);
      },
    )
    .subscribe();
  return channel;
}

export async function countUnreadSupportMessagesForTechnician(
  client: SupabaseClient<Database>,
): Promise<number> {
  const { data, error } = await client.rpc("count_unread_support_messages_for_technician");
  if (error) throw new SupabaseApiError(error.message, error);
  const n = typeof data === "number" ? data : Number(data ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export async function markSupportConversationReadByTechnician(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationRow> {
  const { data, error } = await client.rpc("mark_support_conversation_read_by_technician", {
    p_conversation_id: conversationId.trim(),
  });
  return takeSingleRow(data, error);
}

/** Admin inbox: open and active conversations, newest first. */
export type SupportConversationWithParticipant = SupportConversationRow & {
  customer: { display_name: string | null; contact_email: string | null; alternate_phone: string | null } | null;
  technician: {
    display_name: string | null;
    contact_email: string | null;
    personal_phone: string | null;
    employee_code: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
  } | null;
};

function supportDeskVendorDisplayName(vendor: {
  trade_name: string | null;
  business_name: string | null;
}): string | null {
  return vendor.trade_name?.trim() || vendor.business_name?.trim() || null;
}

/** @deprecated Use {@link SupportConversationWithParticipant} */
export type SupportConversationWithCustomer = SupportConversationWithParticipant;

export function isTechnicianSupportConversation(
  conversation: Pick<SupportConversationRow, "participant_audience"> &
    Partial<Pick<SupportConversationRow, "technician_id">>,
): boolean {
  return conversation.participant_audience === "technician" || Boolean(conversation.technician_id);
}

export function supportParticipantDisplayName(
  conversation: Pick<SupportConversationWithParticipant, "participant_audience" | "customer" | "technician">,
): string {
  if (isTechnicianSupportConversation(conversation)) {
    return conversation.technician?.display_name?.trim() || "Technician";
  }
  return conversation.customer?.display_name?.trim() || "Customer";
}

export function supportParticipantAudienceLabel(audience: SupportParticipantAudience): string {
  return audience === "technician" ? "Technician" : "Customer";
}

export async function listSupportConversationsForAdmin(
  client: SupabaseClient<Database>,
  options?: { status?: SupportConversationStatus | SupportConversationStatus[]; limit?: number },
): Promise<SupportConversationRow[]> {
  let q = client.from("support_conversations").select("*").order("last_message_at", { ascending: false });

  if (options?.status) {
    const st = Array.isArray(options.status) ? options.status : [options.status];
    q = q.in("status", st);
  } else {
    q = q.in("status", ["queued", "active"]);
  }

  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  q = q.limit(limit);

  const { data, error } = await q;
  return takeRows(data, error);
}

async function attachParticipantsToSupportConversations(
  client: SupabaseClient<Database>,
  rows: SupportConversationRow[],
): Promise<SupportConversationWithParticipant[]> {
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const technicianIds = [...new Set(rows.map((r) => r.technician_id).filter(Boolean))] as string[];

  const customerById = new Map<
    string,
    { display_name: string | null; contact_email: string | null; alternate_phone: string | null }
  >();
  if (customerIds.length > 0) {
    const { data: customers, error: custErr } = await client
      .from("customers")
      .select("id, display_name, contact_email, alternate_phone")
      .in("id", customerIds);
    if (custErr) throw new SupabaseApiError(custErr.message, custErr);
    for (const c of customers ?? []) customerById.set(c.id, c);
  }

  const technicianById = new Map<
    string,
    {
      display_name: string | null;
      contact_email: string | null;
      personal_phone: string | null;
      employee_code: string | null;
      vendor_id: string | null;
      vendor_name: string | null;
    }
  >();
  if (technicianIds.length > 0) {
    const { data: technicians, error: techErr } = await client
      .from("technicians")
      .select("id, name_as_per_aadhaar, contact_email, personal_phone, employee_code, vendor_id")
      .in("id", technicianIds);
    if (techErr) throw new SupabaseApiError(techErr.message, techErr);

    const vendorIds = [
      ...new Set((technicians ?? []).map((t) => t.vendor_id).filter((id): id is string => Boolean(id))),
    ];
    const vendorNameById = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vendors, error: vendorErr } = await client
        .from("vendors")
        .select("id, business_name, trade_name")
        .in("id", vendorIds);
      if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
      for (const v of vendors ?? []) {
        const name = supportDeskVendorDisplayName(v);
        if (name) vendorNameById.set(v.id, name);
      }
    }

    for (const t of technicians ?? []) {
      technicianById.set(t.id, {
        display_name: t.name_as_per_aadhaar,
        contact_email: t.contact_email,
        personal_phone: t.personal_phone,
        employee_code: t.employee_code,
        vendor_id: t.vendor_id,
        vendor_name: t.vendor_id ? (vendorNameById.get(t.vendor_id) ?? null) : null,
      });
    }
  }

  return rows.map((row) => ({
    ...row,
    customer: row.customer_id ? (customerById.get(row.customer_id) ?? null) : null,
    technician: row.technician_id ? (technicianById.get(row.technician_id) ?? null) : null,
  }));
}

export async function listSupportConversationsForAdminWithCustomer(
  client: SupabaseClient<Database>,
  options?: { status?: SupportConversationStatus | SupportConversationStatus[]; limit?: number },
): Promise<SupportConversationWithCustomer[]> {
  const rows = await listSupportConversationsForAdmin(client, options);
  return attachParticipantsToSupportConversations(client, rows);
}

export async function getSupportConversationForDeskWithParticipant(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationWithParticipant> {
  const row = await getSupportConversationById(client, conversationId);
  const [withParticipant] = await attachParticipantsToSupportConversations(client, [row]);
  if (!withParticipant) throw new SupabaseApiError("Conversation not found.");
  return withParticipant;
}

/** @deprecated Use {@link getSupportConversationForDeskWithParticipant} */
export async function getSupportConversationForDeskWithCustomer(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationWithParticipant> {
  return getSupportConversationForDeskWithParticipant(client, conversationId);
}

export type SupportInboxFilter = "queued" | "mine" | "open" | "unassigned" | "resolved";

/** Support desk inbox queues (support-web). */
export async function listSupportInboxForDesk(
  client: SupabaseClient<Database>,
  filter: SupportInboxFilter,
  options?: {
    agentUserId?: string | null;
    limit?: number;
    audience?: SupportInboxAudienceFilter;
  },
): Promise<SupportConversationWithParticipant[]> {
  const limit = Math.min(Math.max(options?.limit ?? 120, 1), 200);
  const agentUserId = options?.agentUserId ?? null;
  const audience = options?.audience ?? "all";

  let q = client.from("support_conversations").select("*");

  if (audience !== "all") {
    q = q.eq("participant_audience", audience);
  }

  switch (filter) {
    case "queued":
      q = q.eq("status", "queued").order("created_at", { ascending: true });
      break;
    case "mine":
      if (!agentUserId) return [];
      q = q
        .eq("assigned_admin_user_id", agentUserId)
        .in("status", ["queued", "active"])
        .order("last_message_at", { ascending: false });
      break;
    case "open":
      q = q.in("status", ["queued", "active"]).order("last_message_at", { ascending: false });
      break;
    case "unassigned":
      q = q
        .in("status", ["queued", "active"])
        .is("assigned_admin_user_id", null)
        .order("created_at", { ascending: true });
      break;
    case "resolved": {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      q = q
        .eq("status", "resolved")
        .gte("updated_at", since)
        .order("last_message_at", { ascending: false });
      break;
    }
  }

  const { data, error } = await q.limit(limit);
  const rows = takeRows(data, error);
  return attachParticipantsToSupportConversations(client, rows);
}

export type SupportConversationContext = {
  booking: {
    id: string;
    reference_code: string | null;
    status: string;
    scheduled_start: string;
    vendor_id: string | null;
  } | null;
  subscription: {
    id: string;
    plan_name: string;
    ends_at: string;
    status: string;
  } | null;
};

export async function getSupportConversationContext(
  client: SupabaseClient<Database>,
  conversation: Pick<SupportConversationRow, "booking_id" | "subscription_id">,
): Promise<SupportConversationContext> {
  let booking: SupportConversationContext["booking"] = null;
  let subscription: SupportConversationContext["subscription"] = null;

  if (conversation.booking_id) {
    const { data, error } = await client
      .from("bookings")
      .select("id, reference_code, status, scheduled_start, vendor_id")
      .eq("id", conversation.booking_id)
      .maybeSingle();
    if (error) throw new SupabaseApiError(error.message, error);
    if (data) booking = data;
  }

  if (conversation.subscription_id) {
    const { data, error } = await client
      .from("subscriptions")
      .select("id, plan_name, ends_at, status")
      .eq("id", conversation.subscription_id)
      .maybeSingle();
    if (error) throw new SupabaseApiError(error.message, error);
    if (data) subscription = data;
  }

  return { booking, subscription };
}

export function subscribeSupportInbox(
  client: SupabaseClient<Database>,
  onChange: () => void,
): RealtimeChannel {
  return subscribeSupportDeskRealtime(client, { onAnyChange: onChange });
}

export type SupportDeskRealtimeHandlers = {
  onReady?: () => void;
  onAnyChange?: () => void;
  onConversationInserted?: (row: SupportConversationRow) => void;
  onCustomerMessageInserted?: (message: SupportMessageRow) => void;
  onTechnicianMessageInserted?: (message: SupportMessageRow) => void;
  onParticipantMessageInserted?: (message: SupportMessageRow) => void;
};

/** Support desk: new chats and customer messages (all support-web routes). */
export function subscribeSupportDeskRealtime(
  client: SupabaseClient<Database>,
  handlers: SupportDeskRealtimeHandlers,
): RealtimeChannel {
  const topic = `support-desk:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const channel = client
    .channel(topic)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "support_conversations" },
      (payload) => {
        handlers.onAnyChange?.();
        const row = payload.new as SupportConversationRow | null;
        if (row?.id) handlers.onConversationInserted?.(row);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "support_conversations" },
      () => handlers.onAnyChange?.(),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "support_messages" },
      (payload) => {
        handlers.onAnyChange?.();
        const row = payload.new as SupportMessageRow | null;
        if (!row?.id) return;
        if (row.sender_role === "customer") {
          handlers.onCustomerMessageInserted?.(row);
        }
        if (row.sender_role === "technician") {
          handlers.onTechnicianMessageInserted?.(row);
        }
        if (row.sender_role === "customer" || row.sender_role === "technician") {
          handlers.onParticipantMessageInserted?.(row);
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setTimeout(() => handlers.onReady?.(), 400);
      }
    });
  return channel;
}

export async function adminResolveSupportConversation(
  client: SupabaseClient<Database>,
  conversationId: string,
  options?: { resolution_tag?: SupportResolutionTag; escalation_note?: string },
): Promise<SupportConversationRow> {
  const tag = options?.resolution_tag ?? "resolved";
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to resolve this chat.");
  }

  const resolvedAt = new Date().toISOString();
  const { data, error } = await client
    .from("support_conversations")
    .update({
      status: "resolved",
      close_reason: "resolved_by_admin",
      resolution_tag: tag,
      resolved_at: resolvedAt,
      resolved_by_user_id: userData.user.id,
    })
    .eq("id", conversationId.trim())
    .select()
    .single();
  const row = takeSingleRow(data, error);

  const { logSupportConversationEvent } = await import("./support-audit");
  const { supportResolutionTagLabel } = await import("./support-desk-labels");
  const actorName = await import("./support-audit-helpers").then((m) =>
    m.supportAgentPublicNameFromUserId(client, userData.user!.id),
  );
  await logSupportConversationEvent(client, {
    conversation_id: row.id,
    event_type: "resolved",
    actor_role: "desk",
    actor_user_id: userData.user.id,
    summary: `${actorName} marked this chat resolved (${supportResolutionTagLabel(tag)})`,
    metadata: { resolution_tag: tag, resolved_at: resolvedAt },
  });

  await client.from("support_messages").insert({
    conversation_id: row.id,
    sender_user_id: userData.user.id,
    sender_role: "admin",
    body: "This conversation was marked resolved. You can rate your experience below or start a new chat anytime.",
  });

  return row;
}

export async function adminReopenSupportConversation(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to reopen this chat.");
  }

  const { data, error } = await client
    .from("support_conversations")
    .update({ status: "active", close_reason: null })
    .eq("id", conversationId.trim())
    .select()
    .single();
  const row = takeSingleRow(data, error);

  const { logSupportConversationEvent } = await import("./support-audit");
  const actorName = await import("./support-audit-helpers").then((m) =>
    m.supportAgentPublicNameFromUserId(client, userData.user!.id),
  );
  await logSupportConversationEvent(client, {
    conversation_id: row.id,
    event_type: "reopened",
    actor_role: "desk",
    actor_user_id: userData.user.id,
    summary: `${actorName} reopened this chat`,
  });

  return row;
}

export type SupportDeskCustomerContext = SupportConversationContext & {
  service_address: {
    id: string;
    label: string;
    formatted: string;
    photo_count: number;
  } | null;
  recent_bookings: {
    id: string;
    reference_code: string | null;
    status: string;
    scheduled_start: string;
    vendor_id: string | null;
  }[];
  active_subscriptions: {
    id: string;
    plan_name: string;
    status: string;
    ends_at: string;
  }[];
  recent_resolved: {
    id: string;
    subject: string | null;
    category_slug: string;
    updated_at: string;
  }[];
};

export async function getSupportDeskCustomerContext(
  client: SupabaseClient<Database>,
  conversation: Pick<
    SupportConversationRow,
    "id" | "customer_id" | "booking_id" | "subscription_id" | "service_address_id"
  >,
): Promise<SupportDeskCustomerContext> {
  const base = await getSupportConversationContext(client, conversation);

  if (!conversation.customer_id) {
    return {
      ...base,
      service_address: null,
      recent_bookings: [],
      active_subscriptions: [],
      recent_resolved: [],
    };
  }

  const { data: customer, error: custErr } = await client
    .from("customers")
    .select("*")
    .eq("id", conversation.customer_id)
    .maybeSingle();
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);

  let service_address: SupportDeskCustomerContext["service_address"] = null;
  if (customer && conversation.service_address_id?.trim()) {
    const entry = getServiceAddressEntry(customer, conversation.service_address_id.trim());
    if (entry) {
      service_address = {
        id: entry.id,
        label: entry.label,
        formatted: formattedSiteAddressFromJson(entry.address),
        photo_count: entry.site_photos?.length ?? 0,
      };
    }
  }

  const { data: bookings, error: bookErr } = await client
    .from("bookings")
    .select("id, reference_code, status, scheduled_start, vendor_id")
    .eq("customer_id", conversation.customer_id)
    .order("scheduled_start", { ascending: false })
    .limit(5);
  if (bookErr) throw new SupabaseApiError(bookErr.message, bookErr);

  const { data: subs, error: subErr } = await client
    .from("subscriptions")
    .select("id, plan_name, status, ends_at")
    .eq("customer_id", conversation.customer_id)
    .in("status", ["active", "trialing", "paused", "past_due"])
    .order("ends_at", { ascending: false })
    .limit(5);
  if (subErr) throw new SupabaseApiError(subErr.message, subErr);

  const { data: resolved, error: resErr } = await client
    .from("support_conversations")
    .select("id, subject, category_slug, updated_at")
    .eq("customer_id", conversation.customer_id)
    .eq("status", "resolved")
    .neq("id", conversation.id)
    .order("updated_at", { ascending: false })
    .limit(3);
  if (resErr) throw new SupabaseApiError(resErr.message, resErr);

  return {
    ...base,
    service_address,
    recent_bookings: bookings ?? [],
    active_subscriptions: subs ?? [],
    recent_resolved: resolved ?? [],
  };
}

export type SupportDeskTechnicianContextProfile = {
  verification_status: string;
  is_verified: boolean;
  is_available: boolean;
  vendor_review_status: "pending" | "approved" | "rejected" | null;
  skills: string[];
  years_experience: number | null;
};

export type SupportDeskTechnicianContact = {
  display_name: string | null;
  contact_email: string | null;
  personal_phone: string | null;
  employee_code: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
};

export type SupportDeskTechnicianContext = SupportConversationContext & {
  technician_contact: SupportDeskTechnicianContact | null;
  technician_profile: SupportDeskTechnicianContextProfile | null;
  vendor: { id: string; name: string | null } | null;
  recent_jobs: {
    id: string;
    reference_code: string | null;
    status: string;
    scheduled_start: string;
    customer_id: string | null;
    customer_display_name: string | null;
  }[];
  recent_resolved: {
    id: string;
    subject: string | null;
    category_slug: string;
    updated_at: string;
  }[];
};

export async function getSupportDeskTechnicianContext(
  client: SupabaseClient<Database>,
  conversation: Pick<SupportConversationRow, "id" | "technician_id" | "booking_id">,
): Promise<SupportDeskTechnicianContext> {
  const base = await getSupportConversationContext(client, {
    booking_id: conversation.booking_id,
    subscription_id: null,
  });

  if (!conversation.technician_id) {
    return {
      ...base,
      technician_contact: null,
      technician_profile: null,
      vendor: null,
      recent_jobs: [],
      recent_resolved: [],
    };
  }

  const { data: technician, error: techErr } = await client
    .from("technicians")
    .select(
      "id, vendor_id, name_as_per_aadhaar, contact_email, personal_phone, employee_code, verification_status, is_verified, is_available, vendor_review_status, skills, years_experience",
    )
    .eq("id", conversation.technician_id)
    .maybeSingle();
  if (techErr) throw new SupabaseApiError(techErr.message, techErr);

  const technician_contact: SupportDeskTechnicianContact | null = technician
    ? {
        display_name: technician.name_as_per_aadhaar,
        contact_email: technician.contact_email,
        personal_phone: technician.personal_phone,
        employee_code: technician.employee_code,
        vendor_id: technician.vendor_id,
        vendor_name: null,
      }
    : null;

  const technician_profile: SupportDeskTechnicianContextProfile | null = technician
    ? {
        verification_status: technician.verification_status,
        is_verified: technician.is_verified,
        is_available: technician.is_available,
        vendor_review_status: technician.vendor_review_status,
        skills: technician.skills ?? [],
        years_experience: technician.years_experience,
      }
    : null;

  let vendor: SupportDeskTechnicianContext["vendor"] = null;
  if (technician?.vendor_id) {
    const { data: v, error: vErr } = await client
      .from("vendors")
      .select("id, business_name, trade_name")
      .eq("id", technician.vendor_id)
      .maybeSingle();
    if (vErr) throw new SupabaseApiError(vErr.message, vErr);
    if (v) {
      vendor = { id: v.id, name: supportDeskVendorDisplayName(v) };
      if (technician_contact) {
        technician_contact.vendor_name = vendor.name;
      }
    }
  }

  const { data: jobs, error: jobErr } = await client
    .from("bookings")
    .select("id, reference_code, status, scheduled_start, customer_id")
    .eq("technician_id", conversation.technician_id)
    .order("scheduled_start", { ascending: false })
    .limit(5);
  if (jobErr) throw new SupabaseApiError(jobErr.message, jobErr);

  const customerIds = [
    ...new Set((jobs ?? []).map((j) => j.customer_id).filter((id): id is string => Boolean(id))),
  ];
  const customerNameById = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers, error: custErr } = await client
      .from("customers")
      .select("id, display_name")
      .in("id", customerIds);
    if (custErr) throw new SupabaseApiError(custErr.message, custErr);
    for (const c of customers ?? []) {
      const label = c.display_name?.trim();
      if (label) customerNameById.set(c.id, label);
    }
  }

  const recent_jobs = (jobs ?? []).map((job) => ({
    ...job,
    customer_display_name: job.customer_id ? (customerNameById.get(job.customer_id) ?? null) : null,
  }));

  const { data: resolved, error: resErr } = await client
    .from("support_conversations")
    .select("id, subject, category_slug, updated_at")
    .eq("technician_id", conversation.technician_id)
    .eq("participant_audience", "technician")
    .eq("status", "resolved")
    .neq("id", conversation.id)
    .order("updated_at", { ascending: false })
    .limit(3);
  if (resErr) throw new SupabaseApiError(resErr.message, resErr);

  return {
    ...base,
    technician_contact,
    technician_profile,
    vendor,
    recent_jobs,
    recent_resolved: resolved ?? [],
  };
}

export async function getSupportDeskContextForConversation(
  client: SupabaseClient<Database>,
  conversation: SupportConversationRow,
): Promise<SupportDeskCustomerContext | SupportDeskTechnicianContext> {
  if (isTechnicianSupportConversation(conversation)) {
    return getSupportDeskTechnicianContext(client, conversation);
  }
  return getSupportDeskCustomerContext(client, conversation);
}

export type SupportSlaHints = {
  wait_minutes: number | null;
  needs_first_reply: boolean;
  customer_waiting_reply: boolean;
};

export function computeSupportSlaHints(
  conv: Pick<
    SupportConversationRow,
    "status" | "created_at" | "last_message_at" | "last_customer_message_at" | "first_admin_reply_at"
  >,
  nowMs = Date.now(),
): SupportSlaHints {
  const open = conv.status === "queued" || conv.status === "active";
  const wait_minutes =
    open && conv.status === "queued"
      ? Math.max(0, Math.floor((nowMs - new Date(conv.created_at).getTime()) / 60_000))
      : null;
  const needs_first_reply = open && !conv.first_admin_reply_at;
  const customer_waiting_reply =
    open &&
    Boolean(conv.last_customer_message_at) &&
    new Date(conv.last_customer_message_at!).getTime() >=
      new Date(conv.last_message_at).getTime() - 2000;
  return { wait_minutes, needs_first_reply, customer_waiting_reply };
}

export async function sendSupportInternalNote(
  client: SupabaseClient<Database>,
  params: { conversation_id: string; body: string },
): Promise<SupportMessageRow> {
  const body = params.body.trim();
  if (!body) throw new SupabaseApiError("Note cannot be empty.");

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to add a note.");
  }

  const { data, error } = await client
    .from("support_messages")
    .insert({
      conversation_id: params.conversation_id.trim(),
      sender_user_id: userData.user.id,
      sender_role: "internal",
      body,
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function adminClaimSupportConversation(
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<SupportConversationRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to claim this chat.");
  }

  const { data, error } = await client
    .from("support_conversations")
    .update({
      assigned_admin_user_id: userData.user.id,
      status: "active",
    })
    .eq("id", conversationId.trim())
    .in("status", ["queued", "active"])
    .select()
    .single();
  const row = takeSingleRow(data, error);

  const { logSupportConversationEvent } = await import("./support-audit");
  const actorName = await import("./support-audit-helpers").then((m) =>
    m.supportAgentPublicNameFromUserId(client, userData.user!.id),
  );
  await logSupportConversationEvent(client, {
    conversation_id: row.id,
    event_type: "claimed",
    actor_role: "desk",
    actor_user_id: userData.user.id,
    summary: `${actorName} claimed this chat`,
  });

  return row;
}

export async function adminAssignSupportConversation(
  client: SupabaseClient<Database>,
  conversationId: string,
  adminUserId: string | null,
): Promise<SupportConversationRow> {
  const convId = conversationId.trim();
  const before = await getSupportConversationById(client, convId);

  const patch: Database["public"]["Tables"]["support_conversations"]["Update"] = {
    assigned_admin_user_id: adminUserId,
  };
  if (adminUserId) {
    patch.status = "active";
  }

  const { data, error } = await client
    .from("support_conversations")
    .update(patch)
    .eq("id", convId)
    .select()
    .single();
  const row = takeSingleRow(data, error);

  const { data: userData } = await client.auth.getUser();
  const { logSupportConversationEvent } = await import("./support-audit");
  const { supportAgentPublicNameFromUserId } = await import("./support-audit-helpers");

  if (!adminUserId) {
    const actorName = userData.user
      ? await supportAgentPublicNameFromUserId(client, userData.user.id)
      : "Support";
    await logSupportConversationEvent(client, {
      conversation_id: row.id,
      event_type: "unassigned",
      actor_role: "desk",
      actor_user_id: userData.user?.id ?? null,
      summary: `${actorName} unassigned this chat`,
    });
  } else if (before.assigned_admin_user_id !== adminUserId) {
    const assigneeName = await supportAgentPublicNameFromUserId(client, adminUserId);
    const actorName = userData.user
      ? await supportAgentPublicNameFromUserId(client, userData.user.id)
      : "Support";
    await logSupportConversationEvent(client, {
      conversation_id: row.id,
      event_type: "assigned",
      actor_role: "desk",
      actor_user_id: userData.user?.id ?? null,
      summary: `${actorName} assigned this chat to ${assigneeName}`,
      metadata: { assignee_user_id: adminUserId },
    });
  }

  return row;
}

export async function adminUpdateSupportPriority(
  client: SupabaseClient<Database>,
  conversationId: string,
  priority: SupportConversationPriority,
): Promise<SupportConversationRow> {
  const convId = conversationId.trim();
  const before = await getSupportConversationById(client, convId);

  const { data, error } = await client
    .from("support_conversations")
    .update({ priority })
    .eq("id", convId)
    .select()
    .single();
  const row = takeSingleRow(data, error);

  if (before.priority !== priority) {
    const { data: userData } = await client.auth.getUser();
    const { logSupportConversationEvent } = await import("./support-audit");
    const actorName = userData.user
      ? await import("./support-audit-helpers").then((m) =>
          m.supportAgentPublicNameFromUserId(client, userData.user!.id),
        )
      : "Support";
    await logSupportConversationEvent(client, {
      conversation_id: row.id,
      event_type: "priority_changed",
      actor_role: "desk",
      actor_user_id: userData.user?.id ?? null,
      summary: `${actorName} set priority to ${priority}`,
      metadata: { from: before.priority, to: priority },
    });
  }

  return row;
}

export type SupportDeskAgent = Pick<UserRow, "id" | "full_name" | "email" | "phone">;

export async function listSupportDeskAgents(
  client: SupabaseClient<Database>,
): Promise<SupportDeskAgent[]> {
  const { data, error } = await client
    .from("users")
    .select("id, full_name, email, phone")
    .in("role", ["admin", "support"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return takeRows(data, error);
}

export function isSupportDeskRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "support";
}

export async function getMySupportAgent(
  client: SupabaseClient<Database>,
): Promise<SupportAgentRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) return null;

  const { data, error } = await client
    .from("support_agents")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

/** Ensures `support_agents` row exists for signed-in support role users. */
export async function ensureMySupportAgent(
  client: SupabaseClient<Database>,
): Promise<SupportAgentRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) return null;

  const { data: userRow, error: roleErr } = await client
    .from("users")
    .select("role, full_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (roleErr) throw new SupabaseApiError(roleErr.message, roleErr);
  if (userRow?.role !== "support") return null;

  const existing = await getMySupportAgent(client);
  if (existing) return existing;

  const { data, error } = await client
    .from("support_agents")
    .insert({
      user_id: userData.user.id,
      display_name: userRow.full_name,
    })
    .select()
    .single();
  const agent = takeSingleRow(data, error);
  await syncUserDisplayNameFromSupportAgent(client, agent);
  return agent;
}

export async function adminEscalateSupportConversation(
  client: SupabaseClient<Database>,
  conversationId: string,
  note: string,
): Promise<SupportConversationRow> {
  const trimmed = note.trim();
  const { data, error } = await client
    .from("support_conversations")
    .update({
      status: "active",
      resolution_tag: "escalated",
      escalated_at: new Date().toISOString(),
      escalation_note: trimmed || null,
    })
    .eq("id", conversationId.trim())
    .select()
    .single();
  const row = takeSingleRow(data, error);

  const { data: userData } = await client.auth.getUser();
  if (userData.user) {
    const { logSupportConversationEvent } = await import("./support-audit");
    const actorName = await import("./support-audit-helpers").then((m) =>
      m.supportAgentPublicNameFromUserId(client, userData.user!.id),
    );
    await logSupportConversationEvent(client, {
      conversation_id: row.id,
      event_type: "escalated",
      actor_role: "desk",
      actor_user_id: userData.user.id,
      summary: trimmed
        ? `${actorName} escalated to operations: ${trimmed}`
        : `${actorName} escalated to operations`,
      metadata: { note: trimmed || null },
    });
  }

  await client.from("support_messages").insert({
    conversation_id: row.id,
    sender_user_id: userData.user?.id ?? null,
    sender_role: "admin",
    body: trimmed
      ? `Escalated to operations: ${trimmed}`
      : "Escalated to our operations team for follow-up.",
  });

  return row;
}

export async function submitSupportCsatAsTechnician(
  client: SupabaseClient<Database>,
  conversationId: string,
  input: { rating: number; comment?: string | null },
): Promise<SupportConversationRow> {
  const rating = Math.round(input.rating);
  if (rating < 1 || rating > 5) {
    throw new SupabaseApiError("Rating must be between 1 and 5.");
  }

  const technician = await getMyTechnicianProfile(client);
  if (!technician) throw new SupabaseApiError("Technician profile required.");

  const submittedAt = new Date().toISOString();
  const { data, error } = await client
    .from("support_conversations")
    .update({
      csat_rating: rating,
      csat_comment: input.comment?.trim() || null,
      csat_submitted_at: submittedAt,
    })
    .eq("id", conversationId.trim())
    .eq("technician_id", technician.id)
    .eq("participant_audience", "technician")
    .eq("status", "resolved")
    .is("csat_submitted_at", null)
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function submitSupportCsatAsCustomer(
  client: SupabaseClient<Database>,
  conversationId: string,
  input: { rating: number; comment?: string | null },
): Promise<SupportConversationRow> {
  const rating = Math.round(input.rating);
  if (rating < 1 || rating > 5) {
    throw new SupabaseApiError("Rating must be between 1 and 5.");
  }

  const customer = await getMyCustomer(client);
  if (!customer) throw new SupabaseApiError("Customer profile required.");

  const submittedAt = new Date().toISOString();
  const { data, error } = await client
    .from("support_conversations")
    .update({
      csat_rating: rating,
      csat_comment: input.comment?.trim() || null,
      csat_submitted_at: submittedAt,
    })
    .eq("id", conversationId.trim())
    .eq("customer_id", customer.id)
    .eq("status", "resolved")
    .is("csat_submitted_at", null)
    .select()
    .single();
  const row = takeSingleRow(data, error);

  const { data: userData } = await client.auth.getUser();
  const { logSupportConversationEvent } = await import("./support-audit");
  await logSupportConversationEvent(client, {
    conversation_id: row.id,
    event_type: "csat_submitted",
    actor_role: "customer",
    actor_user_id: userData.user?.id ?? null,
    summary: `Customer rated this chat ${rating} out of 5`,
    metadata: {
      rating,
      has_comment: Boolean(input.comment?.trim()),
      submitted_at: submittedAt,
    },
  });

  return row;
}

export type SupportDeskInsights = {
  open_count: number;
  queued_count: number;
  unassigned_count: number;
  resolved_24h: number;
  avg_first_reply_minutes: number | null;
  avg_csat_7d: number | null;
  by_category: { category_slug: string; count: number }[];
};

export async function getSupportDeskInsights(
  client: SupabaseClient<Database>,
): Promise<SupportDeskInsights> {
  const { data, error } = await client.rpc("get_support_desk_insights");
  if (error) throw new SupabaseApiError(error.message, error);
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    open_count: Number(raw.open_count ?? 0),
    queued_count: Number(raw.queued_count ?? 0),
    unassigned_count: Number(raw.unassigned_count ?? 0),
    resolved_24h: Number(raw.resolved_24h ?? 0),
    avg_first_reply_minutes:
      raw.avg_first_reply_minutes == null ? null : Number(raw.avg_first_reply_minutes),
    avg_csat_7d: raw.avg_csat_7d == null ? null : Number(raw.avg_csat_7d),
    by_category: Array.isArray(raw.by_category)
      ? (raw.by_category as { category_slug: string; count: number }[])
      : [],
  };
}

export const SUPPORT_ATTACHMENTS_BUCKET = "support-attachments";

export async function listSupportMessageAttachments(
  client: SupabaseClient<Database>,
  messageId: string,
): Promise<SupportMessageAttachmentRow[]> {
  const { data, error } = await client
    .from("support_message_attachments")
    .select("*")
    .eq("message_id", messageId.trim())
    .order("created_at", { ascending: true });
  return takeRows(data, error);
}

export async function registerSupportMessageAttachment(
  client: SupabaseClient<Database>,
  input: {
    message_id: string;
    storage_path: string;
    file_name?: string | null;
    mime_type?: string | null;
    byte_size?: number | null;
  },
): Promise<SupportMessageAttachmentRow> {
  const { data, error } = await client
    .from("support_message_attachments")
    .insert({
      message_id: input.message_id.trim(),
      storage_path: input.storage_path.trim(),
      file_name: input.file_name?.trim() || null,
      mime_type: input.mime_type?.trim() || null,
      byte_size: input.byte_size ?? null,
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

export function supportAttachmentStoragePath(
  conversationId: string,
  messageId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${conversationId.trim()}/${messageId.trim()}/${Date.now()}-${safe}`;
}

export async function listSupportMacros(
  client: SupabaseClient<Database>,
): Promise<SupportMacroRow[]> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to load macros.");
  }

  const { data, error } = await client
    .from("support_macros")
    .select("*")
    .or(`is_team.eq.true,owner_user_id.eq.${userData.user.id}`)
    .order("title", { ascending: true });
  return takeRows(data, error);
}

export async function createSupportMacro(
  client: SupabaseClient<Database>,
  input: { title: string; body: string; category_slug?: string | null; is_team?: boolean },
): Promise<SupportMacroRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) {
    throw new SupabaseApiError("Sign in again to save a macro.");
  }

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new SupabaseApiError("Macro title and body are required.");

  const isTeam = Boolean(input.is_team);
  const { data, error } = await client
    .from("support_macros")
    .insert({
      title,
      body,
      category_slug: input.category_slug?.trim() || null,
      is_team: isTeam,
      owner_user_id: isTeam ? null : userData.user.id,
    })
    .select()
    .single();
  return takeSingleRow(data, error);
}

/** Strip characters that act as wildcards in Postgres ILIKE patterns. */
function sanitizeSupportDeskSearchQuery(query: string): string {
  return query.replace(/[%_]/g, " ").replace(/\s+/g, " ").trim();
}

function phoneDigitsForSearch(query: string): string | null {
  const digits = query.replace(/\D/g, "");
  return digits.length >= 4 ? digits : null;
}

/** Customer ids matching profile, contact, or linked login (users) fields. */
async function findSupportDeskCustomerIdsForSearch(
  client: SupabaseClient<Database>,
  rawQuery: string,
  limit: number,
): Promise<string[]> {
  const q = sanitizeSupportDeskSearchQuery(rawQuery);
  if (q.length < 2) return [];

  const ids = new Set<string>();
  const push = (rows: { id: string }[] | null | undefined) => {
    for (const row of rows ?? []) {
      ids.add(row.id);
      if (ids.size >= limit) return;
    }
  };

  const { data: byProfile, error: profileErr } = await client
    .from("customers")
    .select("id")
    .or(`display_name.ilike.%${q}%,contact_email.ilike.%${q}%,alternate_phone.ilike.%${q}%`)
    .limit(limit);
  if (profileErr) throw new SupabaseApiError(profileErr.message, profileErr);
  push(byProfile);

  const digits = phoneDigitsForSearch(rawQuery);
  if (digits && ids.size < limit) {
    const { data: byPhone, error: phoneErr } = await client
      .from("customers")
      .select("id")
      .or(`alternate_phone.ilike.%${digits}%`)
      .limit(limit);
    if (phoneErr) throw new SupabaseApiError(phoneErr.message, phoneErr);
    push(byPhone);

    const { data: usersByPhone, error: usersPhoneErr } = await client
      .from("users")
      .select("id")
      .eq("role", "customer")
      .ilike("phone", `%${digits}%`)
      .limit(limit);
    if (usersPhoneErr) throw new SupabaseApiError(usersPhoneErr.message, usersPhoneErr);
    const userIds = (usersByPhone ?? []).map((u) => u.id);
    if (userIds.length > 0) {
      const { data: byUserPhone, error: custPhoneErr } = await client
        .from("customers")
        .select("id")
        .in("user_id", userIds)
        .limit(limit);
      if (custPhoneErr) throw new SupabaseApiError(custPhoneErr.message, custPhoneErr);
      push(byUserPhone);
    }
  }

  if (ids.size < limit) {
    const { data: usersByName, error: usersErr } = await client
      .from("users")
      .select("id")
      .eq("role", "customer")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(limit);
    if (usersErr) throw new SupabaseApiError(usersErr.message, usersErr);
    const userIds = (usersByName ?? []).map((u) => u.id);
    if (userIds.length > 0) {
      const { data: byUser, error: custErr } = await client
        .from("customers")
        .select("id")
        .in("user_id", userIds)
        .limit(limit);
      if (custErr) throw new SupabaseApiError(custErr.message, custErr);
      push(byUser);
    }
  }

  return [...ids].slice(0, limit);
}

/** Technician ids matching profile, contact, employee code, partner vendor, or linked login. */
async function findSupportDeskTechnicianIdsForSearch(
  client: SupabaseClient<Database>,
  rawQuery: string,
  limit: number,
): Promise<string[]> {
  const q = sanitizeSupportDeskSearchQuery(rawQuery);
  if (q.length < 2) return [];

  const ids = new Set<string>();
  const push = (rows: { id: string }[] | null | undefined) => {
    for (const row of rows ?? []) {
      ids.add(row.id);
      if (ids.size >= limit) return;
    }
  };

  const { data: byProfile, error: profileErr } = await client
    .from("technicians")
    .select("id")
    .or(
      `name_as_per_aadhaar.ilike.%${q}%,contact_email.ilike.%${q}%,personal_phone.ilike.%${q}%,employee_code.ilike.%${q}%`,
    )
    .limit(limit);
  if (profileErr) throw new SupabaseApiError(profileErr.message, profileErr);
  push(byProfile);

  const digits = phoneDigitsForSearch(rawQuery);
  if (digits && ids.size < limit) {
    const { data: byPhone, error: phoneErr } = await client
      .from("technicians")
      .select("id")
      .ilike("personal_phone", `%${digits}%`)
      .limit(limit);
    if (phoneErr) throw new SupabaseApiError(phoneErr.message, phoneErr);
    push(byPhone);

    const { data: usersByPhone, error: usersPhoneErr } = await client
      .from("users")
      .select("id")
      .eq("role", "technician")
      .ilike("phone", `%${digits}%`)
      .limit(limit);
    if (usersPhoneErr) throw new SupabaseApiError(usersPhoneErr.message, usersPhoneErr);
    const userIds = (usersByPhone ?? []).map((u) => u.id);
    if (userIds.length > 0) {
      const { data: byUserPhone, error: techPhoneErr } = await client
        .from("technicians")
        .select("id")
        .in("user_id", userIds)
        .limit(limit);
      if (techPhoneErr) throw new SupabaseApiError(techPhoneErr.message, techPhoneErr);
      push(byUserPhone);
    }
  }

  if (ids.size < limit) {
    const { data: usersByName, error: usersErr } = await client
      .from("users")
      .select("id")
      .eq("role", "technician")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(limit);
    if (usersErr) throw new SupabaseApiError(usersErr.message, usersErr);
    const userIds = (usersByName ?? []).map((u) => u.id);
    if (userIds.length > 0) {
      const { data: byUser, error: techErr } = await client
        .from("technicians")
        .select("id")
        .in("user_id", userIds)
        .limit(limit);
      if (techErr) throw new SupabaseApiError(techErr.message, techErr);
      push(byUser);
    }
  }

  if (ids.size < limit) {
    const { data: vendors, error: vendorErr } = await client
      .from("vendors")
      .select("id")
      .or(`business_name.ilike.%${q}%,trade_name.ilike.%${q}%`)
      .limit(limit);
    if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
    const vendorIds = (vendors ?? []).map((v) => v.id);
    if (vendorIds.length > 0) {
      const { data: byVendor, error: byVendorErr } = await client
        .from("technicians")
        .select("id")
        .in("vendor_id", vendorIds)
        .limit(limit);
      if (byVendorErr) throw new SupabaseApiError(byVendorErr.message, byVendorErr);
      push(byVendor);
    }
  }

  return [...ids].slice(0, limit);
}

export async function searchSupportDesk(
  client: SupabaseClient<Database>,
  query: string,
  options?: { limit?: number },
): Promise<SupportConversationWithCustomer[]> {
  const q = sanitizeSupportDeskSearchQuery(query.trim());
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 80);
  if (q.length < 2) return [];

  const ids = new Set<string>();

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);

  if (uuidLike) {
    const { data } = await client
      .from("support_conversations")
      .select("id")
      .eq("id", q)
      .maybeSingle();
    if (data?.id) ids.add(data.id);
  }

  const { data: byConv } = await client
    .from("support_conversations")
    .select("id")
    .or(`subject.ilike.%${q}%,details_text.ilike.%${q}%,category_slug.ilike.%${q}%`)
    .limit(limit);
  for (const row of byConv ?? []) ids.add(row.id);

  const customerIds = await findSupportDeskCustomerIdsForSearch(client, query.trim(), 20);
  if (customerIds.length > 0) {
    const { data: byCustomer } = await client
      .from("support_conversations")
      .select("id")
      .in("customer_id", customerIds)
      .limit(limit);
    for (const row of byCustomer ?? []) ids.add(row.id);
  }

  const technicianIds = await findSupportDeskTechnicianIdsForSearch(client, query.trim(), 20);
  if (technicianIds.length > 0) {
    const { data: byTechnician } = await client
      .from("support_conversations")
      .select("id")
      .in("technician_id", technicianIds)
      .limit(limit);
    for (const row of byTechnician ?? []) ids.add(row.id);
  }

  const { data: bookings } = await client
    .from("bookings")
    .select("id")
    .ilike("reference_code", `%${q}%`)
    .limit(15);
  const bookingIds = (bookings ?? []).map((b) => b.id);
  if (bookingIds.length > 0) {
    const { data: byBooking } = await client
      .from("support_conversations")
      .select("id")
      .in("booking_id", bookingIds)
      .limit(limit);
    for (const row of byBooking ?? []) ids.add(row.id);
  }

  if (ids.size === 0) return [];

  const { data, error } = await client
    .from("support_conversations")
    .select("*")
    .in("id", [...ids].slice(0, limit))
    .order("last_message_at", { ascending: false });
  const rows = takeRows(data, error);
  return attachParticipantsToSupportConversations(client, rows);
}

export type SupportDeskCustomerBrief = Pick<
  CustomerRow,
  "id" | "display_name" | "contact_email" | "alternate_phone" | "onboarding_completed_at"
>;

export type SupportDeskCustomerSearchHit = SupportDeskCustomerBrief & {
  open_conversation_count: number;
  total_conversations: number;
  last_conversation_at: string | null;
};

export type SupportDeskCustomerProfile = {
  customer: SupportDeskCustomerBrief;
  conversations: SupportConversationWithCustomer[];
  primary_conversation_id: string | null;
  desk_context: SupportDeskCustomerContext | null;
};

/** Search customers by profile, contact, or linked app login for the support desk. */
export async function searchSupportDeskCustomers(
  client: SupabaseClient<Database>,
  query: string,
  options?: { limit?: number },
): Promise<SupportDeskCustomerSearchHit[]> {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
  const customerIds = await findSupportDeskCustomerIdsForSearch(client, query.trim(), limit);
  if (customerIds.length === 0) return [];

  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, display_name, contact_email, alternate_phone, onboarding_completed_at")
    .in("id", customerIds)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);
  if (!customers?.length) return [];

  const ids = customers.map((c) => c.id);
  const { data: convs, error: convErr } = await client
    .from("support_conversations")
    .select("customer_id, status, last_message_at")
    .in("customer_id", ids);
  if (convErr) throw new SupabaseApiError(convErr.message, convErr);

  const stats = new Map<string, { open: number; total: number; last: string | null }>();
  for (const c of convs ?? []) {
    if (!c.customer_id) continue;
    const cur = stats.get(c.customer_id) ?? { open: 0, total: 0, last: null };
    cur.total += 1;
    if (c.status === "queued" || c.status === "active") cur.open += 1;
    if (!cur.last || c.last_message_at > cur.last) cur.last = c.last_message_at;
    stats.set(c.customer_id, cur);
  }

  return customers.map((c) => {
    const s = stats.get(c.id);
    return {
      ...c,
      open_conversation_count: s?.open ?? 0,
      total_conversations: s?.total ?? 0,
      last_conversation_at: s?.last ?? null,
    };
  });
}

/** Full customer profile + conversations + operational context for support search. */
export async function getSupportDeskCustomerProfile(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<SupportDeskCustomerProfile> {
  const id = customerId.trim();
  const { data: customer, error: custErr } = await client
    .from("customers")
    .select("id, display_name, contact_email, alternate_phone, onboarding_completed_at")
    .eq("id", id)
    .single();
  if (custErr) throw new SupabaseApiError(custErr.message, custErr);

  const { data: convRows, error: convErr } = await client
    .from("support_conversations")
    .select("*")
    .eq("customer_id", id)
    .order("last_message_at", { ascending: false })
    .limit(30);
  if (convErr) throw new SupabaseApiError(convErr.message, convErr);

  const conversations = await attachParticipantsToSupportConversations(client, convRows ?? []);

  const primary =
    conversations.find((c) => c.status === "queued" || c.status === "active") ?? conversations[0] ?? null;

  const desk_context = primary ? await getSupportDeskCustomerContext(client, primary) : null;

  return {
    customer,
    conversations,
    primary_conversation_id: primary?.id ?? null,
    desk_context,
  };
}

export type SupportDeskTechnicianBrief = {
  id: string;
  display_name: string | null;
  contact_email: string | null;
  personal_phone: string | null;
  employee_code: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
};

export type SupportDeskTechnicianSearchHit = SupportDeskTechnicianBrief & {
  open_conversation_count: number;
  total_conversations: number;
  last_conversation_at: string | null;
};

export type SupportDeskTechnicianProfile = {
  technician: SupportDeskTechnicianBrief;
  conversations: SupportConversationWithParticipant[];
  primary_conversation_id: string | null;
  desk_context: SupportDeskTechnicianContext | null;
};

async function attachVendorNamesToTechnicianBriefs(
  client: SupabaseClient<Database>,
  technicians: Omit<SupportDeskTechnicianBrief, "vendor_name">[],
): Promise<SupportDeskTechnicianBrief[]> {
  const vendorIds = [
    ...new Set(technicians.map((t) => t.vendor_id).filter((id): id is string => Boolean(id))),
  ];
  const vendorNameById = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vendors, error: vendorErr } = await client
      .from("vendors")
      .select("id, business_name, trade_name")
      .in("id", vendorIds);
    if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
    for (const v of vendors ?? []) {
      const name = supportDeskVendorDisplayName(v);
      if (name) vendorNameById.set(v.id, name);
    }
  }

  return technicians.map((t) => ({
    ...t,
    vendor_name: t.vendor_id ? (vendorNameById.get(t.vendor_id) ?? null) : null,
  }));
}

/** Search technicians by profile, contact, employee code, partner vendor, or login for the support desk. */
export async function searchSupportDeskTechnicians(
  client: SupabaseClient<Database>,
  query: string,
  options?: { limit?: number },
): Promise<SupportDeskTechnicianSearchHit[]> {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 50);
  const technicianIds = await findSupportDeskTechnicianIdsForSearch(client, query.trim(), limit);
  if (technicianIds.length === 0) return [];

  const { data: technicians, error: techErr } = await client
    .from("technicians")
    .select("id, name_as_per_aadhaar, contact_email, personal_phone, employee_code, vendor_id")
    .in("id", technicianIds)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (techErr) throw new SupabaseApiError(techErr.message, techErr);
  if (!technicians?.length) return [];

  const briefs = await attachVendorNamesToTechnicianBriefs(
    client,
    technicians.map((t) => ({
      id: t.id,
      display_name: t.name_as_per_aadhaar,
      contact_email: t.contact_email,
      personal_phone: t.personal_phone,
      employee_code: t.employee_code,
      vendor_id: t.vendor_id,
    })),
  );

  const ids = briefs.map((t) => t.id);
  const { data: convs, error: convErr } = await client
    .from("support_conversations")
    .select("technician_id, status, last_message_at")
    .in("technician_id", ids)
    .eq("participant_audience", "technician");
  if (convErr) throw new SupabaseApiError(convErr.message, convErr);

  const stats = new Map<string, { open: number; total: number; last: string | null }>();
  for (const c of convs ?? []) {
    if (!c.technician_id) continue;
    const cur = stats.get(c.technician_id) ?? { open: 0, total: 0, last: null };
    cur.total += 1;
    if (c.status === "queued" || c.status === "active") cur.open += 1;
    if (!cur.last || c.last_message_at > cur.last) cur.last = c.last_message_at;
    stats.set(c.technician_id, cur);
  }

  return briefs.map((t) => {
    const s = stats.get(t.id);
    return {
      ...t,
      open_conversation_count: s?.open ?? 0,
      total_conversations: s?.total ?? 0,
      last_conversation_at: s?.last ?? null,
    };
  });
}

/** Full technician profile + conversations + operational context for support search. */
export async function getSupportDeskTechnicianProfile(
  client: SupabaseClient<Database>,
  technicianId: string,
): Promise<SupportDeskTechnicianProfile> {
  const id = technicianId.trim();
  const { data: technician, error: techErr } = await client
    .from("technicians")
    .select("id, name_as_per_aadhaar, contact_email, personal_phone, employee_code, vendor_id")
    .eq("id", id)
    .single();
  if (techErr) throw new SupabaseApiError(techErr.message, techErr);

  const briefs = await attachVendorNamesToTechnicianBriefs(client, [
    {
      id: technician.id,
      display_name: technician.name_as_per_aadhaar,
      contact_email: technician.contact_email,
      personal_phone: technician.personal_phone,
      employee_code: technician.employee_code,
      vendor_id: technician.vendor_id,
    },
  ]);
  const technicianBrief = briefs[0];
  if (!technicianBrief) {
    throw new SupabaseApiError("Technician profile could not be loaded.");
  }

  const { data: convRows, error: convErr } = await client
    .from("support_conversations")
    .select("*")
    .eq("technician_id", id)
    .eq("participant_audience", "technician")
    .order("last_message_at", { ascending: false })
    .limit(30);
  if (convErr) throw new SupabaseApiError(convErr.message, convErr);

  const conversations = await attachParticipantsToSupportConversations(client, convRows ?? []);

  const primary =
    conversations.find((c) => c.status === "queued" || c.status === "active") ?? conversations[0] ?? null;

  const desk_context = primary ? await getSupportDeskTechnicianContext(client, primary) : null;

  return {
    technician: technicianBrief,
    conversations,
    primary_conversation_id: primary?.id ?? null,
    desk_context,
  };
}

export {
  parseSupportMessageEvent,
  supportAgentNameFromMessage,
  supportThreadSubtitleForCustomer,
  type SupportMessageEventKind,
} from "./support-message-events";
export {
  buildSupportConversationClosureSummary,
  getSupportDeskUserDisplayName,
  listSupportConversationEvents,
  logSupportConversationEvent,
  type SupportConversationClosureSummary,
  type SupportConversationEventWithActor,
} from "./support-audit";
export {
  formatSupportCsatStars,
  supportCloseReasonLabel,
  supportResolutionTagLabel,
} from "./support-desk-labels";
