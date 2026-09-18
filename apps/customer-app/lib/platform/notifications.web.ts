/**
 * Web: push/local notification handlers are deferred (Universal Web D7).
 * `@oorjaman/ui` already no-ops on web; this adapter keeps the root layout free
 * of direct notification imports for clearer platform boundaries.
 */
export function initAppNotificationHandlers(): void {
  // no-op
}
