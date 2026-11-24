/**
 * Shared k6 helpers for UAT-only Supabase stress.
 * Refuse known PROD project ref.
 */

export const PROD_PROJECT_REF = "nppfpegqnmclbcmmogux";

export function requireEnv(name) {
  const v = (__ENV[name] || "").trim();
  if (!v) {
    throw new Error(`Missing required env ${name}`);
  }
  return v;
}

export function supabaseConfig() {
  const url = (__ENV.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anon = (__ENV.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  if (url.includes(PROD_PROJECT_REF)) {
    throw new Error(
      `Refusing to run stress against PROD Supabase (${PROD_PROJECT_REF}). Use UAT only.`,
    );
  }
  return { url, anon };
}

export function authHeaders(accessToken, anonKey) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/**
 * Password login (UAT dummy OTP path uses the same password for seeded users).
 */
export function signInWithPassword(http, url, anonKey, email, password) {
  const res = http.post(
    `${url}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      tags: { name: "auth_password" },
    },
  );
  return res;
}

export function resolveCustomerToken(http, url, anonKey) {
  const pre = (__ENV.CUSTOMER_ACCESS_TOKEN || "").trim();
  if (pre) return pre;
  const email = requireEnv("CUSTOMER_EMAIL");
  const password = requireEnv("CUSTOMER_PASSWORD");
  const res = signInWithPassword(http, url, anonKey, email, password);
  if (res.status !== 200) {
    throw new Error(`Customer login failed: ${res.status} ${res.body}`);
  }
  const body = res.json();
  if (!body.access_token) throw new Error("Customer login missing access_token");
  return body.access_token;
}

export function resolveTechnicianToken(http, url, anonKey) {
  const pre = (__ENV.TECHNICIAN_ACCESS_TOKEN || "").trim();
  if (pre) return pre;
  const email = requireEnv("TECHNICIAN_EMAIL");
  const password = requireEnv("TECHNICIAN_PASSWORD");
  const res = signInWithPassword(http, url, anonKey, email, password);
  if (res.status !== 200) {
    throw new Error(`Technician login failed: ${res.status} ${res.body}`);
  }
  const body = res.json();
  if (!body.access_token) throw new Error("Technician login missing access_token");
  return body.access_token;
}
