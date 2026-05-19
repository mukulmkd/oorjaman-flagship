/**
 * Human-readable labels for notification / queue identifiers shown in admin UI.
 * Raw keys stay in the database; we surface friendly names to reduce confusion.
 */

const NOTIFICATION_EVENT_TYPE_LABELS: Record<string, string> = {
  marketplace_broadcast: "Marketplace - new request (broadcast)",
  marketplace_claim_won: "Marketplace - your team claimed the booking",
  admin_marketplace_floated: "Ops - marketplace opened",
  admin_booking_vendor_claimed: "Ops - vendor claimed booking",
  admin_booking_vendor_accepted: "Ops - technician assigned",
  admin_booking_vendor_rejected: "Ops - vendor declined",
  admin_booking_needs_reassignment: "Ops - reassignment needed",
  admin_booking_technician_reassigned: "Ops - technician changed",
  admin_booking_visit_started: "Ops - visit started",
  admin_booking_visit_completed: "Ops - visit completed",
  admin_booking_cancelled: "Ops - booking cancelled",
  vendor_booking_assigned: "Partner - booking assigned to you",
  vendor_booking_visit_started: "Partner - visit started",
  vendor_booking_visit_completed: "Partner - visit completed",
  subscription_renewal_nudge: "Subscription - renewal reminder",
  low_rating_followup: "Ratings - low score follow-up",
};

const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  in_app: "In-app",
};

/** Title-style fallback for unknown snake_case keys */
function snakeCaseToTitle(raw: string): string {
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatNotificationEventTypeLabel(eventType: string): string {
  return NOTIFICATION_EVENT_TYPE_LABELS[eventType] ?? snakeCaseToTitle(eventType);
}

export function formatNotificationChannelLabel(channel: string): string {
  return NOTIFICATION_CHANNEL_LABELS[channel] ?? snakeCaseToTitle(channel);
}

const PRICING_CATALOG_TABLE_LABELS: Record<string, string> = {
  pricing_one_time_rates: "One-time visit rates",
  pricing_amc_plans: "AMC maintenance plans",
};

export function formatPricingCatalogTableLabel(tableName: string): string {
  return PRICING_CATALOG_TABLE_LABELS[tableName] ?? tableName;
}

const SQL_OPERATION_LABELS: Record<string, string> = {
  insert: "Insert",
  update: "Update",
  delete: "Delete",
};

export function formatSqlOperationLabel(operation: string): string {
  return SQL_OPERATION_LABELS[operation.toLowerCase()] ?? operation;
}
