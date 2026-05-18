/// <reference path="../supabase-edge.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function splitCsv(s: unknown): string[] | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const jwt = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt);
  if (userErr || !user) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: adminRow } = await adminClient.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!adminRow || adminRow.role !== "admin") {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  let body: { intake_id?: string };
  try {
    body = (await req.json()) as { intake_id?: string };
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const intakeId = body.intake_id?.trim();
  if (!intakeId) {
    return json({ ok: false, error: "intake_id required" }, 400);
  }

  const { data: intake, error: intakeErr } = await adminClient
    .from("vendor_registration_intake")
    .select("*")
    .eq("id", intakeId)
    .eq("status", "submitted")
    .maybeSingle();

  if (intakeErr) {
    return json({ ok: false, error: intakeErr.message }, 500);
  }
  if (!intake) {
    return json({ ok: false, error: "Intake not found or not in submitted state" }, 400);
  }

  const form = intake.form_data as Record<string, unknown>;
  const email = String(form.partner_login_email ?? form.contact_email ?? "")
    .trim()
    .toLowerCase();
  const phone = String(form.partner_login_phone_e164 ?? form.partner_login_phone ?? "").trim();

  if (!email || !phone) {
    return json({ ok: false, error: "Intake missing login email or phone" }, 400);
  }

  let newUserId: string | null = null;
  let vendorInsertId: string | null = null;

  try {
    const { data: createdUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      phone,
      email_confirm: true,
      user_metadata: { role: "vendor", phone },
    });

    if (createErr) {
      const msg = createErr.message ?? "Failed to create user";
      if (/already|registered|exists/i.test(msg)) {
        return json({ ok: false, error: "A user with this email or phone may already exist." }, 409);
      }
      return json({ ok: false, error: msg }, 400);
    }

    newUserId = createdUser.user.id;

    await new Promise((r) => setTimeout(r, 300));

    const copyDoc = async (fromPath: string | undefined | null): Promise<string | null> => {
      if (!fromPath || typeof fromPath !== "string") return null;
      const { data: blob, error: dErr } = await adminClient.storage.from("vendor-intake").download(fromPath);
      if (dErr || !blob) return null;
      const lastSeg = fromPath.split("/").pop() ?? "file.bin";
      const newPath = `${newUserId}/${lastSeg}`;
      const buf = await blob.arrayBuffer();
      const { error: uErr } = await adminClient.storage.from("vendor-documents").upload(newPath, buf, {
        upsert: true,
        contentType: blob.type && blob.type !== "" ? blob.type : "application/octet-stream",
      });
      if (uErr) throw uErr;
      return newPath;
    };

    const doc_pan_url = await copyDoc(form.doc_pan_url as string | undefined);
    const doc_aadhaar_url = await copyDoc(form.doc_aadhaar_url as string | undefined);
    const doc_gst_url = await copyDoc(form.doc_gst_url as string | undefined);
    const doc_bank_proof_url = await copyDoc(form.doc_bank_proof_url as string | undefined);

    let logoPath: string | null = null;
    const metaIn = form.metadata;
    if (metaIn && typeof metaIn === "object" && !Array.isArray(metaIn)) {
      logoPath = await copyDoc((metaIn as Record<string, unknown>).company_logo_storage_path as string | undefined);
    }

    const bankDetailsJson = {
      bank_name: (form.bank_name as string | null) ?? null,
      ifsc: typeof form.bank_ifsc === "string" ? form.bank_ifsc.toUpperCase() : null,
    };

    const metadata: Record<string, unknown> =
      metaIn && typeof metaIn === "object" && !Array.isArray(metaIn)
        ? { ...(metaIn as Record<string, unknown>) }
        : {};
    metadata.bank_details = bankDetailsJson;
    if (form.workforce_headcount) {
      metadata.workforce_headcount = form.workforce_headcount;
    }
    if (logoPath) {
      metadata.company_logo_storage_path = logoPath;
    }

    const yearsRaw = form.years_in_business;
    let years_in_business: number | null = null;
    if (yearsRaw !== undefined && yearsRaw !== null && yearsRaw !== "") {
      const n = typeof yearsRaw === "number" ? yearsRaw : Number.parseFloat(String(yearsRaw));
      if (!Number.isNaN(n)) years_in_business = n;
    }

    const bankLast4 = String(form.bank_account_number ?? "")
      .replace(/\D/g, "")
      .slice(-4) || null;

    const operating_regions =
      Array.isArray(form.operating_regions) && form.operating_regions.length
        ? (form.operating_regions as string[])
        : splitCsv(form.operating_regions_text);
    const service_areas =
      Array.isArray(form.service_areas) && form.service_areas.length
        ? (form.service_areas as string[])
        : splitCsv(form.service_areas_text);
    const equipment_available =
      Array.isArray(form.equipment_available) && form.equipment_available.length
        ? (form.equipment_available as string[])
        : splitCsv(form.equipment_text);

    const now = new Date().toISOString();

    const { data: vendorRow, error: vErr } = await adminClient
      .from("vendors")
      .insert({
        user_id: newUserId,
        business_name: String(form.business_name ?? "").trim(),
        trade_name: form.trade_name ? String(form.trade_name) : null,
        gstin: form.gstin ? String(form.gstin) : null,
        pan: form.pan ? String(form.pan) : null,
        contact_email: form.contact_email ? String(form.contact_email) : null,
        contact_phone: form.contact_phone ? String(form.contact_phone) : null,
        registered_address: form.registered_address ?? null,
        operating_regions,
        company_type: form.company_type ? String(form.company_type) : null,
        company_registration_number: form.company_registration_number
          ? String(form.company_registration_number)
          : null,
        website_url: form.website_url ? String(form.website_url) : null,
        contact_person_name: form.contact_person_name ? String(form.contact_person_name) : null,
        contact_person_role: form.contact_person_role ? String(form.contact_person_role) : null,
        contact_person_phone: form.contact_person_phone ? String(form.contact_person_phone) : null,
        contact_person_email: form.contact_person_email ? String(form.contact_person_email) : null,
        service_areas,
        experience_summary: form.experience_summary ? String(form.experience_summary) : null,
        years_in_business,
        equipment_available,
        flag_safety_training: Boolean(form.flag_safety_training),
        flag_ppe_available: Boolean(form.flag_ppe_available),
        flag_insurance_coverage: Boolean(form.flag_insurance_coverage),
        bank_detail_last4: bankLast4,
        doc_pan_url,
        doc_aadhaar_url,
        doc_gst_url,
        doc_bank_proof_url,
        approval_status: "approved",
        submitted_at: (intake.submitted_at as string) ?? now,
        reviewed_at: now,
        approved_at: now,
        approved_by: user.id,
        rejection_reason: null,
        metadata: metadata as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (vErr) throw vErr;
    vendorInsertId = vendorRow.id;

    await adminClient.from("users").update({ role: "vendor", is_active: true }).eq("id", newUserId);

    const { error: upErr } = await adminClient
      .from("vendor_registration_intake")
      .update({
        status: "approved",
        reviewed_at: now,
        approved_at: now,
        approved_by: user.id,
        created_user_id: newUserId,
        created_vendor_id: vendorRow.id,
      })
      .eq("id", intakeId);

    if (upErr) throw upErr;

    return json({ ok: true, vendor_id: vendorRow.id, user_id: newUserId });
  } catch (e) {
    try {
      if (vendorInsertId) {
        await adminClient.from("vendors").delete().eq("id", vendorInsertId);
      }
    } catch {
      /* ignore rollback errors */
    }
    if (newUserId) {
      try {
        await adminClient.auth.admin.deleteUser(newUserId);
      } catch {
        /* ignore */
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
