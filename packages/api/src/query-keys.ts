/**
 * Stable React Query keys for OorjaManDB domain data.
 *
 * @example
 * useQuery({
 *   queryKey: queryKeys.bookings.detail(id),
 *   queryFn: () => bookingApi.getBookingById(supabase, id),
 * })
 */

export const queryKeys = {
  root: ["oorjaman"] as const,

  admin: {
    analytics: () => [...queryKeys.root, "admin", "analytics"] as const,
    bookingsDaily: (days: number) =>
      [...queryKeys.admin.analytics(), "bookings-daily", days] as const,
    vendorPerformance: (limit: number) =>
      [...queryKeys.admin.analytics(), "vendor-performance", limit] as const,
  },

  auth: {
    session: () => [...queryKeys.root, "auth", "session"] as const,
    user: () => [...queryKeys.root, "auth", "user"] as const,
  },

  users: {
    me: () => [...queryKeys.root, "users", "me"] as const,
    detail: (userId: string) => [...queryKeys.root, "users", userId] as const,
  },

  vendors: {
    all: () => [...queryKeys.root, "vendors"] as const,
    mine: () => [...queryKeys.vendors.all(), "mine"] as const,
    /** Approved vendors shown to customers */
    approvedDirectory: () => [...queryKeys.vendors.all(), "approved-directory"] as const,
    detail: (vendorId: string) => [...queryKeys.vendors.all(), vendorId] as const,
    adminList: (tab: "pending" | "approved" | "rejected") =>
      [...queryKeys.vendors.all(), "admin", "list", tab] as const,
    adminListPage: (tab: "pending" | "approved" | "rejected", page: number, pageSize: number) =>
      [...queryKeys.vendors.all(), "admin", "list-paged", tab, page, pageSize] as const,
    /** Pending + under_review only - registration queue (Vendor approval screen). */
    adminApprovalQueue: () => [...queryKeys.vendors.all(), "admin", "approval-queue"] as const,
    /** Pending + under_review queue for registration review UI */
    registrationQueue: () => [...queryKeys.vendors.all(), "registration-queue"] as const,
    /** Submitted partner applications (vendor_registration_intake). */
    intakeApprovalQueue: () => [...queryKeys.vendors.all(), "intake-approval-queue"] as const,
    intakeApprovalQueuePage: (page: number, pageSize: number) =>
      [...queryKeys.vendors.all(), "intake-approval-queue-paged", page, pageSize] as const,
    intakeDetail: (intakeId: string) => [...queryKeys.vendors.all(), "intake", intakeId] as const,
    technicians: (vendorId: string) =>
      [...queryKeys.vendors.detail(vendorId), "technicians"] as const,
    /** Technicians employed by the signed-in vendor (RLS). */
    myTechnicians: () => [...queryKeys.vendors.all(), "my-technicians"] as const,
    dashboardPayments: () => [...queryKeys.vendors.all(), "dashboard-payments"] as const,
    dashboardSubscriptions: () => [...queryKeys.vendors.all(), "dashboard-subscriptions"] as const,
    dashboardJobReports: (limit?: number) =>
      [...queryKeys.vendors.all(), "dashboard-job-reports", limit ?? "default"] as const,
    slotAvailability: (daysKey: string) =>
      [...queryKeys.vendors.all(), "slot-availability", daysKey] as const,
    slotBookabilityBatch: (vendorId: string, dayKey: string, slotIdsKey: string) =>
      [...queryKeys.vendors.all(), "slot-bookability-batch", vendorId, dayKey, slotIdsKey] as const,
    publicStats: (idsKey?: string) =>
      [...queryKeys.vendors.all(), "public-stats", idsKey ?? "all"] as const,
  },

  platform: {
    settings: () => [...queryKeys.root, "platform", "settings"] as const,
  },

  pricing: {
    rules: () => [...queryKeys.root, "pricing", "rules"] as const,
    tiers: (countryCode: string) => [...queryKeys.pricing.rules(), "tiers", countryCode] as const,
    cityTiers: (countryCode: string) => [...queryKeys.pricing.rules(), "city-tiers", countryCode] as const,
    nationalDefaultAudit: (countryCode: string) =>
      [...queryKeys.pricing.rules(), "national-default-audit", countryCode] as const,
    capacityCatalog: (countryCode: string) =>
      [...queryKeys.pricing.rules(), "capacity-catalog", countryCode] as const,
    catalogAudit: (countryCode: string) =>
      [...queryKeys.pricing.rules(), "catalog-audit", countryCode] as const,
    catalogAuditPage: (countryCode: string, page: number, pageSize: number) =>
      [...queryKeys.pricing.rules(), "catalog-audit-paged", countryCode, page, pageSize] as const,
    geoTierAddonsForCity: (countryCode: string, cityKeySlug: string) =>
      [...queryKeys.pricing.rules(), "geo-tier-addons", countryCode, cityKeySlug] as const,
    visitEstimate: (p: {
      vendorId: string | null;
      dayKey: string | null;
      slotId: string | null;
      panelCount: number;
      capacityKw: number;
      cityKey: string;
      countryCode: string;
    }) =>
      [
        ...queryKeys.pricing.rules(),
        "visit-estimate",
        p.vendorId,
        p.dayKey,
        p.slotId,
        p.panelCount,
        p.capacityKw,
        p.cityKey,
        p.countryCode,
      ] as const,
  },

  bookings: {
    all: () => [...queryKeys.root, "bookings"] as const,
    /** In-progress job(s) for the signed-in technician - drives foreground-only GPS tracking. */
    technicianActiveInProgress: () =>
      [...queryKeys.bookings.all(), "technician", "in-progress-active"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.bookings.all(), "list", filters ?? {}] as const,
    vendorRequests: () => [...queryKeys.bookings.all(), "vendor-requests"] as const,
    /** Full vendor-org booking list for dashboard / history (RLS). */
    vendorBookingsAll: (limit?: number) =>
      [...queryKeys.bookings.all(), "vendor-all", limit ?? "default"] as const,
    vendorBookingsPage: (page: number, pageSize: number) =>
      [...queryKeys.bookings.all(), "vendor-all-paged", page, pageSize] as const,
    adminFallbacks: () => [...queryKeys.bookings.all(), "admin-fallbacks"] as const,
    adminFallbacksPage: (page: number, pageSize: number) =>
      [...queryKeys.bookings.all(), "admin-fallbacks-paged", page, pageSize] as const,
    adminMonitoring: (tab: string, limit?: number) =>
      [...queryKeys.bookings.all(), "admin-monitoring", tab, limit ?? "default"] as const,
    adminMonitoringPage: (tab: string, page: number, pageSize: number) =>
      [...queryKeys.bookings.all(), "admin-monitoring-paged", tab, page, pageSize] as const,
    /** Admin bookings page: one_time vs AMC */
    adminBookingsBucket: (bucket: string, limit?: number) =>
      [...queryKeys.bookings.all(), "admin-bucket", bucket, limit ?? "default"] as const,
    adminBookingsBucketPage: (bucket: string, page: number, pageSize: number) =>
      [...queryKeys.bookings.all(), "admin-bucket-paged", bucket, page, pageSize] as const,
    opsExceptions: (limit?: number) =>
      [...queryKeys.bookings.all(), "ops-exceptions", limit ?? "default"] as const,
    opsExceptionsPage: (page: number, pageSize: number) =>
      [...queryKeys.bookings.all(), "ops-exceptions-paged", page, pageSize] as const,
    notificationInbox: (audience: "admin" | "vendor", limit?: number) =>
      [...queryKeys.bookings.all(), "notification-inbox", audience, limit ?? 40] as const,
    notificationUnreadCount: (audience: "admin" | "vendor") =>
      [...queryKeys.bookings.all(), "notification-unread", audience] as const,
    notificationEvents: (limit?: number) =>
      [...queryKeys.bookings.all(), "notification-events", limit ?? "default"] as const,
    notificationEventsPage: (page: number, pageSize: number) =>
      [...queryKeys.bookings.all(), "notification-events-paged", page, pageSize] as const,
    notificationTemplates: () =>
      [...queryKeys.bookings.all(), "notification-templates"] as const,
    notificationChannelSettings: () =>
      [...queryKeys.bookings.all(), "notification-channel-settings"] as const,
    /** Distinct vendor IDs from the customer's completed bookings (order: most recent visit first). */
    completedVendorIds: () => [...queryKeys.bookings.all(), "customer-completed-vendor-ids"] as const,
    detail: (bookingId: string) => [...queryKeys.bookings.all(), bookingId] as const,
    technicianLastLocation: (bookingId: string) =>
      [...queryKeys.bookings.detail(bookingId), "technician-last-location"] as const,
    withReport: (bookingId: string) =>
      [...queryKeys.bookings.detail(bookingId), "report"] as const,
  },

  jobReports: {
    all: () => [...queryKeys.root, "job-reports"] as const,
    list: (filters?: { limit?: number }) =>
      [...queryKeys.jobReports.all(), "list", filters ?? {}] as const,
    listPage: (page: number, pageSize: number) =>
      [...queryKeys.jobReports.all(), "list-paged", page, pageSize] as const,
    byBooking: (bookingId: string) =>
      [...queryKeys.jobReports.all(), "booking", bookingId] as const,
  },

  subscriptions: {
    all: () => [...queryKeys.root, "subscriptions"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.subscriptions.all(), "list", filters ?? {}] as const,
    detail: (subscriptionId: string) =>
      [...queryKeys.subscriptions.all(), subscriptionId] as const,
    visitSlots: (subscriptionId: string) =>
      [...queryKeys.subscriptions.all(), "visit-slots", subscriptionId] as const,
    renewalCandidates: (daysAhead: number) =>
      [...queryKeys.subscriptions.all(), "renewal-candidates", daysAhead] as const,
  },

  technicians: {
    me: () => [...queryKeys.root, "technicians", "mine"] as const,
    myInvite: () => [...queryKeys.root, "technicians", "my-invite"] as const,
    detail: (technicianId: string) => [...queryKeys.root, "technicians", technicianId] as const,
    directory: () => [...queryKeys.root, "technicians", "directory"] as const,
    directoryPage: (page: number, pageSize: number) =>
      [...queryKeys.root, "technicians", "directory-paged", page, pageSize] as const,
    verificationQueue: () => [...queryKeys.root, "technicians", "verification-queue"] as const,
    jobHistory: (idsKey?: string, vendorId?: string) =>
      [...queryKeys.root, "technicians", "job-history", idsKey ?? "all", vendorId ?? "all"] as const,
    vendorInvites: () => [...queryKeys.root, "technicians", "vendor-invites"] as const,
    vendorRoster: () => [...queryKeys.root, "technicians", "vendor-roster"] as const,
    publicStats: (idsKey?: string) =>
      [...queryKeys.root, "technicians", "public-stats", idsKey ?? "all"] as const,
  },

  support: {
    all: () => [...queryKeys.root, "support"] as const,
    catalog: () => [...queryKeys.support.all(), "catalog"] as const,
    myConversations: () => [...queryKeys.support.all(), "my-conversations"] as const,
    conversation: (id: string) => [...queryKeys.support.all(), "conversation", id] as const,
    messages: (conversationId: string) =>
      [...queryKeys.support.conversation(conversationId), "messages"] as const,
    adminInbox: (statusKey: string) => [...queryKeys.support.all(), "admin-inbox", statusKey] as const,
    deskInbox: (filter: string, agentId: string) =>
      [...queryKeys.support.all(), "desk-inbox", filter, agentId] as const,
    context: (conversationId: string) => [...queryKeys.support.all(), "context", conversationId] as const,
    deskContext: (conversationId: string) =>
      [...queryKeys.support.all(), "desk-context", conversationId] as const,
    macros: () => [...queryKeys.support.all(), "macros"] as const,
    agents: () => [...queryKeys.support.all(), "agents"] as const,
    search: (q: string) => [...queryKeys.support.all(), "search", q] as const,
    customerSearch: (q: string) => [...queryKeys.support.all(), "customer-search", q] as const,
    customerProfile: (customerId: string) =>
      [...queryKeys.support.all(), "customer-profile", customerId] as const,
    insights: () => [...queryKeys.support.all(), "insights"] as const,
    events: (conversationId: string) =>
      [...queryKeys.support.conversation(conversationId), "events"] as const,
    closure: (conversationId: string) =>
      [...queryKeys.support.conversation(conversationId), "closure"] as const,
    attachments: (messageId: string) =>
      [...queryKeys.support.all(), "attachments", messageId] as const,
  },

  customerActivity: {
    all: () => [...queryKeys.root, "customer-activity"] as const,
    forAddress: (serviceAddressId: string) =>
      [...queryKeys.customerActivity.all(), "address", serviceAddressId] as const,
    trackableBooking: (serviceAddressId: string) =>
      [...queryKeys.customerActivity.all(), "trackable", serviceAddressId] as const,
  },

  customers: {
    mine: () => [...queryKeys.root, "customers", "mine"] as const,
    detail: (customerId: string) => [...queryKeys.root, "customers", customerId] as const,
    sitePhotosForBooking: (bookingId: string) =>
      [...queryKeys.root, "customers", "site-photos", bookingId] as const,
  },

  payments: {
    all: () => [...queryKeys.root, "payments"] as const,
    forBooking: (bookingId: string) => [...queryKeys.payments.all(), "booking", bookingId] as const,
  },

  health: {
    ping: () => [...queryKeys.root, "health", "ping"] as const,
  },
} as const;
