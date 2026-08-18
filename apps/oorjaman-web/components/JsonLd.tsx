export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // Escape `<` so a `</script>` (or `<!--`) sequence in any field can't break out of the
  // script tag (XSS hardening - SECURITY_REVIEW L1). `\u003c` is valid inside JSON-LD.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
