import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Json,
  TechnicianRow,
  VendorApprovalStatus,
  VendorRow,
  VendorSlotAvailabilityRow,
} from "../database.types";
import { emitVendorApprovalNotificationPlaceholder } from "../notifications/vendor-approval-notifications";
import { offsetRangeForPage, type PagedParams, type PagedResult } from "../page-range";
import { requireSessionUserId, SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { syncUserDisplayNameFromVendor } from "../users/user-display-name";

/** Full vendor registration payload (insert / update while editable). */
export type VendorRegistrationPayload = {
  business_name: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  registered_address?: Json | null;
  operating_regions?: string[] | null;
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
  bank_detail_last4?: string | null;
  doc_pan_url?: string | null;
  doc_aadhaar_url?: string | null;
  doc_gst_url?: string | null;
  doc_bank_proof_url?: string | null;
  /** Shallow-merged into `vendors.metadata` on insert/update (e.g. logo path, bank form fields). */
  metadata?: Json | null;
};

function mergeVendorMetadata(existing: Json | null | undefined, patch: Json | null | undefined): Json {
  const a =
    typeof existing === "object" && existing !== null && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const b =
    typeof patch === "object" && patch !== null && !Array.isArray(patch)
      ? { ...(patch as Record<string, unknown>) }
      : {};
  return { ...a, ...b } as Json;
}

const DRAFT_BUSINESS_PLACEHOLDER = "Draft partner application";

export type VendorRegistrationDraftSnapshot = {
  form: Json;
  step_index: number;
  saved_at: string;
};

/**
 * Persist wizard progress for partner registration (metadata.registration_draft).
 * Creates a minimal vendor row on first save so the draft survives sign-out.
 */
export async function saveVendorRegistrationDraft(
  client: SupabaseClient<Database>,
  input: { form: Json; stepIndex: number },
): Promise<VendorRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);

  const snapshot: VendorRegistrationDraftSnapshot = {
    form: input.form,
    step_index: input.stepIndex,
    saved_at: new Date().toISOString(),
  };

  const existing = await getMyVendor(client);
  const metaPatch: Json = { registration_draft: snapshot as unknown as Json };

  if (!existing) {
    const businessName =
      typeof input.form === "object" &&
      input.form !== null &&
      !Array.isArray(input.form) &&
      "business_name" in input.form &&
      typeof (input.form as { business_name?: unknown }).business_name === "string"
        ? String((input.form as { business_name: string }).business_name).trim()
        : "";
    const row = payloadToInsert(userId, {
      business_name: businessName || DRAFT_BUSINESS_PLACEHOLDER,
      metadata: metaPatch,
    });
    const { data, error } = await client.from("vendors").insert(row).select().single();
    return takeSingleRow(data, error);
  }

  const merged = mergeVendorMetadata(existing.metadata, metaPatch);
  return updateMyVendorProfile(client, { metadata: merged });
}

function payloadToInsert(
  userId: string,
  input: VendorRegistrationPayload,
): Database["public"]["Tables"]["vendors"]["Insert"] {
  return {
    user_id: userId,
    business_name: input.business_name,
    trade_name: input.trade_name ?? null,
    gstin: input.gstin ?? null,
    pan: input.pan ?? null,
    contact_email: input.contact_email ?? null,
    contact_phone: input.contact_phone ?? null,
    registered_address: input.registered_address ?? null,
    operating_regions: input.operating_regions ?? null,
    company_type: input.company_type ?? null,
    company_registration_number: input.company_registration_number ?? null,
    website_url: input.website_url ?? null,
    contact_person_name: input.contact_person_name ?? null,
    contact_person_role: input.contact_person_role ?? null,
    contact_person_phone: input.contact_person_phone ?? null,
    contact_person_email: input.contact_person_email ?? null,
    service_areas: input.service_areas ?? null,
    experience_summary: input.experience_summary ?? null,
    years_in_business: input.years_in_business ?? null,
    equipment_available: input.equipment_available ?? null,
    flag_safety_training: input.flag_safety_training ?? false,
    flag_ppe_available: input.flag_ppe_available ?? false,
    flag_insurance_coverage: input.flag_insurance_coverage ?? false,
    bank_detail_last4: input.bank_detail_last4 ?? null,
    doc_pan_url: input.doc_pan_url ?? null,
    doc_aadhaar_url: input.doc_aadhaar_url ?? null,
    doc_gst_url: input.doc_gst_url ?? null,
    doc_bank_proof_url: input.doc_bank_proof_url ?? null,
    approval_status: "pending",
    metadata: input.metadata ?? {},
  };
}

function payloadToUpdate(input: VendorRegistrationPayload): Database["public"]["Tables"]["vendors"]["Update"] {
  return {
    business_name: input.business_name,
    trade_name: input.trade_name ?? null,
    gstin: input.gstin ?? null,
    pan: input.pan ?? null,
    contact_email: input.contact_email ?? null,
    contact_phone: input.contact_phone ?? null,
    registered_address: input.registered_address ?? null,
    operating_regions: input.operating_regions ?? null,
    company_type: input.company_type ?? null,
    company_registration_number: input.company_registration_number ?? null,
    website_url: input.website_url ?? null,
    contact_person_name: input.contact_person_name ?? null,
    contact_person_role: input.contact_person_role ?? null,
    contact_person_phone: input.contact_person_phone ?? null,
    contact_person_email: input.contact_person_email ?? null,
    service_areas: input.service_areas ?? null,
    experience_summary: input.experience_summary ?? null,
    years_in_business: input.years_in_business ?? null,
    equipment_available: input.equipment_available ?? null,
    flag_safety_training: input.flag_safety_training ?? false,
    flag_ppe_available: input.flag_ppe_available ?? false,
    flag_insurance_coverage: input.flag_insurance_coverage ?? false,
    bank_detail_last4: input.bank_detail_last4 ?? null,
    doc_pan_url: input.doc_pan_url ?? null,
    doc_aadhaar_url: input.doc_aadhaar_url ?? null,
    doc_gst_url: input.doc_gst_url ?? null,
    doc_bank_proof_url: input.doc_bank_proof_url ?? null,
    submitted_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}

/**
 * Vendor: current user's vendor profile (RLS-scoped).
 */
export async function getMyVendor(
  client: SupabaseClient<Database>,
): Promise<VendorRow | null> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const uid = userData.user?.id;
  if (!uid) return null;

  const { data, error } = await client
    .from("vendors")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function registerVendor(
  client: SupabaseClient<Database>,
  input: VendorRegistrationPayload,
): Promise<VendorRow> {
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) throw new SupabaseApiError(userErr.message, userErr);
  const userId = requireSessionUserId(userData.user?.id);
  const row = payloadToInsert(userId, input);

  const { data, error } = await client.from("vendors").insert(row).select().single();

  const vendor = takeSingleRow(data, error);
  await syncUserDisplayNameFromVendor(client, vendor);
  return vendor;
}

/**
 * Create or update registration for the current user.
 * New rows start as `pending`. Edits allowed when status is `pending` or `rejected`.
 */
export async function submitVendorRegistration(
  client: SupabaseClient<Database>,
  input: VendorRegistrationPayload,
): Promise<VendorRow> {
  const existing = await getMyVendor(client);
  if (!existing) {
    const meta =
      typeof input.metadata === "object" && input.metadata !== null && !Array.isArray(input.metadata)
        ? { ...(input.metadata as Record<string, Json>) }
        : {};
    delete meta.registration_draft;
    return registerVendor(client, { ...input, metadata: meta as Json });
  }

  const canEdit =
    existing.approval_status === "pending" || existing.approval_status === "rejected";
  if (!canEdit) {
    throw new SupabaseApiError(
      "Registration cannot be edited while it is under review or after approval.",
    );
  }

  const mergedInput: VendorRegistrationPayload = {
    ...input,
    metadata: mergeVendorMetadata(existing.metadata, input.metadata ?? {}),
  };
  const metaObj =
    typeof mergedInput.metadata === "object" && mergedInput.metadata !== null && !Array.isArray(mergedInput.metadata)
      ? { ...(mergedInput.metadata as Record<string, Json>) }
      : {};
  delete metaObj.registration_draft;
  mergedInput.metadata = metaObj as Json;

  const updatePayload = payloadToUpdate(mergedInput);
  if (existing.approval_status === "rejected") {
    updatePayload.approval_status = "pending";
    updatePayload.rejection_reason = null;
    updatePayload.reviewed_at = null;
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
  }

  return updateMyVendorProfile(client, updatePayload);
}

export type VendorListFilters = {
  approvalStatus?: VendorApprovalStatus | VendorApprovalStatus[];
  limit?: number;
};

export type VendorPublicStatsRow = Database["public"]["Views"]["vendor_stats"]["Row"];

/**
 * Customer marketplace: approved vendors only (requires RLS allowing select on approved rows).
 */
export async function listApprovedVendors(client: SupabaseClient<Database>): Promise<VendorRow[]> {
  const { data, error } = await client
    .from("vendors")
    .select("*")
    .eq("approval_status", "approved")
    .order("business_name", { ascending: true });

  return takeRows(data, error);
}

/**
 * Vendor job/rating aggregates for marketplace and admin lists.
 * Uses get_vendor_public_stats RPC (approved vendors; platform-wide job counts for customers).
 * Vendors viewing only their own row should query vendor_stats with RLS instead.
 */
export async function listVendorPublicStats(
  client: SupabaseClient<Database>,
  vendorIds?: string[],
): Promise<VendorPublicStatsRow[]> {
  const ids = (vendorIds ?? []).map((x) => x.trim()).filter(Boolean);
  const { data, error } = await client.rpc("get_vendor_public_stats", {
    p_vendor_ids: ids.length > 0 ? ids : null,
  });
  return takeRows(data, error) as VendorPublicStatsRow[];
}

/**
 * Admin: list vendors (optionally filtered by approval status).
 */
/** Admin: single vendor row by id (RLS must allow admin read). */
export async function adminGetVendor(
  client: SupabaseClient<Database>,
  vendorId: string,
): Promise<VendorRow | null> {
  const { data, error } = await client.from("vendors").select("*").eq("id", vendorId).maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data;
}

export async function adminListVendors(
  client: SupabaseClient<Database>,
  filters?: VendorListFilters,
): Promise<VendorRow[]> {
  let q = client.from("vendors").select("*").order("created_at", { ascending: false });

  if (filters?.approvalStatus) {
    const statuses = Array.isArray(filters.approvalStatus)
      ? filters.approvalStatus
      : [filters.approvalStatus];
    q = q.in("approval_status", statuses);
  }

  if (filters?.limit != null) {
    q = q.limit(filters.limit);
  }

  const { data, error } = await q;
  return takeRows(data, error);
}

export async function adminListVendorsPaged(
  client: SupabaseClient<Database>,
  filters: VendorListFilters | undefined,
  params: PagedParams,
): Promise<PagedResult<VendorRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  let q = client.from("vendors").select("*", { count: "exact" }).order("created_at", { ascending: false });

  if (filters?.approvalStatus) {
    const statuses = Array.isArray(filters.approvalStatus)
      ? filters.approvalStatus
      : [filters.approvalStatus];
    q = q.in("approval_status", statuses);
  }

  const { data, error, count } = await q.range(from, to);
  return { rows: takeRows(data, error), total: count ?? 0 };
}

async function promoteVendorUserForApprovedAccess(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from("users")
    .update({ role: "vendor", is_active: true })
    .eq("id", userId);
  if (error) throw new SupabaseApiError(error.message, error);
}

/**
 * Admin: approve or reject vendor.
 *
 * **Approve:** sets `vendors.approval_status = approved` (plus review timestamps), then sets the
 * linked `public.users` row to `role = vendor` and `is_active = true` (vendor portal access).
 *
 * **Reject:** sets `approval_status = rejected` and requires non-empty `rejection_reason`
 * (matches DB CHECK `vendors_rejection_when_rejected`).
 */
export async function adminSetVendorApproval(
  client: SupabaseClient<Database>,
  vendorId: string,
  input:
    | {
        decision: "approved";
        reviewedAt?: string;
        approvedAt?: string;
        approvedByUserId?: string;
      }
    | {
        decision: "rejected";
        rejectionReason: string;
        reviewedAt?: string;
      }
    | {
        decision: "under_review" | "suspended";
        reviewedAt?: string;
        rejectionReason?: string;
      },
): Promise<VendorRow> {
  const { data: userData } = await client.auth.getUser();
  const adminId = userData.user?.id;

  const now = new Date().toISOString();

  const patch: Database["public"]["Tables"]["vendors"]["Update"] = {
    reviewed_at: input.reviewedAt ?? now,
  };

  if (input.decision === "approved") {
    patch.approval_status = "approved";
    patch.approved_at = input.approvedAt ?? now;
    patch.approved_by = input.approvedByUserId ?? adminId ?? null;
    patch.rejection_reason = null;
  } else if (input.decision === "rejected") {
    const reason = input.rejectionReason?.trim() ?? "";
    if (!reason) {
      throw new SupabaseApiError("Rejection reason is required.");
    }
    patch.approval_status = "rejected";
    patch.rejection_reason = reason;
    patch.approved_at = null;
    patch.approved_by = null;
  } else {
    patch.approval_status = input.decision;
    if (input.decision === "suspended" || input.decision === "under_review") {
      patch.rejection_reason = input.rejectionReason ?? null;
    }
  }

  const { data, error } = await client.from("vendors").update(patch).eq("id", vendorId).select().single();
  const vendor = takeSingleRow(data, error);

  if (input.decision === "approved") {
    await promoteVendorUserForApprovedAccess(client, vendor.user_id);
    emitVendorApprovalNotificationPlaceholder({
      vendorId: vendor.id,
      vendorUserId: vendor.user_id,
      decision: "approved",
    });
  } else if (input.decision === "rejected") {
    emitVendorApprovalNotificationPlaceholder({
      vendorId: vendor.id,
      vendorUserId: vendor.user_id,
      decision: "rejected",
    });
  }

  return vendor;
}

/**
 * Vendor: update own registration details while pending / rejected (and general profile fields).
 */
export async function updateMyVendorProfile(
  client: SupabaseClient<Database>,
  patch: Database["public"]["Tables"]["vendors"]["Update"],
): Promise<VendorRow> {
  const existing = await getMyVendor(client);
  if (!existing) {
    throw new Error("No vendor profile for current user");
  }

  const { data, error } = await client
    .from("vendors")
    .update(patch)
    .eq("id", existing.id)
    .select()
    .single();

  const vendor = takeSingleRow(data, error);
  if (patch.business_name !== undefined || patch.trade_name !== undefined) {
    await syncUserDisplayNameFromVendor(client, vendor);
  }
  return vendor;
}

/**
 * Technicians employed by vendor: list (RLS allows vendor to read).
 */
export async function listTechniciansForMyVendor(
  client: SupabaseClient<Database>,
): Promise<TechnicianRow[]> {
  const v = await getMyVendor(client);
  if (!v?.id) return [];

  const { data, error } = await client
    .from("technicians")
    .select("*")
    .eq("vendor_id", v.id)
    .order("created_at", { ascending: false });

  return takeRows(data, error);
}

/** Admin / ops: technicians for any vendor (RLS: admin). */
export async function adminListTechniciansForVendor(
  client: SupabaseClient<Database>,
  vendorId: string,
): Promise<TechnicianRow[]> {
  const { data, error } = await client
    .from("technicians")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  return takeRows(data, error);
}

export type VendorSlotAvailabilityInput = {
  dayKey: string;
  slotId: string;
  isAvailable: boolean;
  capacity?: number | null;
};

export async function listMyVendorSlotAvailability(
  client: SupabaseClient<Database>,
  dayKeys: string[],
): Promise<VendorSlotAvailabilityRow[]> {
  const v = await getMyVendor(client);
  if (!v?.id || dayKeys.length === 0) return [];
  const uniqueDayKeys = [...new Set(dayKeys.map((d) => d.trim()).filter(Boolean))];
  if (uniqueDayKeys.length === 0) return [];
  const { data, error } = await client
    .from("vendor_slot_availability")
    .select("*")
    .eq("vendor_id", v.id)
    .in("day_key", uniqueDayKeys)
    .order("day_key", { ascending: true });
  return takeRows(data, error);
}

export async function upsertMyVendorSlotAvailability(
  client: SupabaseClient<Database>,
  input: VendorSlotAvailabilityInput,
): Promise<VendorSlotAvailabilityRow> {
  const v = await getMyVendor(client);
  if (!v?.id) throw new SupabaseApiError("No vendor profile for this account.");
  const dayKey = input.dayKey.trim();
  const slotId = input.slotId.trim();
  if (!dayKey || !slotId) {
    throw new SupabaseApiError("Day and slot are required.");
  }
  const nextCapacity = Math.max(1, Math.min(20, Math.round(Number(input.capacity ?? 1))));
  const { data, error } = await client
    .from("vendor_slot_availability")
    .upsert(
      {
        vendor_id: v.id,
        day_key: dayKey,
        slot_id: slotId,
        is_available: input.isAvailable,
        capacity: nextCapacity,
      },
      { onConflict: "vendor_id,day_key,slot_id" },
    )
    .select("*")
    .single();
  return takeSingleRow(data, error);
}

export async function vendorSlotBookabilityBatch(
  client: SupabaseClient<Database>,
  input: {
    vendorId: string;
    dayKey: string;
    slotIds: string[];
    excludeBookingId?: string | null;
  },
): Promise<Map<string, boolean>> {
  const dayKey = input.dayKey.trim();
  const slotIds = input.slotIds.map((s) => s.trim()).filter(Boolean);
  if (!dayKey || slotIds.length === 0) return new Map();

  const { data, error } = await client.rpc("vendor_slot_bookability_batch", {
    p_vendor_id: input.vendorId,
    p_day_key: dayKey,
    p_slot_ids: slotIds,
    p_exclude_booking_id: input.excludeBookingId ?? null,
  });
  if (error) throw new SupabaseApiError(error.message, error);

  const m = new Map<string, boolean>();
  for (const row of data ?? []) {
    const r = row as { slot_id?: string; bookable?: boolean };
    if (typeof r.slot_id === "string") m.set(r.slot_id, Boolean(r.bookable));
  }
  return m;
}

export async function isVendorAvailableForSlot(
  client: SupabaseClient<Database>,
  input: {
    vendorId: string;
    dayKey: string;
    slotId: string;
    excludeBookingId?: string | null;
  },
): Promise<boolean> {
  const dayKey = input.dayKey.trim();
  const slotId = input.slotId.trim();
  if (!dayKey || !slotId) return true;
  const map = await vendorSlotBookabilityBatch(client, {
    vendorId: input.vendorId,
    dayKey,
    slotIds: [slotId],
    excludeBookingId: input.excludeBookingId ?? null,
  });
  return map.get(slotId) ?? true;
}
