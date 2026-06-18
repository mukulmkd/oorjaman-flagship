function portalOrigin(envKey: string, fallback: string): string {
  const raw = import.meta.env[envKey] as string | undefined;
  return typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : fallback;
}

function portalUrl(origin: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

/** Oorjaman operations console (admin-web). */
export function adminPortalOrigin(): string {
  return portalOrigin("VITE_ADMIN_PORTAL_URL", "http://localhost:5173");
}

export function adminPortalUrl(path = "/dashboard/analytics"): string {
  return portalUrl(adminPortalOrigin(), path);
}

/** Partner portal (vendor-web). */
export function vendorPortalOrigin(): string {
  return portalOrigin("VITE_VENDOR_PORTAL_URL", "http://localhost:5174");
}

export function vendorPortalUrl(path = "/"): string {
  return portalUrl(vendorPortalOrigin(), path);
}

/** Customer support desk (support-web). */
export function supportPortalOrigin(): string {
  return portalOrigin("VITE_SUPPORT_PORTAL_URL", "http://localhost:5175");
}

export function supportPortalUrl(path = "/inbox"): string {
  return portalUrl(supportPortalOrigin(), path);
}
