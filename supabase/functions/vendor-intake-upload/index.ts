/// <reference path="../supabase-edge.d.ts" />
/**
 * Unauthenticated vendor signup document upload.
 * Verifies draft_access_token then writes with service role so anon Storage
 * SELECT/INSERT policies are not required (closes path self-auth list leak).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders as resolveCors } from "../_shared/cors.ts";
import { enforceEdgeRateLimit, subjectUserAndIp } from "../_shared/rate-limit.ts";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_KINDS = new Set(["pan", "aadhaar", "gst", "bank_proof", "logo"]);

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 96);
}

Deno.serve(async (req: Request) => {
  const cors = resolveCors(req);
  const json = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const rateLimited = await enforceEdgeRateLimit({
    admin,
    req,
    functionName: "vendor-intake-upload",
    subject: subjectUserAndIp("anon-intake", req),
    cors,
  });
  if (rateLimited) return rateLimited;

  let intakeId = "";
  let draftToken = "";
  let docKind = "";
  let originalFilename = "document";
  let contentType = "application/octet-stream";
  let bytes: Uint8Array | null = null;

  const contentTypeHeader = req.headers.get("content-type") ?? "";
  try {
    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await req.formData();
      intakeId = String(form.get("intake_id") ?? "").trim();
      draftToken = String(form.get("draft_access_token") ?? "").trim();
      docKind = String(form.get("doc_kind") ?? "").trim();
      originalFilename = String(form.get("filename") ?? "document").trim() || "document";
      contentType = String(form.get("content_type") ?? "application/octet-stream").trim();
      const file = form.get("file");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        bytes = new Uint8Array(await (file as File).arrayBuffer());
        if ((file as File).type) contentType = (file as File).type;
        if ((file as File).name) originalFilename = (file as File).name;
      }
    } else {
      const body = (await req.json()) as {
        intake_id?: string;
        draft_access_token?: string;
        doc_kind?: string;
        filename?: string;
        content_type?: string;
        content_base64?: string;
      };
      intakeId = String(body.intake_id ?? "").trim();
      draftToken = String(body.draft_access_token ?? "").trim();
      docKind = String(body.doc_kind ?? "").trim();
      originalFilename = String(body.filename ?? "document").trim() || "document";
      contentType = String(body.content_type ?? "application/octet-stream").trim();
      const b64 = String(body.content_base64 ?? "").trim();
      if (b64) {
        const bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
    }
  } catch {
    return json({ ok: false, error: "Invalid upload body" }, 400);
  }

  if (!intakeId || !draftToken || !ALLOWED_KINDS.has(docKind) || !bytes) {
    return json({ ok: false, error: "intake_id, draft_access_token, doc_kind, and file are required" }, 400);
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return json({ ok: false, error: "File must be between 1 byte and 8 MiB" }, 400);
  }

  const { data: intake, error: intakeErr } = await admin
    .from("vendor_registration_intake")
    .select("id, draft_access_token, status")
    .eq("id", intakeId)
    .maybeSingle();
  if (intakeErr) return json({ ok: false, error: intakeErr.message }, 500);
  if (!intake || intake.status !== "draft" || intake.draft_access_token !== draftToken) {
    return json({ ok: false, error: "Draft intake not found" }, 404);
  }

  const safe = sanitizeFilename(originalFilename);
  const path = `${intakeId}/${draftToken}/${docKind}_${Date.now()}_${safe}`;

  const { error: upErr } = await admin.storage.from("vendor-intake").upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (upErr) return json({ ok: false, error: upErr.message }, 500);

  return json({ ok: true, path });
});
