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
