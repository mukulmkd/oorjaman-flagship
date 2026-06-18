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
export { bootstrapMobileSupabaseAuth } from "./auth/mobile-auth-bootstrap";
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
export { resolvePortalSessionDisplay, loadPortalSessionDisplay, authPhoneFromUser, resolveSignInAccountPhone, resolveSignInAccountEmail } from "./users/session-display";
export * as vendorApi from "./vendors/vendor-api";
export {
  createEmptyCoverageZone,
  coverageZonePinsFromText,
  coverageZonePinsToText,
  DEFAULT_VENDOR_COVERAGE_COUNTRY_CODE,
  flattenCoverageZones,
  mergeCoverageIntoVendorMetadata,
  parseVendorCoverageZones,
  validateVendorCoverageZones,
  VENDOR_COVERAGE_ZONES_METADATA_KEY,
  type VendorServiceCoverageZone,
} from "./vendors/vendor-coverage";
export * as vendorIntakeApi from "./vendors/vendor-intake-api";
export {
  validateVendorIntakeFormJson,
  validateVendorIntakeSignupFull,
  validateVendorIntakeSignupSection,
  type VendorIntakeSignupForm,
  type VendorIntakeSignupSection,
} from "./vendors/vendor-intake-validation";
export {
  VENDOR_INTAKE_ASYNC_ID_KEY,
  VENDOR_INTAKE_ASYNC_TOKEN_KEY,
  VENDOR_INTAKE_SESSION_ID_KEY,
  VENDOR_INTAKE_SESSION_TOKEN_KEY,
} from "./vendors/vendor-intake-api";
export {
  emitMarketplaceNotificationEvents,
  readMarketplaceBroadcastFilter,
  type MarketplaceNotificationChannel,
  type MarketplaceNotificationEventType,
} from "./notifications/marketplace-notifications";
export {
  adminListNotificationEvents,
  adminListNotificationEventsPaged,
  adminCountNotificationEvents,
  adminCountQueuedNotificationEvents,
  adminProcessNotificationQueue,
} from "./notifications/notification-events-api";
export {
  adminFetchOpsDeskSummary,
  adminFetchOpsDeskSummaryLight,
  adminListAmcAwaitingPartnerAssignments,
  adminListRecentFailedNotificationEvents,
  buildOpsDeskSummary,
  type OpsAmcAwaitingPartnerRow,
  type OpsDeskSummary,
  type OpsDeskSummaryLight,
} from "./operations/ops-desk-api";
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
  adminAmcAwaitingPartnerCopy,
  customerAmcPartnerAssignedCopy,
  emitAdminAmcAwaitingPartnerNotification,
  type AdminAmcNotificationEventType,
  type AmcInAppNotificationPayload,
} from "./notifications/amc-notifications";
export {
  adminListNotificationTemplates,
  adminPreviewNotificationTemplate,
  adminUpdateNotificationTemplate,
} from "./notifications/notification-templates-api";
export {
  adminListNotificationChannelSettings,
  adminUpdateNotificationChannelSetting,
} from "./notifications/notification-channel-settings-api";
export * as customerPushApi from "./notifications/customer-push-api";
export * as technicianPushApi from "./notifications/technician-push-api";
export type { CustomerPushPlatform, CustomerPushTokenRow } from "./notifications/customer-push-api";
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
  adminReassignAmcBookingVendor,
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
export {
  allocateNumericHappyCode,
  allocateNumericVisitCode,
  normalizeServiceOtpCode,
} from "./bookings/service-otp-codes";
export {
  adminNotifyOverdueVendorResponses,
  isBookingAwaitingAdminFloat,
  postBookingConfirmedNotifications,
} from "./bookings/booking-confirm-notifications";
export * from "./bookings/customer-booking-payload";
export {
  getCustomerBookingTechnicianProfile,
  isBookingGpsTrackable,
  type CustomerBookingTechnicianProfile,
} from "./bookings/customer-technician-profile";
export * from "./bookings/vendor-fallback";
export {
  DEFAULT_VENDOR_PLATFORM_FEE_PERCENT,
  getBookingRoutingDefaults,
  getVendorPlatformFeePercent,
  normalizeVendorPlatformFeePercent,
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
  type AdminFallbackRoutingFilter,
  adminListOpsBookingExceptionsPaged,
  type OpsExceptionsQueueFilter,
  getBookingById,
  adminNotifyVendorFallbackReadiness,
  bookingUsedFallbackVendor,
  vendorConfirmTechnicianReadinessForFallback,
  type AdminBookingMonitorTab,
  type AdminBookingsSubscriptionBucket,
  type AdminBookingsStatusFilter,
  type BookingMonitoringEnriched,
} from "./bookings/booking-api";
export {
  adminFetchBookingStats,
  adminFetchBookingsCreatedDaily,
  adminFetchRecognizedRevenueStats,
  adminFetchFinanceDashboardStats,
  adminFetchPaymentStats,
  adminFetchSubscriptionStats,
  adminFetchVendorPerformance,
  ANALYTICS_BUSINESS_PERIOD_LABELS,
  ANALYTICS_MAX_DAILY_FETCH_DAYS,
  ANALYTICS_PERIOD_BUCKET_COUNT,
  ANALYTICS_PERIOD_DAY_WINDOW,
  analyticsBuildBusinessPeriodSeries,
  analyticsFormatPeriodAxisLabel,
  analyticsIstInclusiveDateRangeAscending,
  analyticsIstMonthKeysAscending,
  analyticsIstQuarterKeysAscending,
  analyticsPadBookingDailySeries,
  analyticsPadRevenueDailySeries,
  analyticsPeriodChartSubtitle,
  type AnalyticsBusinessPeriod,
  type AnalyticsPeriodSeriesPoint,
  type FinanceDashboardStats,
  type RecognizedRevenueStats,
  type BookingStatsRow,
  type BookingsCreatedDailyRow,
  type RevenueDayPoint,
  type SubscriptionStatsRow,
  type VendorPerformanceRow,
} from "./admin/analytics-api";
export * as technicianApi from "./technicians/technician-api";
export * as technicianActivityApi from "./technicians/technician-activity-api";
export {
  isTechnicianActivityExecutable,
  listTechnicianActivityPage,
  readTechnicianActivityBookingStatus,
  readTechnicianActivityReferenceCode,
  subscribeTechnicianActivity,
  type TechnicianActivityEventRow,
  type TechnicianActivityKind,
  type TechnicianActivityPage,
} from "./technicians/technician-activity-api";
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
export {
  inviteFullNameByPhone,
  inviteFullNameForTechnician,
  mergeInviteFullNameIntoMetadata,
  technicianAssignOptionLabel,
  technicianDisplayLabel,
  technicianPhoneLookupKey,
  technicianProfileName,
  type TechnicianDisplayExtras,
} from "./technicians/technician-display-name";
export {
  formatTechnicianSkill,
  formatTechnicianSkills,
} from "./technicians/technician-skills-display";
export * as subscriptionApi from "./subscriptions/subscription-api";
export {
  RENEWAL_NUDGE_EVENT_TYPE,
  type RenewalNudgeAudience,
  type RenewalNudgeChannelSummary,
  type RenewalNudgeQueueStats,
  type ScheduleAndSendRenewalNudgesResult,
  type SubscriptionRenewalNudgeCandidate,
} from "./subscriptions/subscription-renewal-nudges-api";
export {
  bookingBelongsToServiceAddress,
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
  computeAmcListPriceFromVisitRate,
  formatAmcPlanSpLabel,
  formatAmcPlanSubtitle,
  isAllowedCapacityKw,
  isAmcPlanUpgradeFrom,
  listAmcPlansForTier,
  listAmcUpgradePlansForSubscription,
  quoteOneTimeFromCatalog,
  snapCapacityKwToAllowed,
  tierCodeFromCapacityKw,
} from "./pricing/capacity-pricing";
export {
  INDIAN_GST_RATE_PERCENT,
  splitGstFromInclusiveTotal,
  type GstInclusiveBreakdown,
} from "./pricing/gst-breakdown";
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
  customerBookingRefModalSubtitle,
  customerBookingVisitDateVisible,
  formatAmcIncludedVisitTitle,
  formatAmcQuarterLabel,
  formatAmcSuggestedVisitWindow,
  formatAmcVisitLabel,
  isAmcSuggestedVisitWindowApproaching,
  isAmcSubscriptionBooking,
  isAmcVisitSlotBookedByCustomer,
  isCustomerScheduledAmcMetadata,
  isLegacyAutoScheduledAmcBooking,
  partitionAmcVisitSlotsForDisplay,
  readAmcVisitSequenceFromMetadata,
  resolveAmcVisitScheduleNudge,
  shouldHideAmcBookingFromCustomerList,
  summarizeAmcVisitAllowances,
  type AmcVisitAllowanceSummary,
  type AmcVisitScheduleNudge,
} from "./subscriptions/amc-display";
export {
  amcAllowanceExhaustedPromptMessage,
  amcAwaitingPartnerAssignmentMessage,
  amcNoPlanPromptMessage,
  bookVisitRequiresAmcChoiceGate,
  isAmcAwaitingPartnerAssignment,
  amcVisitBookingGateMessage,
  countAmcVisitsConsumedAtAddress,
  countOneTimeVisitsAtAddressDuringAmc,
  customerMayBookOneTimeVisit,
  customerMustUseAmcBookingFlow,
  assertCustomerMayBookOneTimeVisit,
  listPendingAmcVisitSlots,
  readServiceAddressIdFromBookingMetadata,
  resolveAmcVisitBookingGate,
  resolveAmcVisitBookingGateForAddress,
  subscriptionAddressIdForGate,
  type AmcAwaitingPartnerAssignmentGate,
  type AmcVisitBookingGate,
} from "./subscriptions/amc-visit-booking-eligibility";
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
  SupportConversationWithParticipant,
  SupportDeskAgent,
  SupportDeskCustomerBrief,
  SupportDeskCustomerContext,
  SupportDeskTechnicianContext,
  SupportInboxAudienceFilter,
  SupportParticipantAudience,
  SupportDeskCustomerProfile,
  SupportDeskCustomerSearchHit,
  SupportDeskTechnicianBrief,
  SupportDeskTechnicianProfile,
  SupportDeskTechnicianSearchHit,
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
  getSupportDeskTechnicianProfile,
  isTechnicianSupportConversation,
  searchSupportDeskCustomers,
  searchSupportDeskTechnicians,
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
  AMC_URGENT_CLEANING_SUBCATEGORY_SLUG,
  amcUrgentCleaningSupportHint,
  amcUrgentCleaningSupportPrompt,
} from "./support/support-catalog";
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
export {
  adminAssignAmcSubscriptionVendor,
  adminListAmcContracts,
  amcContractIsReadyForVisits,
  amcContractStatusLabel,
  computeAmcPerVisitAllocPaise,
  ensureAmcContractForSubscription,
  fundAmcContractFromPayment,
  getAmcContractBySubscriptionId,
  listAmcContractEntries,
  releaseAmcContractVisitPayout,
  type AmcContractAdminRow,
  type AmcContractRow,
  type AmcContractStatus,
} from "./finance/amc-contract-api";
export {
  adminBackfillVisitPayoutSettlements,
  adminListVendorSettlements,
  adminUpdateVendorSettlement,
  bookingVisitValuePaise,
  computeVisitPayoutBreakdown,
  visitGrossTaxableValuePaise,
  ensureCancellationPenaltySettlement,
  ensureVisitPayoutSettlement,
  formatInrFromPaise,
  settlementDisplayAmountPaise,
  settlementIsAmcVisit,
  settlementKindLabel,
  settlementStatusLabel,
  settlementVisitChannelLabel,
  vendorListMySettlements,
  vendorSyncCompletedVisitPayoutSettlements,
  type AdminUpdateVendorSettlementInput,
  type VendorSettlementAdminRow,
  type VendorSettlementKind,
  type VendorSettlementStatus,
  type VisitPayoutBreakdown,
} from "./finance/vendor-settlement-api";
export {
  creditsToPaise,
  isVendorCancelInLastHourBeforeSlot,
  OORJAMAN_CREDIT_PAISE,
  OORJAMAN_CREDIT_VALIDITY_MS,
  planOorjamanCreditsRedemption,
  VENDOR_CANCEL_LAST_HOUR_BEFORE_SLOT_MS,
  VENDOR_LAST_HOUR_CANCEL_CUSTOMER_CREDITS,
  type OorjamanCreditsRedemptionPlan,
} from "./finance/customer-credits-policy";
export {
  getCustomerOorjamanCreditsSummary,
  issueVendorLastHourCancelCredits,
  listCustomerOorjamanCreditGrants,
  redeemCustomerOorjamanCredits,
  type CustomerOorjamanCreditsSummary,
} from "./finance/customer-credits-api";
export {
  applyNextVendorDeferredPenaltyOnBooking,
  listPendingVendorDeferredPenalties,
  queueVendorDeferredPenalty,
} from "./finance/vendor-deferred-penalty-api";
export type {
  CustomerOorjamanCreditGrantRow,
  CustomerOorjamanCreditRedemptionRow,
  VendorDeferredPenaltyRow,
} from "./database.types";
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
