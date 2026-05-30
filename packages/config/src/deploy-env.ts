/** Deployment tier for public web hosts (marketing + Vite portals). */
export type DeployEnvironment = "local" | "uat" | "production";

const UAT_HOST_PREFIXES = ["dev-", "dev."] as const;

function hostFromUrl(url?: string | null): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when hostname looks like a UAT/staging host (e.g. dev-admin.oorjaman.com). */
export function isUatHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return UAT_HOST_PREFIXES.some((p) => h.startsWith(p));
}

/**
 * Resolve deploy tier from explicit env or site URL.
 * Set `NEXT_PUBLIC_DEPLOY_ENV` / `VITE_DEPLOY_ENV` to `uat` or `production` in CI/hosting.
 */
export function parseDeployEnvironment(options?: {
  deployEnv?: string | null;
  siteUrl?: string | null;
}): DeployEnvironment {
  const raw = (
    options?.deployEnv ??
    process.env.NEXT_PUBLIC_DEPLOY_ENV ??
    process.env.VITE_DEPLOY_ENV ??
    process.env.EXPO_PUBLIC_DEPLOY_ENV ??
    ""
  )
    .trim()
    .toLowerCase();

  if (raw === "uat" || raw === "staging") return "uat";
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "local" || raw === "development" || raw === "dev") return "local";

  const host = hostFromUrl(options?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.EXPO_PUBLIC_SITE_URL);
  if (host && isUatHostname(host)) return "uat";

  if (raw) return "production";
  return "local";
}

/** Marketing site (oorjaman-web) should not be indexed on UAT. */
export function isPublicMarketingIndexable(deployEnv?: DeployEnvironment): boolean {
  const tier = deployEnv ?? parseDeployEnvironment();
  return tier === "production";
}
