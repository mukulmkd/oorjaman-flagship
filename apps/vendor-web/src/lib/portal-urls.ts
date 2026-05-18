/** Oorjaman admin console origin (staff). Set in `.env` as `VITE_ADMIN_PORTAL_URL`. */
export function adminPortalOrigin(): string {
  const raw = import.meta.env.VITE_ADMIN_PORTAL_URL as string | undefined;
  return typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : "http://localhost:5173";
}

export function adminPortalUrl(path = "/dashboard/analytics"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${adminPortalOrigin()}${p}`;
}
