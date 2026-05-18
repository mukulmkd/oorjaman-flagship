import type { PostgrestError } from "@supabase/supabase-js";

/** Normalized error for React Query / UI layers */
export class SupabaseApiError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  readonly hint: string | undefined;

  constructor(message: string, source?: PostgrestError | Error) {
    super(message);
    this.name = "SupabaseApiError";
    if (source && "code" in source) {
      this.code = source.code;
      this.details = "details" in source ? source.details : undefined;
      this.hint = "hint" in source ? source.hint : undefined;
    }
  }
}

export function requireSessionUserId(userId: string | undefined): string {
  if (!userId) {
    throw new SupabaseApiError("Not signed in");
  }
  return userId;
}

/** True when Supabase Auth has no persisted session (e.g. after sign-out). */
export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; name?: string };
  return (
    e.name === "AuthSessionMissingError" ||
    e.message === "Auth session missing!" ||
    e.message === "Not signed in"
  );
}

/** Unwrap Supabase single-row responses; throws on error or missing row when expected */
export function takeSingleRow<T>(data: T | null, error: PostgrestError | null): T {
  if (error) {
    throw new SupabaseApiError(error.message, error);
  }
  if (data === null) {
    throw new SupabaseApiError("Row not found");
  }
  return data;
}

/** Unwrap Supabase list responses */
export function takeRows<T>(data: T[] | null, error: PostgrestError | null): T[] {
  if (error) {
    throw new SupabaseApiError(error.message, error);
  }
  return data ?? [];
}

/** Unwrap mutate / void responses */
export function takeVoid(error: PostgrestError | null): void {
  if (error) {
    throw new SupabaseApiError(error.message, error);
  }
}
