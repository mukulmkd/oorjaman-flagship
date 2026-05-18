import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, VendorRegistrationIntakeRow, VendorRegistrationIntakeStatus } from "../database.types";
import { SupabaseApiError, takeRows, takeSingleRow } from "../result";
import { offsetRangeForPage, type PagedParams, type PagedResult } from "../page-range";

export type { VendorRegistrationIntakeRow, VendorRegistrationIntakeStatus } from "../database.types";

/** Browser sessionStorage keys for resuming a draft (vendor-web partner signup). */
export const VENDOR_INTAKE_SESSION_ID_KEY = "oorjaman_vendor_intake_id";
export const VENDOR_INTAKE_SESSION_TOKEN_KEY = "oorjaman_vendor_intake_token";

/** Expo / React Native AsyncStorage keys (same string values). */
export const VENDOR_INTAKE_ASYNC_ID_KEY = "oorjaman_vendor_intake_id";
export const VENDOR_INTAKE_ASYNC_TOKEN_KEY = "oorjaman_vendor_intake_token";

export type CreateIntakeResult = { id: string; draft_token: string };

export type GetIntakeDraftResult = {
  form_data: Json;
  step_index: number;
  status: VendorRegistrationIntakeStatus;
} | null;

function parseCreateResult(raw: unknown): CreateIntakeResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SupabaseApiError("Invalid create_vendor_registration_intake response");
  }
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const draft_token = o.draft_token;
  if (typeof id !== "string" || typeof draft_token !== "string") {
    throw new SupabaseApiError("Invalid create_vendor_registration_intake payload");
  }
  return { id, draft_token };
}

function parseGetResult(raw: unknown): GetIntakeDraftResult {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new SupabaseApiError("Invalid get_vendor_registration_intake response");
  }
  const o = raw as Record<string, unknown>;
  const form_data = o.form_data;
  const step_index = o.step_index;
  const status = o.status;
  if (form_data === undefined || typeof step_index !== "number" || typeof status !== "string") {
    throw new SupabaseApiError("Invalid get_vendor_registration_intake payload");
  }
  return {
    form_data: form_data as Json,
    step_index,
    status: status as VendorRegistrationIntakeStatus,
  };
}

export async function createVendorRegistrationIntake(
  client: SupabaseClient<Database>,
  initialForm: Json = {},
): Promise<CreateIntakeResult> {
  const { data, error } = await client.rpc("create_vendor_registration_intake", {
    p_initial_form: initialForm,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return parseCreateResult(data);
}

export async function getVendorRegistrationIntakeDraft(
  client: SupabaseClient<Database>,
  intakeId: string,
  draftToken: string,
): Promise<GetIntakeDraftResult> {
  const { data, error } = await client.rpc("get_vendor_registration_intake", {
    p_id: intakeId,
    p_token: draftToken,
  });
  if (error) throw new SupabaseApiError(error.message, error);
  return parseGetResult(data);
}

export async function updateVendorRegistrationIntakeDraft(
  client: SupabaseClient<Database>,
  intakeId: string,
  draftToken: string,
  input: { form: Json; stepIndex: number },
): Promise<void> {
  const { error } = await client.rpc("update_vendor_registration_intake", {
    p_id: intakeId,
    p_token: draftToken,
    p_form: input.form,
    p_step_index: input.stepIndex,
  });
  if (error) throw new SupabaseApiError(error.message, error);
}

export async function submitVendorRegistrationIntake(
  client: SupabaseClient<Database>,
  intakeId: string,
  draftToken: string,
  finalForm: Json,
): Promise<void> {
  const { error } = await client.rpc("submit_vendor_registration_intake", {
    p_id: intakeId,
    p_token: draftToken,
    p_form: finalForm,
  });
  if (error) throw new SupabaseApiError(error.message, error);
}

export type AdminIntakeListFilters = {
  status?: VendorRegistrationIntakeStatus | VendorRegistrationIntakeStatus[];
  limit?: number;
};

export async function adminListVendorRegistrationIntakes(
  client: SupabaseClient<Database>,
  filters?: AdminIntakeListFilters,
): Promise<VendorRegistrationIntakeRow[]> {
  let q = client
    .from("vendor_registration_intake")
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    q = q.in("status", statuses);
  }

  if (filters?.limit != null) {
    q = q.limit(filters.limit);
  }

  const { data, error } = await q;
  return takeRows<VendorRegistrationIntakeRow>(data as VendorRegistrationIntakeRow[] | null, error);
}

export async function adminListVendorRegistrationIntakesPaged(
  client: SupabaseClient<Database>,
  filters: AdminIntakeListFilters | undefined,
  params: PagedParams,
): Promise<PagedResult<VendorRegistrationIntakeRow>> {
  const { from, to } = offsetRangeForPage(params.page, params.pageSize);
  let q = client
    .from("vendor_registration_intake")
    .select("*", { count: "exact" })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    q = q.in("status", statuses);
  }

  const { data, error, count } = await q.range(from, to);
  return {
    rows: takeRows<VendorRegistrationIntakeRow>(data as VendorRegistrationIntakeRow[] | null, error),
    total: count ?? 0,
  };
}

export async function adminGetVendorRegistrationIntake(
  client: SupabaseClient<Database>,
  intakeId: string,
): Promise<VendorRegistrationIntakeRow | null> {
  const { data, error } = await client
    .from("vendor_registration_intake")
    .select("*")
    .eq("id", intakeId)
    .maybeSingle();
  if (error) throw new SupabaseApiError(error.message, error);
  return data as VendorRegistrationIntakeRow | null;
}

export async function adminRejectVendorRegistrationIntake(
  client: SupabaseClient<Database>,
  intakeId: string,
  rejectionReason: string,
): Promise<VendorRegistrationIntakeRow> {
  const reason = rejectionReason.trim();
  if (!reason) {
    throw new SupabaseApiError("Rejection reason is required.");
  }
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("vendor_registration_intake")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: now,
    })
    .eq("id", intakeId)
    .eq("status", "submitted")
    .select()
    .single();
  return takeSingleRow(data as VendorRegistrationIntakeRow | null, error);
}

/**
 * Approves intake: creates auth user + vendor row (Edge Function, service role).
 */
export async function adminApproveVendorRegistrationIntake(
  client: SupabaseClient<Database>,
  intakeId: string,
): Promise<{ ok: true; vendor_id?: string; user_id?: string } | { ok: false; message: string }> {
  const { data, error } = await client.functions.invoke<{ ok?: boolean; error?: string; vendor_id?: string; user_id?: string }>(
    "approve-vendor-intake",
    { body: { intake_id: intakeId } },
  );
  if (error) {
    return { ok: false, message: error.message };
  }
  if (data && typeof data === "object" && data.ok === false) {
    return { ok: false, message: typeof data.error === "string" ? data.error : "Approval failed." };
  }
  if (data && typeof data === "object" && data.ok === true) {
    return { ok: true, vendor_id: data.vendor_id, user_id: data.user_id };
  }
  return { ok: false, message: "Unexpected response from approve-vendor-intake." };
}
