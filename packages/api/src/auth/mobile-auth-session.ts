import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { isAuthSessionMissingError } from "../result";
import { clearInvalidStoredSession, isInvalidRefreshTokenError } from "./auth-api";

export const AUTH_SIGN_IN_AGAIN_TITLE = "Session expired";
export const AUTH_SIGN_IN_AGAIN_MESSAGE =
  "Your sign-in has expired or is no longer valid. Please sign in again to continue.";

export const AUTH_NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

/** True when the user must sign in again (revoked / missing refresh token / expired JWT). */
export function requiresSignInAgain(error: unknown): boolean {
  if (isInvalidRefreshTokenError(error)) return true;
  if (isAuthSessionMissingError(error)) return true;

  const message = errorMessage(error);
  if (/jwt expired/i.test(message) || /invalid jwt/i.test(message)) return true;
  if (/session.*expired/i.test(message)) return true;

  if (error && typeof error === "object") {
    const name = "name" in error ? String((error as { name: unknown }).name) : "";
    if (name === "AuthApiError" && isInvalidRefreshTokenError(error)) return true;
  }

  return false;
}

/** Offline / flaky connectivity — not an auth logout. */
export function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && /network request failed/i.test(error.message)) {
    return true;
  }
  const message = errorMessage(error);
  return (
    /network request failed/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /network error/i.test(message) ||
    /timeout/i.test(message)
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

let skipNextSignedOutGuard = false;
let sessionExpiredHandler: (() => void) | null = null;

/** UI layer registers a single handler (alert + navigate to login). */
export function registerMobileSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

export function notifyMobileSessionExpired(): void {
  sessionExpiredHandler?.();
}

/** Call immediately before intentional `authApi.signOut` so the session guard stays silent. */
export function markUserInitiatedSignOut(): void {
  skipNextSignedOutGuard = true;
}

export type MobileAuthSessionGuardHandlers = {
  /** Called after local auth storage is cleared — navigate to login / show alert. */
  onRequireSignIn: (reason: "session-expired" | "signed-out") => void;
  /**
   * Return true when the user is on a screen that requires auth (e.g. main tabs).
   * Sign-out on public screens (login, onboarding) is ignored.
   */
  isProtectedRoute: () => boolean;
};

/**
 * Listen for Supabase auth session loss (invalid refresh token, sign-out) and notify the app.
 * Pair with {@link MobileAuthSessionGuard} in the UI layer for alerts + navigation.
 */
export function attachMobileAuthSessionGuard(
  client: SupabaseClient<Database>,
  handlers: MobileAuthSessionGuardHandlers,
): () => void {
  let handling = false;

  const maybeRequireSignIn = async (reason: "session-expired" | "signed-out") => {
    if (handling || !handlers.isProtectedRoute()) return;
    handling = true;
    try {
      if (reason === "session-expired") {
        await clearInvalidStoredSession(client);
      }
      handlers.onRequireSignIn(reason);
    } finally {
      handling = false;
    }
  };

  const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" && !session) {
      if (skipNextSignedOutGuard) {
        skipNextSignedOutGuard = false;
        return;
      }
      void maybeRequireSignIn("session-expired");
      return;
    }
    if (event === "INITIAL_SESSION" && !session && handlers.isProtectedRoute()) {
      void maybeRequireSignIn("session-expired");
    }
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
}

/** Clear invalid session when an API call proves the refresh token is dead. */
export async function handleAuthFailureFromError(
  client: SupabaseClient<Database>,
  error: unknown,
): Promise<"sign-in-again" | "network" | null> {
  if (requiresSignInAgain(error)) {
    await clearInvalidStoredSession(client);
    notifyMobileSessionExpired();
    return "sign-in-again";
  }
  if (isTransientNetworkError(error)) {
    return "network";
  }
  return null;
}
