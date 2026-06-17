/** HTTPS logo URL for Gmail paste (embedded images are stripped when sending). */
export function hostedEmailLockupUrl(lockupPath: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URL(lockupPath, window.location.href).href;
  } catch {
    return null;
  }
}

export function pickEmailLogoSrcForClipboard(embeddedDataUri: string, lockupPath: string): string {
  const hosted = hostedEmailLockupUrl(lockupPath);
  if (hosted?.startsWith("https://")) {
    return hosted;
  }
  return embeddedDataUri;
}
