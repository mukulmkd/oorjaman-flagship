import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationTemplateRow } from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";

export async function adminListNotificationTemplates(
  client: SupabaseClient<Database>,
): Promise<NotificationTemplateRow[]> {
  const { data, error } = await client
    .from("notification_templates")
    .select("*")
    .order("event_type", { ascending: true })
    .order("channel", { ascending: true });
  return takeRows(data, error);
}

export async function adminUpdateNotificationTemplate(
  client: SupabaseClient<Database>,
  templateId: string,
  patch: Database["public"]["Tables"]["notification_templates"]["Update"],
): Promise<NotificationTemplateRow> {
  const { data, error } = await client
    .from("notification_templates")
    .update(patch)
    .eq("id", templateId)
    .select("*")
    .single();
  return takeSingleRow(data, error);
}

export async function adminPreviewNotificationTemplate(
  client: SupabaseClient<Database>,
  templateId: string,
  context: Record<string, string | number | boolean | null | undefined>,
): Promise<{ subject: string | null; body: string }> {
  const { data, error } = await client
    .from("notification_templates")
    .select("subject, body")
    .eq("id", templateId)
    .single();
  if (error) throw new SupabaseApiError(error.message, error);
  const subject = data.subject;
  const body = data.body;
  const render = (text: string) =>
    text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => String(context[key] ?? ""));
  return {
    subject: subject ? render(subject) : null,
    body: render(body),
  };
}
