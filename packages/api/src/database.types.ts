/**
 * Hand-maintained types for OorjaManDB public schema.
 * Regenerate from the project when convenient: `supabase gen types typescript --project-id <ref>`
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "customer" | "vendor" | "technician" | "admin" | "support";
export type VendorApprovalStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";
export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "vendor_acknowledged"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "paused"
  | "cancelled"
  | "expired"
  | "past_due";
export type SubscriptionBillingPeriod = "monthly" | "quarterly" | "annual" | "custom";
export type JobReportWeather = "clear" | "cloudy" | "windy" | "rain" | "other";
export type TechnicianVerificationStatus = "draft" | "pending_review" | "verified" | "rejected";
export type VendorTechnicianInviteStatus =
  | "invited"
  | "opened"
  | "completed"
  | "expired"
  | "cancelled";

export type PaymentStatus = "pending" | "success" | "failed";

export type VendorSettlementKind = "visit_payout" | "cancellation_penalty";
export type VendorSettlementStatus = "pending_review" | "approved" | "settled" | "waived";

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  locale: string | null;
  timezone: string | null;
  is_active: boolean;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  last_seen_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  contact_email: string | null;
  alternate_phone: string | null;
  billing_address: Json | null;
  service_default_address: Json | null;
  notes: string | null;
  service_lat: number | null;
  service_lng: number | null;
  location_accuracy_m: number | null;
  location_recorded_at: string | null;
  solar_capacity_kw: number | null;
  solar_panel_count: number | null;
  installation_category: "residential" | "commercial" | null;
  solar_roof_type: string | null;
  solar_roof_material: "tin_metal" | "rcc" | "mixed" | "other" | null;
  last_cleaning_at: string | null;
  safety_roof_access: string | null;
  safety_water_availability: string | null;
  safety_hazards: string | null;
  metadata: Json;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorRegistrationIntakeStatus = "draft" | "submitted" | "approved" | "rejected";

export type VendorRegistrationIntakeRow = {
  id: string;
  status: VendorRegistrationIntakeStatus;
  draft_access_token: string;
  form_data: Json;
  step_index: number;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_user_id: string | null;
  created_vendor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorRow = {
  id: string;
  user_id: string;
  business_name: string;
  trade_name: string | null;
  gstin: string | null;
  pan: string | null;
  approval_status: VendorApprovalStatus;
  submitted_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  registered_address: Json | null;
  operating_regions: string[] | null;
  bank_detail_last4: string | null;
  company_type: string | null;
  company_registration_number: string | null;
  website_url: string | null;
  contact_person_name: string | null;
  contact_person_role: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  service_areas: string[] | null;
  experience_summary: string | null;
  years_in_business: number | null;
  equipment_available: string[] | null;
  flag_safety_training: boolean;
  flag_ppe_available: boolean;
  flag_insurance_coverage: boolean;
  doc_pan_url: string | null;
  doc_aadhaar_url: string | null;
  doc_gst_url: string | null;
  doc_bank_proof_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

/** One GPS sample from the technician app (`recorded_at` = capture time on server). */
export type TechnicianLocationRow = {
  id: string;
  technician_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
};

export type TechnicianRow = {
  id: string;
  user_id: string;
  vendor_id: string | null;
  employee_code: string | null;
  skills: string[];
  service_radius_km: number | null;
  home_base_address: Json | null;
  is_verified: boolean;
  is_available: boolean;
  metadata: Json;
  verification_status: TechnicianVerificationStatus;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_rejection_reason: string | null;
  vendor_review_status: "pending" | "approved" | "rejected";
  vendor_reviewed_at: string | null;
  vendor_rejection_reason: string | null;
  date_of_birth: string | null;
  personal_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  aadhaar_last4: string | null;
  pan_number: string | null;
  doc_aadhaar_url: string | null;
  doc_pan_url: string | null;
  experience_summary: string | null;
  years_experience: number | null;
  flag_safety_training: boolean;
  flag_height_work_cert: boolean;
  bank_account_holder_name: string | null;
  bank_account_last4: string | null;
  bank_ifsc: string | null;
  doc_bank_proof_url: string | null;
  preferred_work_locations: string[] | null;
  father_guardian_name: string | null;
  gender: "female" | "male" | "other" | "prefer_not_to_say" | null;
  contact_email: string | null;
  name_as_per_aadhaar: string | null;
  safety_training_org: string | null;
  doc_passport_url: string | null;
  doc_safety_certificate_url: string | null;
  flag_solar_cleaning_experience: boolean;
  other_skills: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorTechnicianInviteRow = {
  id: string;
  vendor_id: string;
  invited_by_user_id: string;
  full_name: string | null;
  invite_phone_e164: string;
  invite_email: string | null;
  invite_token: string;
  invite_url: string | null;
  status: VendorTechnicianInviteStatus;
  notification_channels: string[];
  invited_at: string;
  opened_at: string | null;
  completed_at: string | null;
  last_notified_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type VendorSlotAvailabilityRow = {
  vendor_id: string;
  day_key: string;
  slot_id: string;
  is_available: boolean;
  capacity: number;
  created_at: string;
  updated_at: string;
};

export type NotificationAudience = "admin" | "vendor";

export type CustomerPushTokenRow = {
  id: string;
  user_id: string;
  customer_id: string;
  expo_push_token: string;
  platform: "ios" | "android" | "unknown";
  app_slug: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type TechnicianPushTokenRow = {
  id: string;
  user_id: string;
  technician_id: string;
  expo_push_token: string;
  platform: "ios" | "android" | "unknown";
  app_slug: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type NotificationEventRow = {
  id: string;
  booking_id: string | null;
  recipient_audience: NotificationAudience;
  recipient_vendor_id: string | null;
  read_at: string | null;
  event_type: string;
  channels: Json;
  status: "queued" | "sent" | "failed";
  payload: Json;
  attempt_count: number;
  next_attempt_at: string;
  processed_at: string | null;
  last_error: string | null;
  demo_mode: boolean;
  created_at: string;
};

export type NotificationTemplateRow = {
  id: string;
  event_type: string;
  channel: "in_app" | "email" | "sms" | "whatsapp";
  template_key: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationChannelSettingRow = {
  id: string;
  event_type: string;
  channel: "in_app" | "email" | "sms" | "whatsapp";
  enabled_demo: boolean;
  enabled_live: boolean;
  created_at: string;
  updated_at: string;
};

export type PlatformSettingsRow = {
  id: number;
  default_vendor_id: string | null;
  /** INR paise billed or netted against refund for customer late cancellation. */
  customer_late_cancel_fee_paise: number;
  /** Commission % on partner visit gross when creating visit_payout settlements. */
  vendor_platform_fee_percent: number;
  support_desk_config: Json;
  updated_at: string;
  updated_by: string | null;
};

/** INR paise. Dummy gateway - `booking_id` set after successful checkout. */
export type PaymentRow = {
  id: string;
  booking_id: string | null;
  customer_id: string;
  amount: number;
  status: PaymentStatus;
  /** Channel label or short code (e.g. UPI, Net banking) when paid. */
  payment_method: string | null;
  /** When payment succeeded; null until success. */
  paid_at: string | null;
  created_at: string;
};

export type VendorSettlementRow = {
  id: string;
  booking_id: string;
  vendor_id: string;
  kind: VendorSettlementKind;
  status: VendorSettlementStatus;
  currency: string;
  reference_code: string | null;
  visit_gross_paise: number | null;
  platform_fee_paise: number | null;
  net_payout_paise: number | null;
  penalty_assessed_paise: number | null;
  penalty_final_paise: number | null;
  admin_notes: string | null;
  metadata: Json;
  approved_at: string | null;
  settled_at: string | null;
  approved_by: string | null;
  settled_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Country-scoped tier label (e.g. metro band). */
export type PricingTierRow = {
  id: string;
  country_code: string;
  code: string;
  label: string;
  sort_order: number;
  /** Added to fixed one-time visit catalogue when city maps to this tier. */
  visit_addon_cents: number;
  /** Added to AMC catalogue plan when address city maps to this tier. */
  amc_addon_cents: number;
  created_at: string;
};

/** Maps normalized city name → tier code within a country. */
export type PricingCityTierRow = {
  id: string;
  country_code: string;
  city_key: string;
  state_key: string | null;
  tier_code: string;
  created_at: string;
};

/** INR paise (÷100 for rupees). National default: city + tier_code null. Tier card: tier_code set, city null. Legacy: city set, tier_code null. */
export type PricingRuleRow = {
  id: string;
  country_code: string;
  city: string | null;
  tier_code: string | null;
  base_price: number;
  per_panel_rate: number;
  per_kw_rate: number;
  multiplier: number;
  created_at: string;
};

export type PricingNationalDefaultAuditRow = {
  id: string;
  pricing_rule_id: string | null;
  country_code: string;
  operation: "insert" | "update" | "delete";
  old_snapshot: Json | null;
  new_snapshot: Json | null;
  changed_by: string | null;
  changed_at: string;
};

/** Fixed kW capacity band (3/4/5/6/8/10 — no 7 or 9). */
export type ServiceCapacityTierRow = {
  country_code: string;
  code: string;
  capacity_kw: number;
  typical_panel_count: number;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingOneTimeRateRow = {
  id: string;
  country_code: string;
  capacity_tier_code: string;
  amount_cents: number;
  per_panel_rate_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingAmcPlanRow = {
  id: string;
  country_code: string;
  capacity_tier_code: string;
  plan_code: string;
  plan_name: string;
  contract_months: number;
  visits_included: number;
  visits_per_year: number | null;
  amount_cents: number;
  billing_period: SubscriptionBillingPeriod;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingCatalogAuditRow = {
  id: string;
  table_name: string;
  record_id: string;
  country_code: string;
  operation: "insert" | "update" | "delete";
  old_snapshot: Json | null;
  new_snapshot: Json | null;
  changed_by: string | null;
  changed_at: string;
};

export type SubscriptionRow = {
  id: string;
  customer_id: string;
  /** Saved address book entry id; one active AMC per customer per address. */
  service_address_id: string | null;
  plan_code: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_period: SubscriptionBillingPeriod;
  starts_at: string;
  ends_at: string;
  visits_included: number | null;
  visits_used: number;
  amount_cents: number;
  currency: string;
  renewal_reminder_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  external_provider: string | null;
  external_subscription_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type SubscriptionVisitSlotStatus = "pending" | "scheduled" | "completed" | "cancelled";

export type SupportConversationStatus = "intake" | "queued" | "active" | "resolved";

export type SupportConversationPriority = "normal" | "high" | "urgent";

export type SupportResolutionTag = "resolved" | "escalated" | "duplicate" | "policy_limitation";

export type SupportParticipantAudience = "customer" | "technician";

export type SupportConversationRow = {
  id: string;
  participant_audience: SupportParticipantAudience;
  customer_id: string | null;
  technician_id: string | null;
  category_slug: string;
  subcategory_slug: string;
  status: SupportConversationStatus;
  priority: SupportConversationPriority;
  subject: string | null;
  details_text: string;
  booking_id: string | null;
  subscription_id: string | null;
  service_address_id: string | null;
  assigned_admin_user_id: string | null;
  last_message_at: string;
  last_customer_message_at: string | null;
  last_technician_message_at: string | null;
  first_admin_reply_at: string | null;
  close_reason: string | null;
  resolution_tag: SupportResolutionTag | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  csat_rating: number | null;
  csat_comment: string | null;
  csat_submitted_at: string | null;
  escalated_at: string | null;
  escalation_note: string | null;
  customer_last_read_at: string | null;
  technician_last_read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportAgentRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SupportMessageAttachmentRow = {
  id: string;
  message_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  byte_size: number | null;
  created_at: string;
};

export type SupportMessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_role: "customer" | "technician" | "admin" | "system" | "internal";
  body: string;
  metadata: Json;
  created_at: string;
};

export type SupportConversationEventRow = {
  id: string;
  conversation_id: string;
  actor_user_id: string | null;
  actor_role: "desk" | "customer" | "system";
  event_type: string;
  summary: string;
  metadata: Json;
  created_at: string;
};

export type SupportMacroRow = {
  id: string;
  title: string;
  body: string;
  category_slug: string | null;
  owner_user_id: string | null;
  is_team: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerSiteActivityKind =
  | "booking_created"
  | "booking_status_pending_payment"
  | "booking_status_confirmed"
  | "booking_status_accepted"
  | "booking_status_in_progress"
  | "booking_status_completed"
  | "booking_status_cancelled"
  | "booking_technician_assigned"
  | "booking_rescheduled"
  | "customer_rating_submitted"
  | "amc_subscribed"
  | "amc_upgraded"
  | "amc_visit_scheduled";

export type TechnicianActivityKind =
  | "job_assigned"
  | "job_unassigned"
  | "job_status_pending_payment"
  | "job_status_confirmed"
  | "job_status_accepted"
  | "job_status_in_progress"
  | "job_status_completed"
  | "job_status_cancelled"
  | "job_rescheduled"
  | "customer_rating_received";

export type TechnicianActivityEventRow = {
  id: string;
  technician_id: string;
  kind: string;
  title: string;
  summary: string | null;
  occurred_at: string;
  booking_id: string | null;
  dedupe_key: string;
  payload: Json;
  created_at: string;
};

export type CustomerSiteActivityEventRow = {
  id: string;
  customer_id: string;
  service_address_id: string;
  kind: string;
  title: string;
  summary: string | null;
  occurred_at: string;
  booking_id: string | null;
  subscription_id: string | null;
  dedupe_key: string;
  payload: Json;
  created_at: string;
};

export type SubscriptionVisitSlotRow = {
  id: string;
  subscription_id: string;
  sequence: number;
  ideal_scheduled_start: string;
  ideal_scheduled_end: string;
  status: SubscriptionVisitSlotStatus;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingRow = {
  id: string;
  reference_code: string;
  /** Set when vendor accepts (`VIS-…`). */
  booking_code: string | null;
  customer_id: string;
  vendor_id: string | null;
  technician_id: string | null;
  subscription_id: string | null;
  status: BookingStatus;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  service_site_address: Json;
  service_type: string;
  estimated_price_cents: number;
  final_price_cents: number | null;
  currency: string;
  customer_notes: string | null;
  internal_notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type JobReportRow = {
  id: string;
  booking_id: string;
  technician_id: string | null;
  completed_at: string;
  weather: JobReportWeather | null;
  panel_area_sqm: number | null;
  before_photo_urls: Json;
  after_photo_urls: Json;
  water_tds_ppm: number | null;
  debris_level: string | null;
  anomaly_notes: string | null;
  customer_rating: number | null;
  customer_feedback: string | null;
  feedback_hidden: boolean;
  feedback_hidden_reason: string | null;
  feedback_hidden_at: string | null;
  feedback_hidden_by: string | null;
  checklist: Json;
  signed_off_by: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type OpsBookingExceptionRow = {
  booking_id: string;
  reference_code: string | null;
  status: BookingStatus;
  vendor_id: string | null;
  technician_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  created_at: string;
  issue_type: string | null;
  issue_level: "medium" | "high" | null;
  issue_label: string | null;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          locale?: string | null;
          timezone?: string | null;
          is_active?: boolean;
          phone_verified_at?: string | null;
          email_verified_at?: string | null;
          last_seen_at?: string | null;
          metadata?: Json;
        };
        Update: Partial<Omit<UserRow, "id">>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          contact_email?: string | null;
          alternate_phone?: string | null;
          billing_address?: Json | null;
          service_default_address?: Json | null;
          notes?: string | null;
          service_lat?: number | null;
          service_lng?: number | null;
          location_accuracy_m?: number | null;
          location_recorded_at?: string | null;
          solar_capacity_kw?: number | null;
          solar_panel_count?: number | null;
          installation_category?: "residential" | "commercial" | null;
          solar_roof_type?: string | null;
          solar_roof_material?: "tin_metal" | "rcc" | "mixed" | "other" | null;
          last_cleaning_at?: string | null;
          safety_roof_access?: string | null;
          safety_water_availability?: string | null;
          safety_hazards?: string | null;
          metadata?: Json;
          onboarding_completed_at?: string | null;
        };
        Update: Partial<Omit<CustomerRow, "id">>;
        Relationships: [];
      };
      vendor_registration_intake: {
        Row: VendorRegistrationIntakeRow;
        Insert: {
          id?: string;
          status?: VendorRegistrationIntakeStatus;
          draft_access_token?: string;
          form_data?: Json;
          step_index?: number;
          business_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          submitted_at?: string | null;
          reviewed_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          rejection_reason?: string | null;
          created_user_id?: string | null;
          created_vendor_id?: string | null;
        };
        Update: Partial<Omit<VendorRegistrationIntakeRow, "id" | "created_at">>;
        Relationships: [];
      };
      vendors: {
        Row: VendorRow;
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          trade_name?: string | null;
          gstin?: string | null;
          pan?: string | null;
          approval_status?: VendorApprovalStatus;
          contact_email?: string | null;
          contact_phone?: string | null;
          registered_address?: Json | null;
          operating_regions?: string[] | null;
          bank_detail_last4?: string | null;
          company_type?: string | null;
          company_registration_number?: string | null;
          website_url?: string | null;
          contact_person_name?: string | null;
          contact_person_role?: string | null;
          contact_person_phone?: string | null;
          contact_person_email?: string | null;
          service_areas?: string[] | null;
          experience_summary?: string | null;
          years_in_business?: number | null;
          equipment_available?: string[] | null;
          flag_safety_training?: boolean;
          flag_ppe_available?: boolean;
          flag_insurance_coverage?: boolean;
          doc_pan_url?: string | null;
          doc_aadhaar_url?: string | null;
          doc_gst_url?: string | null;
          doc_bank_proof_url?: string | null;
          metadata?: Json;
          reviewed_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          rejection_reason?: string | null;
        };
        Update: Partial<Omit<VendorRow, "id" | "user_id">>;
        Relationships: [];
      };
      technician_locations: {
        Row: TechnicianLocationRow;
        Insert: {
          id?: string;
          technician_id: string;
          lat: number;
          lng: number;
          recorded_at?: string;
        };
        Update: Partial<Pick<TechnicianLocationRow, "lat" | "lng" | "recorded_at">>;
        Relationships: [];
      };
      technicians: {
        Row: TechnicianRow;
        Insert: {
          id?: string;
          user_id: string;
          vendor_id?: string | null;
          employee_code?: string | null;
          skills?: string[];
          service_radius_km?: number | null;
          home_base_address?: Json | null;
          is_verified?: boolean;
          is_available?: boolean;
          metadata?: Json;
          verification_status?: TechnicianVerificationStatus;
          verification_submitted_at?: string | null;
          verification_reviewed_at?: string | null;
          verification_rejection_reason?: string | null;
          vendor_review_status?: "pending" | "approved" | "rejected";
          vendor_reviewed_at?: string | null;
          vendor_rejection_reason?: string | null;
          date_of_birth?: string | null;
          personal_phone?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          aadhaar_last4?: string | null;
          pan_number?: string | null;
          doc_aadhaar_url?: string | null;
          doc_pan_url?: string | null;
          experience_summary?: string | null;
          years_experience?: number | null;
          flag_safety_training?: boolean;
          flag_height_work_cert?: boolean;
          bank_account_holder_name?: string | null;
          bank_account_last4?: string | null;
          bank_ifsc?: string | null;
          doc_bank_proof_url?: string | null;
          preferred_work_locations?: string[] | null;
          father_guardian_name?: string | null;
          gender?: TechnicianRow["gender"];
          contact_email?: string | null;
          name_as_per_aadhaar?: string | null;
          safety_training_org?: string | null;
          doc_passport_url?: string | null;
          doc_safety_certificate_url?: string | null;
          flag_solar_cleaning_experience?: boolean;
          other_skills?: string | null;
        };
        Update: Partial<Omit<TechnicianRow, "id" | "user_id">>;
        Relationships: [];
      };
      vendor_technician_invites: {
        Row: VendorTechnicianInviteRow;
        Insert: {
          id?: string;
          vendor_id: string;
          invited_by_user_id: string;
          full_name?: string | null;
          invite_phone_e164: string;
          invite_email?: string | null;
          invite_token: string;
          invite_url?: string | null;
          status?: VendorTechnicianInviteStatus;
          notification_channels?: string[];
          invited_at?: string;
          opened_at?: string | null;
          completed_at?: string | null;
          last_notified_at?: string | null;
          metadata?: Json;
        };
        Update: Partial<Omit<VendorTechnicianInviteRow, "id" | "vendor_id" | "invited_by_user_id">>;
        Relationships: [];
      };
      vendor_slot_availability: {
        Row: VendorSlotAvailabilityRow;
        Insert: {
          vendor_id: string;
          day_key: string;
          slot_id: string;
          is_available?: boolean;
          capacity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<VendorSlotAvailabilityRow, "vendor_id" | "day_key" | "slot_id" | "created_at">>;
        Relationships: [];
      };
      notification_events: {
        Row: NotificationEventRow;
        Insert: {
          id?: string;
          booking_id?: string | null;
          recipient_audience?: NotificationAudience;
          recipient_vendor_id?: string | null;
          read_at?: string | null;
          event_type: string;
          channels?: Json;
          status?: "queued" | "sent" | "failed";
          payload?: Json;
          attempt_count?: number;
          next_attempt_at?: string;
          processed_at?: string | null;
          last_error?: string | null;
          demo_mode?: boolean;
          created_at?: string;
        };
        Update: Partial<Omit<NotificationEventRow, "id" | "created_at">>;
        Relationships: [];
      };
      notification_templates: {
        Row: NotificationTemplateRow;
        Insert: {
          id?: string;
          event_type: string;
          channel: "in_app" | "email" | "sms" | "whatsapp";
          template_key: string;
          subject?: string | null;
          body: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<NotificationTemplateRow, "id" | "created_at">>;
        Relationships: [];
      };
      notification_channel_settings: {
        Row: NotificationChannelSettingRow;
        Insert: {
          id?: string;
          event_type: string;
          channel: "in_app" | "email" | "sms" | "whatsapp";
          enabled_demo?: boolean;
          enabled_live?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<NotificationChannelSettingRow, "id" | "created_at">>;
        Relationships: [];
      };
      platform_settings: {
        Row: PlatformSettingsRow;
        Insert: {
          id?: number;
          default_vendor_id?: string | null;
          customer_late_cancel_fee_paise?: number;
          vendor_platform_fee_percent?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Omit<PlatformSettingsRow, "id">>;
        Relationships: [];
      };
      pricing_tiers: {
        Row: PricingTierRow;
        Insert: {
          id?: string;
          country_code?: string;
          code: string;
          label: string;
          sort_order?: number;
          visit_addon_cents?: number;
          amc_addon_cents?: number;
        };
        Update: Partial<Omit<PricingTierRow, "id" | "created_at">>;
        Relationships: [];
      };
      pricing_city_tiers: {
        Row: PricingCityTierRow;
        Insert: {
          id?: string;
          country_code?: string;
          city_key: string;
          state_key?: string | null;
          tier_code: string;
        };
        Update: Partial<Omit<PricingCityTierRow, "id" | "created_at">>;
        Relationships: [];
      };
      pricing_rules: {
        Row: PricingRuleRow;
        Insert: {
          id?: string;
          country_code?: string;
          city?: string | null;
          tier_code?: string | null;
          base_price?: number;
          per_panel_rate?: number;
          per_kw_rate?: number;
          multiplier?: number;
        };
        Update: Partial<Omit<PricingRuleRow, "id" | "created_at">>;
        Relationships: [];
      };
      pricing_national_default_audit: {
        Row: PricingNationalDefaultAuditRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      service_capacity_tiers: {
        Row: ServiceCapacityTierRow;
        Insert: {
          country_code?: string;
          code: string;
          capacity_kw: number;
          typical_panel_count: number;
          label: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Omit<ServiceCapacityTierRow, "country_code" | "code" | "created_at">>;
        Relationships: [];
      };
      pricing_one_time_rates: {
        Row: PricingOneTimeRateRow;
        Insert: {
          id?: string;
          country_code?: string;
          capacity_tier_code: string;
          amount_cents: number;
          per_panel_rate_cents?: number;
          is_active?: boolean;
        };
        Update: Partial<Omit<PricingOneTimeRateRow, "id" | "created_at">>;
        Relationships: [];
      };
      pricing_amc_plans: {
        Row: PricingAmcPlanRow;
        Insert: {
          id?: string;
          country_code?: string;
          capacity_tier_code: string;
          plan_code: string;
          plan_name: string;
          contract_months: number;
          visits_included: number;
          visits_per_year?: number | null;
          amount_cents: number;
          billing_period?: SubscriptionBillingPeriod;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Omit<PricingAmcPlanRow, "id" | "created_at">>;
        Relationships: [];
      };
      pricing_catalog_audit: {
        Row: PricingCatalogAuditRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: {
          id?: string;
          booking_id?: string | null;
          customer_id: string;
          amount: number;
          status?: PaymentStatus;
        };
        Update: Partial<Pick<PaymentRow, "booking_id" | "status" | "payment_method" | "paid_at">>;
        Relationships: [];
      };
      vendor_settlements: {
        Row: VendorSettlementRow;
        Insert: {
          id?: string;
          booking_id: string;
          vendor_id: string;
          kind: VendorSettlementKind;
          status?: VendorSettlementStatus;
          currency?: string;
          reference_code?: string | null;
          visit_gross_paise?: number | null;
          platform_fee_paise?: number | null;
          net_payout_paise?: number | null;
          penalty_assessed_paise?: number | null;
          penalty_final_paise?: number | null;
          admin_notes?: string | null;
          metadata?: Json;
          approved_at?: string | null;
          settled_at?: string | null;
          approved_by?: string | null;
          settled_by?: string | null;
        };
        Update: Partial<Omit<VendorSettlementRow, "id" | "booking_id" | "vendor_id" | "kind" | "created_at">>;
        Relationships: [];
      };
      support_conversations: {
        Row: SupportConversationRow;
        Insert: {
          id?: string;
          participant_audience?: SupportParticipantAudience;
          customer_id?: string | null;
          technician_id?: string | null;
          category_slug: string;
          subcategory_slug: string;
          status?: SupportConversationStatus;
          subject?: string | null;
          details_text: string;
          booking_id?: string | null;
          subscription_id?: string | null;
          service_address_id?: string | null;
          priority?: SupportConversationPriority;
        };
        Update: Partial<Omit<SupportConversationRow, "id" | "created_at">>;
        Relationships: [];
      };
      support_messages: {
        Row: SupportMessageRow;
        Insert: {
          id?: string;
          conversation_id: string;
          sender_user_id?: string | null;
          sender_role: "customer" | "technician" | "admin" | "system" | "internal";
          body: string;
          metadata?: Json;
        };
        Update: never;
        Relationships: [];
      };
      customer_push_tokens: {
        Row: CustomerPushTokenRow;
        Insert: {
          id?: string;
          user_id: string;
          customer_id: string;
          expo_push_token: string;
          platform?: "ios" | "android" | "unknown";
          app_slug?: string;
        };
        Update: Partial<Omit<CustomerPushTokenRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      technician_push_tokens: {
        Row: TechnicianPushTokenRow;
        Insert: {
          id?: string;
          user_id: string;
          technician_id: string;
          expo_push_token: string;
          platform?: "ios" | "android" | "unknown";
          app_slug?: string;
        };
        Update: Partial<Omit<TechnicianPushTokenRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      support_macros: {
        Row: SupportMacroRow;
        Insert: {
          id?: string;
          title: string;
          body: string;
          category_slug?: string | null;
          owner_user_id?: string | null;
          is_team?: boolean;
        };
        Update: Partial<Omit<SupportMacroRow, "id" | "created_at">>;
        Relationships: [];
      };
      support_agents: {
        Row: SupportAgentRow;
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<SupportAgentRow, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      support_message_attachments: {
        Row: SupportMessageAttachmentRow;
        Insert: {
          id?: string;
          message_id: string;
          storage_path: string;
          file_name?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
        };
        Update: never;
        Relationships: [];
      };
      support_conversation_events: {
        Row: SupportConversationEventRow;
        Insert: {
          id?: string;
          conversation_id: string;
          actor_user_id?: string | null;
          actor_role: "desk" | "customer" | "system";
          event_type: string;
          summary: string;
          metadata?: Json;
        };
        Update: never;
        Relationships: [];
      };
      customer_site_activity_events: {
        Row: CustomerSiteActivityEventRow;
        Insert: {
          id?: string;
          customer_id: string;
          service_address_id: string;
          kind: string;
          title: string;
          summary?: string | null;
          occurred_at?: string;
          booking_id?: string | null;
          subscription_id?: string | null;
          dedupe_key: string;
          payload?: Json;
        };
        Update: Partial<Omit<CustomerSiteActivityEventRow, "id" | "customer_id" | "dedupe_key" | "created_at">>;
        Relationships: [];
      };
      technician_activity_events: {
        Row: TechnicianActivityEventRow;
        Insert: {
          id?: string;
          technician_id: string;
          kind: string;
          title: string;
          summary?: string | null;
          occurred_at?: string;
          booking_id?: string | null;
          dedupe_key: string;
          payload?: Json;
        };
        Update: Partial<Omit<TechnicianActivityEventRow, "id" | "technician_id" | "dedupe_key" | "created_at">>;
        Relationships: [];
      };
      subscription_visit_slots: {
        Row: SubscriptionVisitSlotRow;
        Insert: {
          id?: string;
          subscription_id: string;
          sequence: number;
          ideal_scheduled_start: string;
          ideal_scheduled_end: string;
          status?: SubscriptionVisitSlotStatus;
          booking_id?: string | null;
        };
        Update: Partial<
          Pick<
            SubscriptionVisitSlotRow,
            | "ideal_scheduled_start"
            | "ideal_scheduled_end"
            | "status"
            | "booking_id"
          >
        >;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: {
          id?: string;
          customer_id: string;
          service_address_id?: string | null;
          plan_code: string;
          plan_name: string;
          status?: SubscriptionStatus;
          billing_period?: SubscriptionBillingPeriod;
          starts_at: string;
          ends_at: string;
          visits_included?: number | null;
          visits_used?: number;
          amount_cents?: number;
          currency?: string;
          renewal_reminder_at?: string | null;
          cancelled_at?: string | null;
          cancelled_reason?: string | null;
          external_provider?: string | null;
          external_subscription_id?: string | null;
          metadata?: Json;
        };
        Update: Partial<Omit<SubscriptionRow, "id">>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: {
          id?: string;
          reference_code?: string;
          booking_code?: string | null;
          customer_id: string;
          vendor_id?: string | null;
          technician_id?: string | null;
          subscription_id?: string | null;
          status?: BookingStatus;
          scheduled_start: string;
          scheduled_end: string;
          actual_start?: string | null;
          actual_end?: string | null;
          service_site_address: Json;
          service_type?: string;
          estimated_price_cents?: number;
          final_price_cents?: number | null;
          currency?: string;
          customer_notes?: string | null;
          internal_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_by?: string | null;
          metadata?: Json;
        };
        Update: Partial<Omit<BookingRow, "id">>;
        Relationships: [];
      };
      job_reports: {
        Row: JobReportRow;
        Insert: {
          id?: string;
          booking_id: string;
          technician_id?: string | null;
          completed_at?: string;
          weather?: JobReportWeather | null;
          panel_area_sqm?: number | null;
          before_photo_urls?: Json;
          after_photo_urls?: Json;
          water_tds_ppm?: number | null;
          debris_level?: string | null;
          anomaly_notes?: string | null;
          customer_rating?: number | null;
          customer_feedback?: string | null;
          feedback_hidden?: boolean;
          feedback_hidden_reason?: string | null;
          feedback_hidden_at?: string | null;
          feedback_hidden_by?: string | null;
          checklist?: Json;
          signed_off_by?: string | null;
          metadata?: Json;
        };
        Update: Partial<Omit<JobReportRow, "id">>;
        Relationships: [];
      };
    };
    Views: {
      booking_stats: {
        Row: {
          total_bookings: number;
          completed_bookings: number;
          pending_bookings: number;
        };
        Relationships: [];
      };
      revenue_stats: {
        Row: {
          total_revenue_cents: number;
          revenue_per_day: Json | null;
        };
        Relationships: [];
      };
      vendor_stats: {
        Row: {
          vendor_id: string;
          total_jobs: number;
          acceptance_rate: number | null;
          completion_rate: number | null;
          avg_rating: number | null;
          rating_count: number;
          avg_rating_30d: number | null;
          rating_count_30d: number;
        };
        Relationships: [];
      };
      technician_stats: {
        Row: {
          technician_id: string;
          total_jobs: number;
          avg_rating: number | null;
          rating_count: number;
          avg_rating_30d: number | null;
          rating_count_30d: number;
        };
        Relationships: [];
      };
      ops_booking_exceptions: {
        Row: OpsBookingExceptionRow;
        Relationships: [];
      };
      subscription_stats: {
        Row: {
          active_subscriptions: number;
          upcoming_services: number;
        };
        Relationships: [];
      };
      bookings_created_daily: {
        Row: {
          day: string;
          booking_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_vendor_registration_intake: {
        Args: { p_initial_form?: Json };
        Returns: Json;
      };
      get_vendor_registration_intake: {
        Args: { p_id: string; p_token: string };
        Returns: Json;
      };
      update_vendor_registration_intake: {
        Args: {
          p_id: string;
          p_token: string;
          p_form: Json;
          p_step_index: number;
        };
        Returns: undefined;
      };
      submit_vendor_registration_intake: {
        Args: { p_id: string; p_token: string; p_form: Json };
        Returns: undefined;
      };
      vendor_intake_allows_storage_upload: {
        Args: { object_path: string };
        Returns: boolean;
      };
      sync_my_user_from_auth: {
        Args: Record<string, never>;
        Returns: UserRow;
      };
      mark_notification_read: {
        Args: { p_event_id: string };
        Returns: NotificationEventRow;
      };
      mark_all_notifications_read: {
        Args: { p_audience: NotificationAudience };
        Returns: number;
      };
      close_inactive_support_chats_for_customer: {
        Args: { p_customer_id: string };
        Returns: number;
      };
      count_unread_support_messages_for_customer: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_support_conversation_read_by_customer: {
        Args: { p_conversation_id: string };
        Returns: SupportConversationRow;
      };
      count_unread_support_messages_for_technician: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_support_conversation_read_by_technician: {
        Args: { p_conversation_id: string };
        Returns: SupportConversationRow;
      };
      close_inactive_support_chats_for_technician: {
        Args: { p_technician_id: string };
        Returns: number;
      };
      upsert_technician_push_token: {
        Args: { p_expo_push_token: string; p_platform?: string };
        Returns: TechnicianPushTokenRow;
      };
      upsert_customer_push_token: {
        Args: { p_expo_push_token: string; p_platform?: string };
        Returns: CustomerPushTokenRow;
      };
      get_support_desk_insights: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_vendor_public_stats: {
        Args: { p_vendor_ids?: string[] | null };
        Returns: {
          vendor_id: string;
          total_jobs: number;
          acceptance_rate: number | null;
          completion_rate: number | null;
          avg_rating: number | null;
          rating_count: number;
          avg_rating_30d: number | null;
          rating_count_30d: number;
        }[];
      };
      vendor_slot_bookability_batch: {
        Args: {
          p_vendor_id: string;
          p_day_key: string;
          p_slot_ids: string[];
          p_exclude_booking_id?: string | null;
        };
        Returns: { slot_id: string; bookable: boolean }[];
      };
    };
    Enums: {
      user_role: UserRole;
      vendor_approval_status: VendorApprovalStatus;
      vendor_registration_intake_status: VendorRegistrationIntakeStatus;
      booking_status: BookingStatus;
      subscription_status: SubscriptionStatus;
      subscription_billing_period: SubscriptionBillingPeriod;
      job_report_weather: JobReportWeather;
      payment_status: PaymentStatus;
      vendor_technician_invite_status: VendorTechnicianInviteStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
