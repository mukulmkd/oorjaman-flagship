import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingRow,
  Database,
  JobReportRow,
  Json,
  TechnicianLocationRow,
  TechnicianRow,
  VendorTechnicianInviteRow,
  TechnicianVerificationStatus,
  VendorRow,
} from "../database.types";
import {
  requireSessionUserId,
  SupabaseApiError,
  takeRows,
  takeSingleRow,
} from "../result";
import { syncUserDisplayNameFromTechnician } from "../users/user-display-name";
import { mergeInviteFullNameIntoMetadata } from "./technician-display-name";
import {
  offsetRangeForPage,
  type PagedParams,
  type PagedResult,
} from "../page-range";
import {
  getBookingById,
  listVisibleBookings,
  readBookingServiceOtpMeta,
  updateBooking,
  type BookingPatch,
} from "../bookings/booking-api";
import { normalizeServiceOtpCode } from "../bookings/service-otp-codes";
import { ensureVisitPayoutSettlement } from "../finance/vendor-settlement-api";
import {
  adminVisitCompletedCopy,
  adminVisitStartedCopy,
  emitAdminBookingNotification,
  emitVendorBookingNotification,
  vendorVisitCompletedCopy,
  vendorVisitStartedCopy,
} from "../notifications/booking-notifications";
import { lowRatingFollowupInAppCopy } from "../notifications/notification-copy";
import {
  emitTechnicianInviteNotificationPlaceholder,
  type TechnicianInviteChannel,
} from "../notifications/technician-invite-notifications";

export type TechnicianPublicStatsRow =
  Database["public"]["Views"]["technician_stats"]["Row"];

function mergeTechnicianMetadata(
  existing: Json | null | undefined,
  patch: Json | null | undefined,
): Json {
  const a =
    typeof existing === "object" &&
    existing !== null &&
    !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const b =
    typeof patch === "object" && patch !== null && !Array.isArray(patch)
      ? { ...(patch as Record<string, unknown>) }
      : {};
  return { ...a, ...b } as Json;
}

function stripTechnicianRegistrationDraft(meta: Json | null | undefined): Json {
  const o =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? { ...(meta as Record<string, Json>) }
      : {};
  delete o.registration_draft;
  return o as Json;
}

function mergeJobReportChecklist(
  existing: Json | null | undefined,
  incoming: Record<string, unknown> | undefined,
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  const next = incoming ?? {};
  const mergedPre =
    next.pre_start != null &&
    typeof next.pre_start === "object" &&
    !Array.isArray(next.pre_start)
      ? {
          ...(typeof base.pre_start === "object" &&
          base.pre_start !== null &&
          !Array.isArray(base.pre_start)
            ? (base.pre_start as Record<string, unknown>)
            : {}),
          ...(next.pre_start as Record<string, unknown>),
        }
      : base.pre_start;
  return {
    ...base,
    ...next,
    ...(mergedPre !== undefined ? { pre_start: mergedPre } : {}),
  } as Json;
}

export type JobReportUpsertInput = {
  bookingId: string;
  technicianId?: string | null;
  weather?: Database["public"]["Enums"]["job_report_weather"] | null;
  panelAreaSqm?: number | null;
  beforePhotoUrls?: unknown[];
  afterPhotoUrls?: unknown[];
  waterTdsPpm?: number | null;
  debrisLevel?: string | null;
  anomalyNotes?: string | null;
  checklist?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/** Acknowledgements recorded on `job_reports.checklist.pre_start` when the technician starts on-site work. */
export type PreStartSafetyAck = {
  aware_of_safety_measures: boolean;
  reviewed_guidelines: boolean;
  ack_job_start_code: boolean;
  ack_ppe_on_site: boolean;
};

function allPreStartSafetyAcked(ack: PreStartSafetyAck): boolean {
  return (
    ack.aware_of_safety_measures &&
    ack.reviewed_guidelines &&
    ack.ack_job_start_code &&
    ack.ack_ppe_on_site
  );
}

function normalizeCodeInput(value: string): string {
  return normalizeServiceOtpCode(value);
}

function mergeBookingMetadata(
  existing: Json | null | undefined,
  patch: Record<string, Json>,
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Json>) }
      : {};
  return { ...base, ...patch };
}

const OTP_MAX_ATTEMPTS = 3;
const OTP_LOCK_WINDOW_MS = 5 * 60 * 1000;
const HAPPY_CODE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function recordServiceOtpFailure(
  client: SupabaseClient<Database>,
  booking: BookingRow,
  technicianId: string,
  phase: "start" | "happy",
): Promise<{ failCount: number; lockedUntil: string | null }> {
  const otp = readBookingServiceOtpMeta(booking.metadata);
  const nowIso = new Date().toISOString();
  const isStart = phase === "start";
  const currentCount = isStart ? otp.startFailCount : otp.happyFailCount;
  const failCount = currentCount + 1;
  const lockedUntil =
    failCount >= OTP_MAX_ATTEMPTS
      ? new Date(Date.now() + OTP_LOCK_WINDOW_MS).toISOString()
      : null;
  const m =
    booking.metadata &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, Json>)
      : {};
  const rawOtp =
    m.service_otp &&
    typeof m.service_otp === "object" &&
    !Array.isArray(m.service_otp)
      ? (m.service_otp as Record<string, Json>)
      : {};
  const existingAttempts = Array.isArray(rawOtp.failed_attempts)
    ? (rawOtp.failed_attempts as Json[])
    : [];
  const nextAttempts = [
    ...existingAttempts.slice(-9),
    { phase, at: nowIso, technician_id: technicianId } as Json,
  ] as Json;
  const nextServiceOtp = {
    ...rawOtp,
    start_code: otp.startCode,
    happy_code: otp.happyCode,
    start_verified_at: otp.startVerifiedAt,
    completed_with_happy_code_at: otp.completedWithHappyCodeAt,
    start_fail_count: isStart ? failCount : otp.startFailCount,
    start_locked_until: isStart ? lockedUntil : otp.startLockedUntil,
    happy_fail_count: isStart ? otp.happyFailCount : failCount,
    happy_locked_until: isStart ? otp.happyLockedUntil : lockedUntil,
    last_failed_at: nowIso,
    last_failed_phase: phase,
    last_failed_by_technician_id: technicianId,
    failed_attempts: nextAttempts,
  } as Json;
  await updateBooking(client, booking.id, {
    metadata: mergeBookingMetadata(booking.metadata, {
      service_otp: nextServiceOtp,
    }),
  });
  return { failCount, lockedUntil };
}

function buildPreStartChecklistPayload(
  ack: PreStartSafetyAck,
  startSelfieUrl: string,
): Record<string, unknown> {
  const confirmedAt = new Date().toISOString();
  return {
    pre_start: {
      aware_of_safety_measures: ack.aware_of_safety_measures,
      reviewed_guidelines: ack.reviewed_guidelines,
      ack_job_start_code: ack.ack_job_start_code,
      ack_ppe_on_site: ack.ack_ppe_on_site,
      start_selfie_url: startSelfieUrl,
      confirmed_at: confirmedAt,
    },
    version: 2,
  };
}

/**
 * Technician: persist pre-start safety checklist on the job report, then set booking in progress (RLS applies).
 */
export async function technicianStartJob(
  client: SupabaseClient<Database>,
  bookingId: string,
  options: {
    preStartSafety: PreStartSafetyAck;
    startCode?: string | null;
    startSelfieUrl: string;
  },
): Promise<BookingRow> {
  if (!allPreStartSafetyAcked(options.preStartSafety)) {
    throw new SupabaseApiError("Confirm all safety items before starting.");
  }
  const startSelfieUrl = options.startSelfieUrl.trim();
  if (!startSelfieUrl) {
    throw new SupabaseApiError(
      "A start-of-visit selfie is required before starting the job timer.",
    );
  }

  const booking = await getBookingById(client, bookingId);
  if (booking.status !== "accepted") {
    throw new SupabaseApiError(
      booking.status === "in_progress"
        ? "This job has already been started."
        : "This booking can't be started from the field app right now.",
    );
  }
  const technicianId = await requireMyTechnicianId(client);
  const otpMeta = readBookingServiceOtpMeta(booking.metadata);
  if (
    otpMeta.startLockedUntil &&
    Date.now() < new Date(otpMeta.startLockedUntil).getTime()
  ) {
    throw new SupabaseApiError(
      "Job Start Code entry is temporarily locked. Please retry in a few minutes.",
    );
  }
  if (otpMeta.startCode) {
    const provided = normalizeCodeInput(options.startCode ?? "");
    if (!provided)
      throw new SupabaseApiError("Enter the Job Start Code from customer app.");
    if (provided !== otpMeta.startCode) {
      const fail = await recordServiceOtpFailure(
        client,
        booking,
        technicianId,
        "start",
      );
      throw new SupabaseApiError(
        fail.lockedUntil
          ? "Job Start Code locked for 5 minutes due to repeated mismatches."
          : `Job Start Code does not match (${fail.failCount}/${OTP_MAX_ATTEMPTS}).`,
      );
    }
  }

  await upsertJobReport(client, {
    bookingId,
    technicianId,
    beforePhotoUrls: [],
    afterPhotoUrls: [],
    checklist: buildPreStartChecklistPayload(
      options.preStartSafety,
      startSelfieUrl,
    ),
  });

  const now = new Date().toISOString();
  const serviceOtpPatch =
    otpMeta.startCode || otpMeta.happyCode
      ? ({
          start_code: otpMeta.startCode,
          happy_code: otpMeta.happyCode,
          start_verified_at: now,
          completed_with_happy_code_at: otpMeta.completedWithHappyCodeAt,
          start_fail_count: 0,
          start_locked_until: null,
          happy_fail_count: otpMeta.happyFailCount,
          happy_locked_until: otpMeta.happyLockedUntil,
        } as Json)
      : null;
  const updated = await updateBooking(client, bookingId, {
    status: "in_progress",
    actual_start: now,
    technician_id: booking.technician_id ?? technicianId,
    ...(serviceOtpPatch
      ? {
          metadata: mergeBookingMetadata(booking.metadata, {
            service_otp: serviceOtpPatch,
          }),
        }
      : {}),
  });
  const startedCopy = adminVisitStartedCopy(updated);
  await emitAdminBookingNotification(client, {
    booking: updated,
    eventType: "admin_booking_visit_started",
    ...startedCopy,
  });
  if (updated.vendor_id) {
    const vendorStartedCopy = vendorVisitStartedCopy(updated);
    await emitVendorBookingNotification(client, {
      booking: updated,
      eventType: "vendor_booking_visit_started",
      recipientVendorId: updated.vendor_id,
      ...vendorStartedCopy,
    });
  }
  return updated;
}

export async function getMyTechnicianProfile(
  client: SupabaseClient<Database>,
): Promise<TechnicianRow | null> {
  const { data: userData } = await client.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data, error } = await client
    .from("technicians")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  return data ?? null;
}

/** Employer vendor row for the signed-in technician (RLS: own vendor_id). */
export async function getTechnicianEmployerVendor(
  client: SupabaseClient<Database>,
  vendorId: string,
): Promise<VendorRow | null> {
  const { data, error } = await client
    .from("vendors")
    .select("*")
    .eq("id", vendorId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

/** Toggle whether dispatch can assign new visits to this technician. */
export async function updateMyTechnicianAvailability(
  client: SupabaseClient<Database>,
  isAvailable: boolean,
): Promise<TechnicianRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);
  const { data, error } = await client
    .from("technicians")
    .update({ is_available: isAvailable })
    .eq("user_id", userId)
    .select()
    .single();
  return takeSingleRow(data, error);
}

/** Jobs tab and field workflows - platform verified and employer approved. */
export function technicianIsFullyOnboarded(
  tech: TechnicianRow | null | undefined,
): boolean {
  return Boolean(
    tech &&
    tech.verification_status === "verified" &&
    tech.is_verified &&
    tech.vendor_review_status === "approved",
  );
}

/** In-progress onboarding wizard (save & continue later), including draft saved on an otherwise verified row. */
export function technicianHasActiveOnboardingDraft(
  tech: TechnicianRow | null | undefined,
): boolean {
  if (!tech) return false;
  if (tech.verification_status === "draft") return true;
  const meta = tech.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  return Boolean((meta as Record<string, Json>).registration_draft);
}

/**
 * Submitted profile waiting on employer (and possibly platform) review - not the editable draft wizard.
 */
export function technicianShowsPendingReviewScreen(
  tech: TechnicianRow | null | undefined,
): boolean {
  if (!tech || technicianIsFullyOnboarded(tech)) return false;
  if (tech.verification_status === "draft") return false;
  if (tech.vendor_review_status === "rejected") return false;
  return (
    tech.verification_status === "pending_review" ||
    (tech.verification_status === "verified" &&
      tech.is_verified &&
      tech.vendor_review_status === "pending")
  );
}

/** Technician UUID for inserts (`job_reports.technician_id`) - throws when session invalid. */
export async function requireMyTechnicianId(
  client: SupabaseClient<Database>,
): Promise<string> {
  const { data: userData } = await client.auth.getUser();
  const uid = requireSessionUserId(userData.user?.id);

  const { data, error } = await client
    .from("technicians")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  if (!data?.id) throw new SupabaseApiError("Technician profile not found");
  return data.id;
}

/**
 * Technician: share live location with the customer before on-site job start.
 */
export async function technicianMarkEnRoute(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingRow> {
  const technicianId = await requireMyTechnicianId(client);
  const booking = await getBookingById(client, bookingId);

  if (booking.technician_id !== technicianId) {
    throw new SupabaseApiError("You are not assigned to this visit.");
  }
  if (booking.technician_en_route_at) {
    return booking;
  }
  if (booking.status !== "accepted") {
    throw new SupabaseApiError(
      booking.status === "in_progress"
        ? "This job is already in progress on site."
        : "This visit cannot be marked en route right now.",
    );
  }

  const now = new Date().toISOString();
  return updateBooking(client, bookingId, { technician_en_route_at: now });
}

/** Bookings where foreground GPS should be sampled (en route only, before on-site start). */
export async function listMyGpsTrackableBookings(
  client: SupabaseClient<Database>,
): Promise<BookingRow[]> {
  const rows = await listVisibleBookings(client, {
    status: "accepted",
    limit: 10,
  });
  return rows.filter((b) => Boolean(b.technician_en_route_at));
}

/**
 * Record a single GPS sample for the current technician (RLS: own `technician_id` only).
 */
export async function recordTechnicianLocation(
  client: SupabaseClient<Database>,
  input: { lat: number; lng: number; recordedAt?: string },
): Promise<TechnicianLocationRow> {
  const technicianId = await requireMyTechnicianId(client);
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new SupabaseApiError("Invalid coordinates.");
  }
  const row: Database["public"]["Tables"]["technician_locations"]["Insert"] = {
    technician_id: technicianId,
    lat: input.lat,
    lng: input.lng,
    ...(input.recordedAt ? { recorded_at: input.recordedAt } : {}),
  };
  const { data, error } = await client
    .from("technician_locations")
    .insert(row)
    .select()
    .single();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) throw new SupabaseApiError("Location was not saved.");
  return data;
}

export type TechnicianOnboardingPayload = {
  vendor_id: string;
  skills: string[];
  service_radius_km?: number | null;
  home_base_address?: Json | null;
  date_of_birth?: string | null;
  personal_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  aadhaar_last4?: string | null;
  pan_number?: string | null;
  doc_aadhaar_url?: string | null;
  doc_pan_url?: string | null;
  doc_passport_url?: string | null;
  doc_safety_certificate_url?: string | null;
  experience_summary?: string | null;
  years_experience?: number | null;
  flag_safety_training?: boolean;
  flag_height_work_cert?: boolean;
  flag_solar_cleaning_experience?: boolean;
  father_guardian_name?: string | null;
  gender?: TechnicianRow["gender"];
  contact_email?: string | null;
  name_as_per_aadhaar?: string | null;
  safety_training_org?: string | null;
  other_skills?: string | null;
  bank_account_holder_name?: string | null;
  bank_account_last4?: string | null;
  bank_ifsc?: string | null;
  doc_bank_proof_url?: string | null;
  preferred_work_locations?: string[] | null;
  declaration_information_accurate?: boolean;
  declaration_safety_commitment?: boolean;
  safety_ack_pre_start_checklist?: boolean;
  safety_ack_job_start_code?: boolean;
  safety_ack_safety_measures?: boolean;
  safety_ack_reviewed_guidelines?: boolean;
};

export type VendorTechnicianReviewDecision = "approved" | "rejected";

export type VendorTechnicianInviteInput = {
  full_name?: string;
  invite_phone_e164: string;
  invite_email?: string;
  channels?: TechnicianInviteChannel[];
};

function normalizeInvitePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "").trim();
  if (!cleaned) throw new SupabaseApiError("Invite phone is required.");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function createInviteToken(): string {
  return `ti_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function mergeDeclarationIntoMetadata(
  existing: Json | null | undefined,
  input: TechnicianOnboardingPayload,
): Json {
  const stripped = stripTechnicianRegistrationDraft(existing);
  const hasDecl =
    input.declaration_information_accurate != null ||
    input.declaration_safety_commitment != null;
  const hasSafetyAck =
    input.safety_ack_pre_start_checklist != null ||
    input.safety_ack_job_start_code != null ||
    input.safety_ack_safety_measures != null ||
    input.safety_ack_reviewed_guidelines != null;
  if (!hasDecl && !hasSafetyAck) {
    return stripped;
  }
  const o =
    stripped && typeof stripped === "object" && !Array.isArray(stripped)
      ? { ...(stripped as Record<string, Json>) }
      : {};
  const prev =
    o.declarations &&
    typeof o.declarations === "object" &&
    !Array.isArray(o.declarations)
      ? { ...(o.declarations as Record<string, Json>) }
      : {};
  const decl: Record<string, Json> = { ...prev };
  if (input.declaration_information_accurate != null) {
    decl.information_accurate =
      input.declaration_information_accurate as unknown as Json;
  }
  if (input.declaration_safety_commitment != null) {
    decl.safety_commitment =
      input.declaration_safety_commitment as unknown as Json;
  }
  if (hasSafetyAck) {
    decl.safety_acknowledgements = {
      pre_start_checklist: Boolean(input.safety_ack_pre_start_checklist),
      job_start_code: Boolean(input.safety_ack_job_start_code),
      safety_measures: Boolean(input.safety_ack_safety_measures),
      reviewed_guidelines: Boolean(input.safety_ack_reviewed_guidelines),
      recorded_at: new Date().toISOString(),
    } as unknown as Json;
  }
  decl.recorded_at = new Date().toISOString() as unknown as Json;
  return { ...o, declarations: decl as Json } as Json;
}

function payloadToInsert(
  userId: string,
  input: TechnicianOnboardingPayload,
): Database["public"]["Tables"]["technicians"]["Insert"] {
  return {
    user_id: userId,
    vendor_id: input.vendor_id,
    skills: input.skills,
    service_radius_km: input.service_radius_km ?? null,
    home_base_address: input.home_base_address ?? null,
    date_of_birth: input.date_of_birth ?? null,
    personal_phone: input.personal_phone ?? null,
    emergency_contact_name: input.emergency_contact_name ?? null,
    emergency_contact_phone: input.emergency_contact_phone ?? null,
    aadhaar_last4: input.aadhaar_last4 ?? null,
    pan_number: input.pan_number ?? null,
    doc_aadhaar_url: input.doc_aadhaar_url ?? null,
    doc_pan_url: input.doc_pan_url ?? null,
    experience_summary: input.experience_summary ?? null,
    years_experience: input.years_experience ?? null,
    flag_safety_training: input.flag_safety_training ?? false,
    flag_height_work_cert: input.flag_height_work_cert ?? false,
    bank_account_holder_name: input.bank_account_holder_name ?? null,
    bank_account_last4: input.bank_account_last4 ?? null,
    bank_ifsc: input.bank_ifsc ?? null,
    doc_bank_proof_url: input.doc_bank_proof_url ?? null,
    preferred_work_locations: input.preferred_work_locations ?? null,
    father_guardian_name: input.father_guardian_name ?? null,
    gender: input.gender ?? null,
    contact_email: input.contact_email ?? null,
    name_as_per_aadhaar: input.name_as_per_aadhaar?.trim() || null,
    safety_training_org: input.safety_training_org ?? null,
    doc_passport_url: input.doc_passport_url ?? null,
    doc_safety_certificate_url: input.doc_safety_certificate_url ?? null,
    flag_solar_cleaning_experience:
      input.flag_solar_cleaning_experience ?? false,
    other_skills: input.other_skills ?? null,
    metadata: mergeDeclarationIntoMetadata(null, input),
    verification_submitted_at: new Date().toISOString(),
  };
}

function payloadToUpdate(
  input: TechnicianOnboardingPayload,
): Database["public"]["Tables"]["technicians"]["Update"] {
  const now = new Date().toISOString();
  return {
    vendor_id: input.vendor_id,
    skills: input.skills,
    service_radius_km: input.service_radius_km ?? null,
    home_base_address: input.home_base_address ?? null,
    date_of_birth: input.date_of_birth ?? null,
    personal_phone: input.personal_phone ?? null,
    emergency_contact_name: input.emergency_contact_name ?? null,
    emergency_contact_phone: input.emergency_contact_phone ?? null,
    aadhaar_last4: input.aadhaar_last4 ?? null,
    pan_number: input.pan_number ?? null,
    doc_aadhaar_url: input.doc_aadhaar_url ?? null,
    doc_pan_url: input.doc_pan_url ?? null,
    experience_summary: input.experience_summary ?? null,
    years_experience: input.years_experience ?? null,
    flag_safety_training: input.flag_safety_training ?? false,
    flag_height_work_cert: input.flag_height_work_cert ?? false,
    bank_account_holder_name: input.bank_account_holder_name ?? null,
    bank_account_last4: input.bank_account_last4 ?? null,
    bank_ifsc: input.bank_ifsc ?? null,
    doc_bank_proof_url: input.doc_bank_proof_url ?? null,
    preferred_work_locations: input.preferred_work_locations ?? null,
    father_guardian_name: input.father_guardian_name ?? null,
    gender: input.gender ?? null,
    contact_email: input.contact_email ?? null,
    name_as_per_aadhaar: input.name_as_per_aadhaar?.trim() || null,
    safety_training_org: input.safety_training_org ?? null,
    doc_passport_url: input.doc_passport_url ?? null,
    doc_safety_certificate_url: input.doc_safety_certificate_url ?? null,
    flag_solar_cleaning_experience:
      input.flag_solar_cleaning_experience ?? false,
    other_skills: input.other_skills ?? null,
    verification_submitted_at: now,
  };
}

/**
 * Create or update technician profile for the current user (insert or resubmit after rejection).
 * DB trigger forces new rows to `pending_review` / `is_verified = false` for non-admins.
 */
/**
 * Save technician onboarding wizard progress (`metadata.registration_draft`).
 * First save inserts a row with `verification_status = draft` so it is not treated as submitted for review.
 */
async function metadataWithVendorInviteFullName(
  client: SupabaseClient<Database>,
  metadata: Json | null | undefined,
): Promise<Json> {
  const invite = await technicianGetMyInvite(client);
  return mergeInviteFullNameIntoMetadata(metadata, invite?.full_name);
}

export async function saveTechnicianOnboardingDraft(
  client: SupabaseClient<Database>,
  input: { form: Json; stepIndex: number; vendorId?: string | null },
): Promise<TechnicianRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);

  const now = new Date().toISOString();
  const snapshot: Json = {
    form: input.form,
    step: input.stepIndex,
    saved_at: now,
  } as Json;

  const existing = await getMyTechnicianProfile(client);
  const draftPatch: Json = { registration_draft: snapshot };

  if (!existing) {
    const metadata = await metadataWithVendorInviteFullName(client, draftPatch);
    const row: Database["public"]["Tables"]["technicians"]["Insert"] = {
      user_id: userId,
      vendor_id: input.vendorId?.trim() || null,
      skills: [],
      verification_status: "draft",
      metadata,
      verification_submitted_at: null,
    };
    const { data, error } = await client
      .from("technicians")
      .insert(row)
      .select()
      .single();
    return takeSingleRow(data, error);
  }

  const merged = mergeTechnicianMetadata(existing.metadata, draftPatch);
  const metadata = await metadataWithVendorInviteFullName(client, merged);
  const nextVendorId =
    input.vendorId !== undefined
      ? input.vendorId === null
        ? null
        : input.vendorId.trim() || null
      : existing.vendor_id;

  const { data, error } = await client
    .from("technicians")
    .update({
      metadata,
      vendor_id: nextVendorId,
    })
    .eq("id", existing.id)
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function submitTechnicianOnboarding(
  client: SupabaseClient<Database>,
  input: TechnicianOnboardingPayload,
): Promise<TechnicianRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);

  const existing = await getMyTechnicianProfile(client);

  if (!existing) {
    const row = payloadToInsert(userId, input);
    row.metadata = await metadataWithVendorInviteFullName(client, row.metadata);
    const { data, error } = await client
      .from("technicians")
      .insert(row)
      .select()
      .single();
    const created = takeSingleRow(data, error);
    await syncUserDisplayNameFromTechnician(client, created);
    return created;
  }

  if (existing.verification_status === "verified") {
    throw new SupabaseApiError("Profile is already verified.");
  }

  const patch = payloadToUpdate(input);
  patch.vendor_review_status = "pending";
  patch.vendor_reviewed_at = null;
  patch.vendor_rejection_reason = null;
  if (existing.verification_status === "rejected") {
    patch.verification_status = "pending_review";
    patch.verification_rejection_reason = null;
    patch.verification_reviewed_at = null;
    patch.is_verified = false;
  } else if (existing.verification_status === "draft") {
    patch.verification_status = "pending_review";
  }

  patch.metadata = await metadataWithVendorInviteFullName(
    client,
    mergeDeclarationIntoMetadata(existing.metadata, input),
  );

  const { data, error } = await client
    .from("technicians")
    .update(patch)
    .eq("id", existing.id)
    .select()
    .single();
  const upserted = takeSingleRow(data, error);
  await syncUserDisplayNameFromTechnician(client, upserted);
  await markInviteCompletedForCurrentUser(client);
  return upserted;
}

async function markInviteCompletedForCurrentUser(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = userData.user?.id;
  if (!uid) return;
  const { data: userRow, error: userRowErr } = await client
    .from("users")
    .select("phone")
    .eq("id", uid)
    .maybeSingle();
  if (userRowErr) throw new SupabaseApiError(userRowErr.message, userRowErr);
  const phone = userRow?.phone?.trim();
  if (!phone) return;
  const { error } = await client
    .from("vendor_technician_invites")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("invite_phone_e164", phone)
    .in("status", ["invited", "opened"]);
  if (error) throw new SupabaseApiError(error.message, error);
}

export async function vendorInviteTechnician(
  client: SupabaseClient<Database>,
  input: VendorTechnicianInviteInput,
): Promise<VendorTechnicianInviteRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);
  const { data: vendor, error: vendorErr } = await client
    .from("vendors")
    .select("id,approval_status,business_name,trade_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
  if (!vendor?.id || vendor.approval_status !== "approved") {
    throw new SupabaseApiError("Only approved vendors can invite technicians.");
  }
  const token = createInviteToken();
  const inviteUrl = `oorjaman-technician://invite/${token}`;
  const employerLabel =
    vendor.trade_name?.trim() ||
    vendor.business_name?.trim() ||
    "Your employer";
  const row: Database["public"]["Tables"]["vendor_technician_invites"]["Insert"] =
    {
      vendor_id: vendor.id,
      invited_by_user_id: userId,
      full_name: input.full_name?.trim() || null,
      invite_phone_e164: normalizeInvitePhone(input.invite_phone_e164),
      invite_email: input.invite_email?.trim() || null,
      invite_token: token,
      invite_url: inviteUrl,
      status: "invited",
      notification_channels: input.channels?.length
        ? input.channels
        : ["email", "sms", "whatsapp"],
      invited_at: new Date().toISOString(),
      last_notified_at: new Date().toISOString(),
      metadata: {
        employer_business_name: vendor.business_name,
        employer_trade_name: vendor.trade_name,
        employer_display_name: employerLabel,
      },
    };
  const { data, error } = await client
    .from("vendor_technician_invites")
    .insert(row)
    .select()
    .single();
  const invite = takeSingleRow(data, error);
  emitTechnicianInviteNotificationPlaceholder({
    inviteId: invite.id,
    vendorId: invite.vendor_id,
    phoneE164: invite.invite_phone_e164,
    email: invite.invite_email,
    inviteUrl: invite.invite_url ?? inviteUrl,
    channels: (invite.notification_channels as TechnicianInviteChannel[]) ?? [
      "email",
      "sms",
      "whatsapp",
    ],
  });
  return invite;
}

export async function vendorListMyTechnicianInvites(
  client: SupabaseClient<Database>,
): Promise<VendorTechnicianInviteRow[]> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data: vendor, error: vendorErr } = await client
    .from("vendors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
  if (!vendor?.id) return [];
  const { data, error } = await client
    .from("vendor_technician_invites")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false });
  return takeRows(data, error);
}

/**
 * True when the signed-in technician was added by a vendor (invite or existing profile).
 * Used to block self-sign-in before the vendor invites this phone number.
 */
export async function technicianHasVendorOnboardingAccess(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  const tech = await getMyTechnicianProfile(client);
  if (tech) return true;

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = userData.user?.id;
  if (!uid) return false;

  const { data: userRow, error: rowErr } = await client
    .from("users")
    .select("phone")
    .eq("id", uid)
    .maybeSingle();
  if (rowErr) throw new SupabaseApiError(rowErr.message, rowErr);
  const phone = userRow?.phone?.trim();
  if (!phone) return false;

  const { data, error } = await client
    .from("vendor_technician_invites")
    .select("id")
    .eq("invite_phone_e164", phone)
    .in("status", ["invited", "opened", "completed"])
    .limit(1)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return Boolean(data);
}

export async function technicianGetMyInvite(
  client: SupabaseClient<Database>,
): Promise<VendorTechnicianInviteRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data: userRow, error: rowErr } = await client
    .from("users")
    .select("phone")
    .eq("id", uid)
    .maybeSingle();
  if (rowErr) throw new SupabaseApiError(rowErr.message, rowErr);
  const phone = userRow?.phone?.trim();
  if (!phone) return null;
  const { data, error } = await client
    .from("vendor_technician_invites")
    .select("*")
    .eq("invite_phone_e164", phone)
    .in("status", ["invited", "opened"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  if (!data) return null;
  if (data.status === "invited") {
    const { error: updateErr } = await client
      .from("vendor_technician_invites")
      .update({ status: "opened", opened_at: new Date().toISOString() })
      .eq("id", data.id);
    if (updateErr) throw new SupabaseApiError(updateErr.message, updateErr);
    return { ...data, status: "opened", opened_at: new Date().toISOString() };
  }
  return data;
}

export async function vendorReviewTechnicianProfile(
  client: SupabaseClient<Database>,
  technicianId: string,
  input: { decision: VendorTechnicianReviewDecision; reason?: string },
): Promise<TechnicianRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);
  const { data: vendor, error: vendorErr } = await client
    .from("vendors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (vendorErr) throw new SupabaseApiError(vendorErr.message, vendorErr);
  if (!vendor?.id) throw new SupabaseApiError("Vendor profile not found.");
  const { data: technician, error: techErr } = await client
    .from("technicians")
    .select("id,vendor_id")
    .eq("id", technicianId)
    .maybeSingle();
  if (techErr) throw new SupabaseApiError(techErr.message, techErr);
  if (!technician || technician.vendor_id !== vendor.id) {
    throw new SupabaseApiError(
      "Technician does not belong to your organisation.",
    );
  }
  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["technicians"]["Update"] =
    input.decision === "approved"
      ? {
          vendor_review_status: "approved",
          vendor_reviewed_at: now,
          vendor_rejection_reason: null,
        }
      : {
          vendor_review_status: "rejected",
          vendor_reviewed_at: now,
          vendor_rejection_reason:
            input.reason?.trim() || "Profile rejected by vendor.",
        };
  const { data, error } = await client
    .from("technicians")
    .update(patch)
    .eq("id", technicianId)
    .select()
    .single();
  if (error) {
    if (error.message.includes("users row missing")) {
      throw new SupabaseApiError(
        "Cannot update this technician: no public.users row for this account, or the users.role is not technician. " +
          "Have the technician complete sign-in once, or run npm run repair:public-users. " +
          "If the row exists in the dashboard, apply the latest DB migration (assert_user_role_extension security definer).",
        error,
      );
    }
    throw new SupabaseApiError(error.message, error);
  }
  if (data === null) throw new SupabaseApiError("Row not found");
  return data;
}

export type TechnicianListFilters = {
  verificationStatus?:
    | TechnicianVerificationStatus
    | TechnicianVerificationStatus[];
  limit?: number;
};

export async function adminListTechnicians(
  client: SupabaseClient<Database>,
  filters?: TechnicianListFilters,
): Promise<TechnicianRow[]> {
  let q = client
    .from("technicians")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.verificationStatus) {
    const st = Array.isArray(filters.verificationStatus)
      ? filters.verificationStatus
      : [filters.verificationStatus];
    q = q.in("verification_status", st);
  }

  if (filters?.limit != null) q = q.limit(filters.limit);

  const { data, error } = await q;
  return takeRows(data, error);
}

export async function adminListTechniciansPaged(
  client: SupabaseClient<Database>,
  filters: TechnicianListFilters | undefined,
  params: PagedParams,
): Promise<PagedResult<TechnicianRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  let q = client
    .from("technicians")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.verificationStatus) {
    const st = Array.isArray(filters.verificationStatus)
      ? filters.verificationStatus
      : [filters.verificationStatus];
    q = q.in("verification_status", st);
  }

  const { data, error, count } = await q.range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

export async function adminGetTechnician(
  client: SupabaseClient<Database>,
  technicianId: string,
): Promise<TechnicianRow | null> {
  const { data, error } = await client
    .from("technicians")
    .select("*")
    .eq("id", technicianId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export async function adminSetTechnicianVerification(
  client: SupabaseClient<Database>,
  technicianId: string,
  input:
    | { decision: "verified"; reviewedAt?: string }
    | { decision: "rejected"; rejectionReason: string; reviewedAt?: string },
): Promise<TechnicianRow> {
  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["technicians"]["Update"] = {
    verification_reviewed_at: input.reviewedAt ?? now,
  };

  if (input.decision === "verified") {
    patch.verification_status = "verified";
    patch.is_verified = true;
    patch.verification_rejection_reason = null;
  } else {
    patch.verification_status = "rejected";
    patch.is_verified = false;
    patch.verification_rejection_reason = input.rejectionReason;
  }

  const { data, error } = await client
    .from("technicians")
    .update(patch)
    .eq("id", technicianId)
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function technicianCompleteJob(
  client: SupabaseClient<Database>,
  bookingId: string,
  options?: { finalPriceCents?: number | null },
): Promise<BookingRow> {
  const now = new Date().toISOString();
  const patch: BookingPatch = {
    status: "completed",
    actual_end: now,
  };
  if (options?.finalPriceCents != null) {
    patch.final_price_cents = options.finalPriceCents;
  }
  return updateBooking(client, bookingId, patch);
}

/**
 * Persist job report evidence then mark the booking **completed** (`status`, `actual_end` stop the timer).
 */
export async function technicianFinalizeJobReport(
  client: SupabaseClient<Database>,
  bookingId: string,
  input: Omit<JobReportUpsertInput, "bookingId" | "technicianId"> & {
    happyCode?: string | null;
  },
): Promise<{ booking: BookingRow; report: JobReportRow }> {
  const technicianId = await requireMyTechnicianId(client);
  const booking = await getBookingById(client, bookingId);
  if (booking.status !== "in_progress") {
    throw new SupabaseApiError(
      "Happy Code completion is only allowed when the job is in progress.",
    );
  }
  const otpMeta = readBookingServiceOtpMeta(booking.metadata);
  if (
    otpMeta.happyLockedUntil &&
    Date.now() < new Date(otpMeta.happyLockedUntil).getTime()
  ) {
    throw new SupabaseApiError(
      "Happy Code entry is temporarily locked. Please retry in a few minutes.",
    );
  }
  if (booking.actual_start) {
    const ageMs = Date.now() - new Date(booking.actual_start).getTime();
    if (Number.isFinite(ageMs) && ageMs > HAPPY_CODE_MAX_AGE_MS) {
      throw new SupabaseApiError(
        "Happy Code expired for this visit. Ask customer to regenerate from app.",
      );
    }
  }
  if (otpMeta.happyCode) {
    const provided = normalizeCodeInput(input.happyCode ?? "");
    if (!provided)
      throw new SupabaseApiError(
        "Enter Happy Code before completing the visit.",
      );
    if (provided !== otpMeta.happyCode) {
      const fail = await recordServiceOtpFailure(
        client,
        booking,
        technicianId,
        "happy",
      );
      throw new SupabaseApiError(
        fail.lockedUntil
          ? "Happy Code locked for 5 minutes due to repeated mismatches."
          : `Happy Code does not match (${fail.failCount}/${OTP_MAX_ATTEMPTS}).`,
      );
    }
  }
  const report = await upsertJobReport(client, {
    ...input,
    bookingId,
    technicianId,
  });
  const now = new Date().toISOString();
  const serviceOtpPatch =
    otpMeta.startCode || otpMeta.happyCode
      ? ({
          start_code: otpMeta.startCode,
          happy_code: otpMeta.happyCode,
          start_verified_at: otpMeta.startVerifiedAt,
          completed_with_happy_code_at: now,
          happy_fail_count: 0,
          happy_locked_until: null,
        } as Json)
      : null;
  const completed = await updateBooking(client, bookingId, {
    status: "completed",
    actual_end: now,
    technician_id: booking.technician_id ?? technicianId,
    ...(serviceOtpPatch
      ? {
          metadata: mergeBookingMetadata(booking.metadata, {
            service_otp: serviceOtpPatch,
          }),
        }
      : {}),
  });
  const completedCopy = adminVisitCompletedCopy(completed);
  await emitAdminBookingNotification(client, {
    booking: completed,
    eventType: "admin_booking_visit_completed",
    ...completedCopy,
  });
  if (completed.vendor_id) {
    const vendorCompletedCopy = vendorVisitCompletedCopy(completed);
    await emitVendorBookingNotification(client, {
      booking: completed,
      eventType: "vendor_booking_visit_completed",
      recipientVendorId: completed.vendor_id,
      ...vendorCompletedCopy,
    });
  }
  await ensureVisitPayoutSettlement(client, completed);
  return { booking: completed, report };
}

/**
 * Upserts `job_reports.before_photo_urls` / `after_photo_urls` with public Storage URLs.
 * Upload files first (bucket `job-photos`), then call this.
 */
export async function technicianSaveJobPhotoUrls(
  client: SupabaseClient<Database>,
  bookingId: string,
  urls: { beforePhotoUrls: string[]; afterPhotoUrls: string[] },
): Promise<JobReportRow> {
  const technicianId = await requireMyTechnicianId(client);
  return upsertJobReport(client, {
    bookingId,
    technicianId,
    beforePhotoUrls: urls.beforePhotoUrls,
    afterPhotoUrls: urls.afterPhotoUrls,
  });
}

/**
 * Upsert job report (one per booking).
 */
export async function upsertJobReport(
  client: SupabaseClient<Database>,
  input: JobReportUpsertInput,
): Promise<JobReportRow> {
  const { data: existing } = await client
    .from("job_reports")
    .select(
      "id, checklist, anomaly_notes, weather, panel_area_sqm, water_tds_ppm, debris_level, metadata",
    )
    .eq("booking_id", input.bookingId)
    .maybeSingle();

  const checklistJson = existing?.id
    ? mergeJobReportChecklist(existing.checklist, input.checklist)
    : ((input.checklist ?? {}) as Json);

  const row = {
    booking_id: input.bookingId,
    technician_id: input.technicianId ?? null,
    weather: input.weather ?? null,
    panel_area_sqm: input.panelAreaSqm ?? null,
    before_photo_urls: (input.beforePhotoUrls ?? []) as Json,
    after_photo_urls: (input.afterPhotoUrls ?? []) as Json,
    water_tds_ppm: input.waterTdsPpm ?? null,
    debris_level: input.debrisLevel ?? null,
    anomaly_notes: input.anomalyNotes ?? null,
    checklist: checklistJson,
    metadata: (input.metadata ?? {}) as Json,
  };

  if (existing?.id) {
    const merged = {
      ...row,
      anomaly_notes:
        input.anomalyNotes !== undefined
          ? input.anomalyNotes
          : (existing.anomaly_notes ?? null),
      weather:
        input.weather !== undefined
          ? input.weather
          : (existing.weather ?? null),
      panel_area_sqm:
        input.panelAreaSqm !== undefined
          ? input.panelAreaSqm
          : (existing.panel_area_sqm ?? null),
      water_tds_ppm:
        input.waterTdsPpm !== undefined
          ? input.waterTdsPpm
          : (existing.water_tds_ppm ?? null),
      debris_level:
        input.debrisLevel !== undefined
          ? input.debrisLevel
          : (existing.debris_level ?? null),
      metadata:
        input.metadata !== undefined
          ? ((input.metadata ?? {}) as Json)
          : existing.metadata !== undefined
            ? existing.metadata
            : ({} as Json),
    };
    const { data, error } = await client
      .from("job_reports")
      .update(merged)
      .eq("id", existing.id)
      .select()
      .single();
    return takeSingleRow(data, error);
  }

  const { data, error } = await client
    .from("job_reports")
    .insert(row)
    .select()
    .single();
  return takeSingleRow(data, error);
}

export async function getJobReportByBookingId(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<JobReportRow | null> {
  const { data, error } = await client
    .from("job_reports")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export type CustomerFeedbackPatch = Pick<
  Database["public"]["Tables"]["job_reports"]["Update"],
  "customer_rating" | "customer_feedback"
>;

export async function customerUpdateJobReportFeedback(
  client: SupabaseClient<Database>,
  bookingId: string,
  patch: CustomerFeedbackPatch,
): Promise<JobReportRow> {
  const report = await getJobReportByBookingId(client, bookingId);
  if (!report) {
    throw new Error("Job report not found for booking");
  }
  const rating =
    patch.customer_rating == null
      ? null
      : Math.round(Number(patch.customer_rating));
  if (rating != null && (Number.isNaN(rating) || rating < 1 || rating > 5)) {
    throw new SupabaseApiError("Rating must be between 1 and 5.");
  }
  const now = Date.now();
  const completedAtMs = new Date(report.completed_at).getTime();
  if (
    Number.isFinite(completedAtMs) &&
    now - completedAtMs > 24 * 60 * 60 * 1000
  ) {
    throw new SupabaseApiError("Rating edit window closed (24 hours).");
  }
  const safePatch: CustomerFeedbackPatch = {
    customer_rating: rating,
    customer_feedback: patch.customer_feedback?.trim() || null,
  };

  const { data, error } = await client
    .from("job_reports")
    .update(safePatch)
    .eq("id", report.id)
    .select()
    .single();
  const updated = takeSingleRow(data, error);
  if (rating != null && rating <= 2) {
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingNudge, error: existingErr } = await client
      .from("notification_events")
      .select("id")
      .eq("event_type", "low_rating_followup")
      .eq("booking_id", bookingId)
      .gte("created_at", cutoffIso)
      .limit(1);
    if (existingErr)
      throw new SupabaseApiError(existingErr.message, existingErr);
    if (!existingNudge?.length) {
      const booking = await getBookingById(client, bookingId);
      const ref =
        booking.reference_code?.trim() || bookingId.slice(0, 8).toUpperCase();
      const inAppCopy = lowRatingFollowupInAppCopy(ref, rating);
      const { error: queueErr } = await client
        .from("notification_events")
        .insert({
          booking_id: bookingId,
          recipient_audience: "admin",
          recipient_vendor_id: booking.vendor_id,
          event_type: "low_rating_followup",
          channels: ["in_app", "email", "sms", "whatsapp"] as unknown as Json,
          status: "queued",
          payload: {
            booking_id: bookingId,
            reference_code: booking.reference_code,
            title: inAppCopy.title,
            body: inAppCopy.body,
            href: `/dashboard/bookings?highlight=${bookingId}`,
            customer_id: booking.customer_id,
            vendor_id: booking.vendor_id,
            rating,
            feedback: safePatch.customer_feedback ?? "",
            queued_at: new Date().toISOString(),
          } as Json,
          demo_mode: true,
        });
      if (queueErr) throw new SupabaseApiError(queueErr.message, queueErr);
    }
  }
  return updated;
}

export async function listTechnicianPublicStats(
  client: SupabaseClient<Database>,
  technicianIds?: string[],
): Promise<TechnicianPublicStatsRow[]> {
  let q = client.from("technician_stats").select("*");
  const ids = (technicianIds ?? []).map((x) => x.trim()).filter(Boolean);
  if (ids.length > 0) q = q.in("technician_id", ids);
  const { data, error } = await q;
  return takeRows(data, error);
}

/**
 * List job reports visible to current user (via RLS).
 */
export async function listVisibleJobReports(
  client: SupabaseClient<Database>,
  options?: { limit?: number },
): Promise<JobReportRow[]> {
  let q = client
    .from("job_reports")
    .select("*")
    .order("completed_at", { ascending: false });
  if (options?.limit != null) q = q.limit(options.limit);
  const { data, error } = await q;
  return takeRows(data, error);
}

export async function listVisibleJobReportsPaged(
  client: SupabaseClient<Database>,
  params: PagedParams,
): Promise<PagedResult<JobReportRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  const { data, error, count } = await client
    .from("job_reports")
    .select("*", { count: "exact" })
    .order("completed_at", { ascending: false })
    .range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

export async function adminSetJobReportFeedbackModeration(
  client: SupabaseClient<Database>,
  reportId: string,
  input: { hidden: boolean; reason?: string | null },
): Promise<JobReportRow> {
  const { data: userData } = await client.auth.getUser();
  const adminId = requireSessionUserId(userData.user?.id);
  const patch: Database["public"]["Tables"]["job_reports"]["Update"] =
    input.hidden
      ? {
          feedback_hidden: true,
          feedback_hidden_reason:
            input.reason?.trim() || "Hidden by admin moderation.",
          feedback_hidden_at: new Date().toISOString(),
          feedback_hidden_by: adminId,
        }
      : {
          feedback_hidden: false,
          feedback_hidden_reason: null,
          feedback_hidden_at: null,
          feedback_hidden_by: null,
        };
  const { data, error } = await client
    .from("job_reports")
    .update(patch)
    .eq("id", reportId)
    .select("*")
    .single();
  return takeSingleRow(data, error);
}

/** Load booking then report together (two round-trips; fine for React Query `queryFn`). */
export async function getBookingWithReport(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<{ booking: BookingRow; report: JobReportRow | null }> {
  const booking = await getBookingById(client, bookingId);
  const report = await getJobReportByBookingId(client, bookingId);
  return { booking, report };
}

/** Admin / ops: verified field technicians eligible for assignment (Oorjaman crew pool). */
export async function adminListVerifiedTechniciansForAssignment(
  client: SupabaseClient<Database>,
): Promise<TechnicianRow[]> {
  const { data, error } = await client
    .from("technicians")
    .select("*")
    .eq("verification_status", "verified")
    .eq("is_verified", true)
    .order("employee_code", { ascending: true });

  return takeRows(data, error);
}

/** Admin readonly directory: technicians approved by vendor review. */
export async function adminListVendorApprovedTechnicians(
  client: SupabaseClient<Database>,
): Promise<TechnicianRow[]> {
  const { data, error } = await client
    .from("technicians")
    .select("*")
    .eq("vendor_review_status", "approved")
    .order("created_at", { ascending: false });
  return takeRows(data, error);
}

export type AdminTechnicianJobHistoryFilters = {
  technicianIds?: string[];
  vendorId?: string | null;
  limit?: number;
};

/** Admin readonly history: bookings served by approved technicians. */
export async function adminListTechnicianJobHistory(
  client: SupabaseClient<Database>,
  filters?: AdminTechnicianJobHistoryFilters,
): Promise<BookingRow[]> {
  const ids = (filters?.technicianIds ?? [])
    .map((x) => x.trim())
    .filter(Boolean);
  const limit = filters?.limit ?? 300;
  let q = client
    .from("bookings")
    .select("*")
    .not("technician_id", "is", null)
    .order("scheduled_start", { ascending: false })
    .limit(limit);
  if (filters?.vendorId) q = q.eq("vendor_id", filters.vendorId);
  if (ids.length > 0) q = q.in("technician_id", ids);
  const { data, error } = await q;
  return takeRows(data, error);
}
