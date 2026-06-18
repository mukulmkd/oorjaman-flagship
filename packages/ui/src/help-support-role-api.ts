import type { SupabaseClient } from "@supabase/supabase-js";
import {
  queryKeys,
  supportApi,
  type Database,
  type SupportCategory,
  type SupportConversationRow,
} from "@oorjaman/api";
import type { HelpSupportOpenContext } from "./help-support-context";

export type HelpSupportRole = "customer" | "technician";

export function helpSupportParticipantSenderRole(role: HelpSupportRole): "customer" | "technician" {
  return role;
}

export function helpSupportUnreadCountQueryKey(role: HelpSupportRole) {
  return role === "technician"
    ? queryKeys.support.unreadCount("technician")
    : queryKeys.support.unreadCount();
}

export function helpSupportListCatalog(role: HelpSupportRole): SupportCategory[] {
  return role === "customer"
    ? supportApi.listSupportCatalog()
    : supportApi.listSupportCatalog("technician");
}

export function helpSupportGetCategory(
  role: HelpSupportRole,
  categorySlug: string,
): SupportCategory | undefined {
  return role === "customer"
    ? supportApi.getSupportCategory(categorySlug)
    : supportApi.getTechnicianSupportCategory(categorySlug);
}

export function helpSupportGetSubcategory(
  role: HelpSupportRole,
  categorySlug: string,
  subcategorySlug: string,
) {
  return role === "customer"
    ? supportApi.getSupportSubcategory(categorySlug, subcategorySlug)
    : supportApi.getTechnicianSupportSubcategory(categorySlug, subcategorySlug);
}

export async function helpSupportListActiveConversations(
  role: HelpSupportRole,
  client: SupabaseClient<Database>,
): Promise<SupportConversationRow[]> {
  return role === "customer"
    ? supportApi.listActiveSupportConversationsForCustomer(client)
    : supportApi.listActiveSupportConversationsForTechnician(client);
}

export async function helpSupportMarkConversationRead(
  role: HelpSupportRole,
  client: SupabaseClient<Database>,
  conversationId: string,
): Promise<void> {
  if (role === "customer") {
    await supportApi.markSupportConversationReadByCustomer(client, conversationId);
    return;
  }
  await supportApi.markSupportConversationReadByTechnician(client, conversationId);
}

export async function helpSupportCreateConversation(
  role: HelpSupportRole,
  client: SupabaseClient<Database>,
  input: {
    category_slug: string;
    subcategory_slug: string;
    details_text: string;
    context?: HelpSupportOpenContext;
  },
): Promise<SupportConversationRow> {
  const { category_slug, subcategory_slug, details_text, context } = input;
  if (role === "customer") {
    return supportApi.createSupportConversationAsCustomer(client, {
      category_slug,
      subcategory_slug,
      details_text,
      booking_id: context?.booking_id,
      subscription_id: context?.subscription_id,
      service_address_id: context?.service_address_id,
    });
  }
  return supportApi.createSupportConversationAsTechnician(client, {
    category_slug,
    subcategory_slug,
    details_text,
    booking_id: context?.booking_id,
  });
}

export async function helpSupportSendMessage(
  role: HelpSupportRole,
  client: SupabaseClient<Database>,
  input: { conversation_id: string; body: string },
) {
  if (role === "customer") {
    return supportApi.sendSupportMessageAsCustomer(client, input);
  }
  return supportApi.sendSupportMessageAsTechnician(client, input);
}

export async function helpSupportSubmitCsat(
  role: HelpSupportRole,
  client: SupabaseClient<Database>,
  conversationId: string,
  input: { rating: number; comment: string },
) {
  if (role === "customer") {
    return supportApi.submitSupportCsatAsCustomer(client, conversationId, input);
  }
  return supportApi.submitSupportCsatAsTechnician(client, conversationId, input);
}

export function helpSupportThreadSubtitle(
  conversation: Pick<SupportConversationRow, "status" | "assigned_admin_user_id">,
  assignedAgentName: string | null,
): string {
  return supportApi.supportThreadSubtitleForCustomer(conversation, assignedAgentName);
}
