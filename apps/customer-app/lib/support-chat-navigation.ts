import { router } from "expo-router";
import type { HelpSupportOpenContext } from "@oorjaman/ui";

const ROOT_MODAL_SEGMENTS = new Set([
  "book",
  "booking-detail",
  "booking-track",
  "booking-reschedule",
  "preferred-partner",
  "credits",
  "support-chat",
]);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isRootModalRoute(segments: string[]): boolean {
  return segments.some((segment) => ROOT_MODAL_SEGMENTS.has(segment));
}

export function supportChatHref(context?: HelpSupportOpenContext): string {
  const q = new URLSearchParams();
  if (context?.subscription_id?.trim()) q.set("subscription_id", context.subscription_id.trim());
  if (context?.service_address_id?.trim()) q.set("service_address_id", context.service_address_id.trim());
  if (context?.category_slug?.trim()) q.set("category_slug", context.category_slug.trim());
  if (context?.subcategory_slug?.trim()) q.set("subcategory_slug", context.subcategory_slug.trim());
  if (context?.booking_id?.trim()) q.set("booking_id", context.booking_id.trim());
  if (context?.conversation_id?.trim()) q.set("conversation_id", context.conversation_id.trim());
  if (context?.list_scope === "booking") q.set("list_scope", "booking");
  if (context?.focus_active_thread) q.set("focus_active_thread", "1");
  const query = q.toString();
  return query ? `/support-chat?${query}` : "/support-chat";
}

/** Opens support on a stacked modal route (works above Book a visit and other root modals). */
export function openSupportChat(context?: HelpSupportOpenContext): void {
  router.push(supportChatHref(context) as "/support-chat");
}

export function parseSupportChatRouteParams(params: {
  subscription_id?: string | string[];
  service_address_id?: string | string[];
  category_slug?: string | string[];
  subcategory_slug?: string | string[];
  booking_id?: string | string[];
  conversation_id?: string | string[];
  list_scope?: string | string[];
  focus_active_thread?: string | string[];
}): HelpSupportOpenContext {
  const listScope = firstParam(params.list_scope);
  return {
    subscription_id: firstParam(params.subscription_id) ?? null,
    service_address_id: firstParam(params.service_address_id) ?? null,
    category_slug: firstParam(params.category_slug) ?? null,
    subcategory_slug: firstParam(params.subcategory_slug) ?? null,
    booking_id: firstParam(params.booking_id) ?? null,
    conversation_id: firstParam(params.conversation_id) ?? null,
    list_scope: listScope === "booking" ? "booking" : undefined,
    focus_active_thread: firstParam(params.focus_active_thread) === "1",
  };
}
