/**
 * Session-scoped “service address chosen” flag for MandatoryServiceAddressGate.
 * Survives (main) remount when returning from root modals like /book.
 */
const dismissedCustomerIds = new Set<string>();

export function isSessionAddressGateDismissed(customerId: string): boolean {
  return dismissedCustomerIds.has(customerId);
}

export function markSessionAddressGateDismissed(customerId: string): void {
  dismissedCustomerIds.add(customerId);
}

/** Call on logout / user switch so the next account is gated again. */
export function clearSessionAddressGate(customerId?: string): void {
  if (customerId) {
    dismissedCustomerIds.delete(customerId);
    return;
  }
  dismissedCustomerIds.clear();
}
