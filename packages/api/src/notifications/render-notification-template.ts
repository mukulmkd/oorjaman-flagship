/** Replace `{{variable}}` placeholders using a flat string/number context. */
export function renderNotificationTemplate(
  text: string,
  context: Record<string, string | number | boolean | null | undefined>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

export function templateContextFromPayload(
  payload: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean | null | undefined> {
  if (!payload) return {};
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (value === null) {
      out[key] = null;
    }
  }
  return out;
}
