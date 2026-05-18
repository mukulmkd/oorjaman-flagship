export * from "./client";
export * from "./env";
export * from "./result";
export * from "./page-range";
export * from "./database.types";
export * from "./query-keys";
export { OFFLINE_SCREEN_MESSAGE, OFFLINE_SCREEN_TITLE } from "./connectivity";

export * as authApi from "./auth/auth-api";
export {
  clearInvalidStoredSession,
  dummyEmailFromPhoneE164,
  isDummyAuthEmail,
  isInvalidRefreshTokenError,
  normalizePhoneE164,
  recoverStoredSupabaseSession,
} from "./auth/auth-api";
export {
  AUTH_NETWORK_ERROR_MESSAGE,
  AUTH_SIGN_IN_AGAIN_MESSAGE,
  AUTH_SIGN_IN_AGAIN_TITLE,
  attachMobileAuthSessionGuard,
  handleAuthFailureFromError,
  isTransientNetworkError,
  markUserInitiatedSignOut,
  notifyMobileSessionExpired,
  registerMobileSessionExpiredHandler,
  requiresSignInAgain,
  type MobileAuthSessionGuardHandlers,
} from "./auth/mobile-auth-session";
export * from "./phone-login";
export {
  resolveCustomerAppPostAuthPath,
  resolveTechnicianAppPostAuthPath,
  type CustomerAppPostAuthPath,
  type TechnicianAppPostAuthPath,
} from "./auth/post-auth-routes";
export * as userApi from "./users/user-api";
export * as vendorApi from "./vendors/vendor-api";
export * as vendorIntakeApi from "./vendors/vendor-intake-api";
export {
  VENDOR_INTAKE_ASYNC_ID_KEY,
  VENDOR_INTAKE_ASYNC_TOKEN_KEY,
  VENDOR_INTAKE_SESSION_ID_KEY,
  VENDOR_INTAKE_SESSION_TOKEN_KEY,
} from "./vendors/vendor-intake-api";
export {
  emitVendorApprovalNotificationPlaceholder,
  type VendorApprovalNotificationPlaceholderPayload,
  type VendorApprovalNotificationPlaceholderRecord,
  type VendorApprovalNotificationDecision,
} from "./notifications/vendor-approval-notifications";
export {
  emitTechnicianInviteNotificationPlaceholder,
  type TechnicianInviteChannel,
  type TechnicianInviteNotificationPayload,
  type TechnicianInviteNotificationRecord,
} from "./notifications/technician-invite-notifications";
export {
  emitMarketplaceNotificationEvents,
  readMarketplaceBroadcastFilter,
  type MarketplaceNotificationChannel,
  type MarketplaceNotificationEventType,
} from "./notifications/marketplace-notifications";
export {
  adminListNotificationEvents,
  adminListNotificationEventsPaged,
  adminProcessNotificationQueue,
} from "./notifications/notification-events-api";
export {
  countUnreadInAppNotifications,
  listInAppNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  parseInAppNotificationPayload,
  subscribeInAppNotifications,
  unsubscribeNotificationChannel,
} from "./notifications/notification-inbox-api";
export type { InAppNotificationPayload, NotificationAudience } from "./notifications/booking-notifications";
export {
  adminListNotificationTemplates,
  adminPreviewNotificationTemplate,
  adminUpdateNotificationTemplate,
} from "./notifications/notification-templates-api";
export {
  adminListNotificationChannelSettings,
  adminUpdateNotificationChannelSetting,
} from "./notifications/notification-channel-settings-api";
export {
  createVendorDocumentSignedUrl,
  createVendorIntakeDocumentSignedUrl,
  uploadVendorDocument,
  uploadVendorIntakeDocument,
  VENDOR_DOCS_BUCKET,
  VENDOR_INTAKE_BUCKET,
} from "./vendors/vendor-documents";
export type { VendorDocKind } from "./vendors/vendor-documents";
export {
  listVendorJobReports,
  listVendorPayments,
  listVendorSubscriptions,
} from "./vendors/vendor-dashboard-data";
export * as bookingApi from "./bookings/booking-api";
export {
  CUSTOMER_BOOKING_CANCELLATION_WINDOW_MS,
  HAPPY_CODE_REGENERATE_COOLDOWN_MS,
  VENDOR_BOOKING_RESPONSE_WINDOW_MS,
  VENDOR_CANCEL_REPEAT_LOOKBACK_MS,
  adminFloatDefaultVendorBooking,
  adminAssignVendorToBooking,
  adminFlagBookingOpsIssue,
  adminResetBookingOtpLock,
  adminListOpsBookingExceptions,
  adminRefloatMarketplaceBooking,
  customerCancellationDeadline,
  customerCancellationPenaltyAnchorAt,
  customerCancellationPenaltyEligible,
  customerRegenerateBookingHappyCode,
  customerRescheduleBooking,
  isWithinCustomerCancellationWindow,
  isWithinVendorResponseWindow,
  listVendorBookingRequests,
  listVendorBookingsAll,
  listVendorBookingsAllPaged,
  listVendorMarketplaceBookings,
  readBookingServiceOtpMeta,
  readBookingCustomerCancellationMeta,
  readBookingCustomerCompensationMeta,
  readBookingVendorCancellationPenaltyMeta,
  readBookingVendorReassignmentMeta,
  vendorClaimMarketplaceBooking,
  vendorCancelAcceptedBooking,
  vendorAcceptBookingRequest,
  vendorRejectBookingRequest,
  vendorResponseDeadline,
  type BookingServiceOtpMeta,
  type BookingCustomerCancellationMeta,
  type BookingCustomerCompensationMeta,
  type BookingVendorCancellationPenaltyMeta,
  type BookingVendorReassignmentMeta,
  type OpsIssueType,
  type VendorAcceptBookingInput,
} from "./bookings/booking-api";
export * from "./bookings/customer-booking-payload";
export * from "./bookings/vendor-fallback";
export {
  getBookingRoutingDefaults,
  adminGetPlatformSettings,
  adminSetDefaultVendor,
  adminUpdatePlatformSettings,
} from "./platform/platform-settings-api";
export {
  adminGetBookingMonitoringRows,
  adminGetBookingMonitoringRowsPaged,
  adminGetBookingsMonitoringBySubscriptionBucket,
  adminGetBookingsMonitoringBySubscriptionBucketPaged,
  adminListBookingsForMonitoring,
  adminListBookingsForMonitoringPaged,
  adminListBookingsBySubscriptionBucket,
  adminListBookingsBySubscriptionBucketPaged,
  adminListFallbackBookings,
  adminListFallbackBookingsPaged,
  adminListOpsBookingExceptionsPaged,
  adminNotifyVendorFallbackReadiness,
  bookingUsedFallbackVendor,
  vendorConfirmTechnicianReadinessForFallback,
  type AdminBookingMonitorTab,
  type AdminBookingsSubscriptionBucket,
  type BookingMonitoringEnriched,
} from "./bookings/booking-api";
export {
  adminFetchBookingStats,
  adminFetchBookingsCreatedDaily,
  adminFetchRevenueStats,
  adminFetchSubscriptionStats,
  adminFetchVendorPerformance,
  analyticsIstInclusiveDateRangeAscending,
  analyticsPadBookingDailySeries,
  analyticsPadRevenueDailySeries,
  type BookingStatsRow,
  type BookingsCreatedDailyRow,
  type RevenueDayPoint,
  type SubscriptionStatsRow,
  type VendorPerformanceRow,
} from "./admin/analytics-api";
export * as technicianApi from "./technicians/technician-api";
export {
  JOB_EVIDENCE_PHOTOS_BUCKET,
  type JobEvidencePhotoPhase,
} from "./technicians/job-evidence";
export {
  createTechnicianDocumentSignedUrl,
  TECHNICIAN_DOCS_BUCKET,
  uploadTechnicianDocument,
} from "./technicians/technician-documents";
export type { TechnicianDocKind } from "./technicians/technician-documents";
export * as subscriptionApi from "./subscriptions/subscription-api";
export {
  bookingMatchesSubscriptionAddress,
  getActiveSubscriptionForAddress,
  getRenewalDueSubscriptionForAddress,
  isSubscriptionActive,
  isSubscriptionContractEnded,
  readSubscriptionServiceAddressId,
  subscriptionAddressLabel,
} from "./subscriptions/subscription-address";
export {
  getServiceAddressEntry,
  MAX_SITE_PHOTOS_PER_ADDRESS,
  countRawSitePhotoArray,
  parseSitePhotoRecords,
  readServiceAddressBook,
  serviceAddressFormatted,
  type ServiceAddressEntry,
  type SitePhotoRecord,
} from "./customers/service-address-book";
export type { AmcPlanFromCatalog, AmcSelectablePeriod } from "./subscriptions/amc-presets";
export {
  AMC_CONTRACT_MONTHS_DEFAULT,
  amcPlanFromCatalogRow,
  computeContractEndsAtIso,
  formatInrFromCents,
} from "./subscriptions/amc-presets";
export {
  adminListPricingCatalogAudit,
  adminListPricingCatalogAuditPaged,
  adminSavePricingAmcPlan,
  adminSavePricingOneTimeRate,
  getPricingAmcPlanByCode,
  listPricingAmcPlans,
  listPricingOneTimeRates,
  listServiceCapacityTiers,
  quoteOneTimeServicePrice,
  type OneTimeCapacityQuote,
  type SaveAmcPlanInput,
  type SaveOneTimeRateInput,
} from "./pricing/capacity-pricing-api";
export {
  ALLOWED_CAPACITY_KW,
  formatAmcPlanSubtitle,
  isAllowedCapacityKw,
  isAmcPlanUpgradeFrom,
  listAmcPlansForTier,
  listAmcUpgradePlansForSubscription,
  quoteOneTimeFromCatalog,
  snapCapacityKwToAllowed,
  tierCodeFromCapacityKw,
} from "./pricing/capacity-pricing";
export { computeAmcVisitSlots } from "./subscriptions/amc-booking-generation";
export {
  getAmcVisitSlotById,
  listAmcVisitSlotsForSubscription,
  scheduleAmcVisitSlot,
  syncAmcVisitSlotsForSubscription,
  type ScheduleAmcVisitSlotInput,
} from "./subscriptions/amc-visit-slots";
export {
  customerBookingDisplayTitle,
  customerBookingVisitDateVisible,
  formatAmcVisitLabel,
  isAmcSubscriptionBooking,
  isAmcVisitSlotBookedByCustomer,
  isCustomerScheduledAmcMetadata,
  isLegacyAutoScheduledAmcBooking,
  readAmcVisitSequenceFromMetadata,
  shouldHideAmcBookingFromCustomerList,
} from "./subscriptions/amc-display";
export {
  AMC_CAPACITY_CHANGE_DISCLAIMER,
  customerCapacityTierWillChangeAmc,
  readSubscriptionCapacityTierCode,
  realignActiveAmcSubscriptionsForCustomerCapacity,
  type AmcTierRealignmentSummary,
} from "./subscriptions/amc-tier-realignment";
export { AMC_PLAN_UPGRADE_DISCLAIMER } from "./subscriptions/amc-plan-upgrade";
export type { CustomerProfileUpdateResult } from "./customers/customer-api";
export * as customerApi from "./customers/customer-api";
export * as customerActivityApi from "./customers/customer-site-activity-api";
export * as supportApi from "./support/support-api";
export type {
  SupportConversationClosureSummary,
  SupportConversationContext,
  SupportConversationEventWithActor,
  SupportConversationWithCustomer,
  SupportDeskAgent,
  SupportDeskCustomerBrief,
  SupportDeskCustomerContext,
  SupportDeskCustomerProfile,
  SupportDeskCustomerSearchHit,
  SupportDeskInsights,
  SupportInboxFilter,
  SupportSlaHints,
} from "./support/support-api";
export type { SupportResolutionTag } from "./database.types";
export {
  SUPPORT_ATTACHMENTS_BUCKET,
  buildSupportConversationClosureSummary,
  computeSupportSlaHints,
  formatSupportCsatStars,
  isSupportDeskRole,
  listSupportConversationEvents,
  getSupportDeskCustomerProfile,
  searchSupportDeskCustomers,
  supportCloseReasonLabel,
  supportResolutionTagLabel,
} from "./support/support-api";
export type { SupportMessageEventKind } from "./support/support-message-events";
export {
  parseSupportMessageEvent,
  supportAgentNameFromMessage,
  supportThreadSubtitleForCustomer,
} from "./support/support-message-events";
export type { SupportCategory, SupportSubcategory } from "./support/support-catalog";
export {
  customerHasSavedSolarSiteDetails,
  formatAllowedCapacityKwList,
  getCustomerSolarSizing,
  parseProfileCapacityKwInput,
  snapProfileCapacityInputToAllowedKw,
  type CustomerSolarSizing,
} from "./customers/customer-solar-sizing";
export {
  CUSTOMER_SITE_PHOTOS_BUCKET,
  bookingShowsSitePhotos,
  buildCustomerSitePhotoStoragePath,
  createCustomerSitePhotoSignedUrl,
  deleteCustomerSitePhotoObject,
  getSitePhotosForBooking,
  patchAddressEntryGps,
  patchAddressEntrySitePhotos,
  readAddressEntryGps,
  readDefaultAddressSiteContext,
  readSitePhotosForCustomerAddress,
  signSitePhotoRecords,
  uploadCustomerSitePhotoBytes,
  type SitePhotoCaptureGeo,
  type SitePhotoWithSignedUrl,
} from "./customers/customer-site-photos";
export * as paymentApi from "./payments/payment-api";
export * from "./vendors/vendor-service-area";
export {
  calculatePrice,
  calculatePriceFromRules,
  listPricingRules,
  listPricingTiers,
  listPricingCityTiers,
  adminListPricingNationalDefaultAudit,
  adminSavePricingRule,
  adminDeletePricingRule,
  adminSavePricingTier,
  adminDeletePricingTier,
  adminSavePricingCityTier,
  adminDeletePricingCityTier,
  adminPatchPricingTierCapacityAddons,
  resolveGeoPricingTierAddons,
  type SavePricingRuleInput,
  type SavePricingTierInput,
  type SavePricingCityTierInput,
  type CalculatePriceOptions,
  type PatchPricingTierCapacityAddonsInput,
  type ResolvedGeoPricingTierAddons,
} from "./pricing/pricing-api";
export {
  resolvePricingRule,
  resolvePricingQuote,
  normalizeCityKey,
  normalizeCountryCode,
  lookupTierCodeForCity,
  calculatePriceFromRule,
  buildCalculatedResult,
  getVisitPriceBreakdown,
  type CalculatePriceInput,
  type CalculatePriceLocation,
  type CalculatedPriceResult,
  type VisitPriceBreakdown,
  type PricingMatchMeta,
} from "./pricing/pricing-engine";
