/** Customer support desk (support-web). Set in `.env` as `VITE_SUPPORT_PORTAL_URL`. */
export function supportPortalOrigin(): string {
  const raw = import.meta.env.VITE_SUPPORT_PORTAL_URL as string | undefined;
  return typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : "http://localhost:5175";
}

export function supportPortalUrl(path = "/inbox"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${supportPortalOrigin()}${p}`;
}

/** Partner portal (vendor-web). */
export function vendorPortalOrigin(): string {
  const raw = import.meta.env.VITE_VENDOR_PORTAL_URL as string | undefined;
  return typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : "http://localhost:5174";
}
