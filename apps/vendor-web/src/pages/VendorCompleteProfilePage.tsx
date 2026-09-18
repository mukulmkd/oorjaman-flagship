import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  authApi,
  uploadVendorDocument,
  VENDOR_PROFILE_COMPLETE_SECTIONS,
  validateVendorProfileCompleteSection,
  vendorApi,
  vendorDocPathsFromRow,
  vendorHasBankDetailsOnFile,
  vendorProfileFirstIncompleteStepIndex,
  vendorProfileIsComplete,
  vendorRowToProfileForm,
} from "@oorjaman/api";
import type { VendorDocKind, VendorIntakeSignupForm, VendorRow } from "@oorjaman/api";
import type { Json } from "@oorjaman/api";
import { Button, Card, Input, PortalLoadingScreen, TextArea } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import { webTypography } from "../styles/typography";
import "./vendor-signup.css";

type SectionId = (typeof VENDOR_PROFILE_COMPLETE_SECTIONS)[number];

function splitCsv(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function sectionTitle(id: SectionId): string {
  switch (id) {
    case "company":
      return "Company details";
    case "contact":
      return "Contact person";
    case "address":
      return "Address & service areas";
    case "experience":
      return "Experience & workforce";
    case "equipment":
      return "Equipment & safety";
    case "bank":
      return "Bank details";
    case "uploads":
      return "Document uploads";
    default:
      return "";
  }
}

const DOC_LABELS: Record<VendorDocKind, string> = {
  pan: "PAN *",
  aadhaar: "Contact person Aadhaar *",
  gst: "GST certificate *",
  bank_proof: "Bank proof *",
  logo: "Company logo (optional)",
};

export default function VendorCompleteProfilePage() {
  const supabase = useSupabase();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<VendorIntakeSignupForm | null>(null);
  const [docPaths, setDocPaths] = useState<Record<string, string | null>>({});
  const [files, setFiles] = useState<Partial<Record<VendorDocKind, File | null>>>({});
  const [bankAccountRequired, setBankAccountRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const v = await vendorApi.getMyVendor(supabase);
        if (cancelled) return;
        if (!v) {
          setVendor(null);
          setLoading(false);
          return;
        }
        setVendor(v);
        setForm(vendorRowToProfileForm(v));
        setDocPaths(vendorDocPathsFromRow(v) as Record<string, string | null>);
        const first = vendorProfileFirstIncompleteStepIndex(v);
        setStep(first < 0 ? 0 : first);
        setBankAccountRequired(!vendorHasBankDetailsOnFile(v));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load vendor profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!supabase) {
    return (
      <div className="vs-root">
        <p className="vs-lede">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
      </div>
    );
  }

  if (loading || !form) {
    return <PortalLoadingScreen label="Loading partner profile…" />;
  }

  if (!vendor) {
    return <Navigate to="/signup" replace />;
  }

  if (vendorProfileIsComplete(vendor)) {
    return <Navigate to="/" replace />;
  }

  const totalSteps = VENDOR_PROFILE_COMPLETE_SECTIONS.length;
  const currentSection = VENDOR_PROFILE_COMPLETE_SECTIONS[step]!;
  const bankOnFile = vendorHasBankDetailsOnFile(vendor) && !bankAccountRequired;

  const setField = <K extends keyof VendorIntakeSignupForm>(key: K, value: VendorIntakeSignupForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDraftMessage(null);
    setError(null);
  };

  const pickFile = (kind: VendorDocKind, list: FileList | null) => {
    const file = list?.[0] ?? null;
    setFiles((prev) => ({ ...prev, [kind]: file }));
    setError(null);
  };

  const buildPayload = async (markComplete: boolean) => {
    const paths = { ...docPaths };
    for (const kind of ["pan", "aadhaar", "gst", "bank_proof", "logo"] as VendorDocKind[]) {
      const file = files[kind];
      if (!file) continue;
      const bytes = await file.arrayBuffer();
      paths[kind] = await uploadVendorDocument(supabase, bytes, kind, file.name, file.type);
    }

    const accountDigits = form.bank_account_number.replace(/\D/g, "");
    const last4 =
      accountDigits.length >= 4
        ? accountDigits.slice(-4)
        : vendor.bank_detail_last4?.trim() || null;

    const yib = Number.parseFloat(form.years_in_business.trim());
    const meta: Json = {
      bank_details: {
        bank_name: form.bank_name.trim() || null,
        ifsc: form.bank_ifsc.trim().toUpperCase() || null,
      },
      ...(form.workforce_headcount.trim()
        ? { workforce_headcount: form.workforce_headcount.trim() }
        : {}),
      ...(paths.logo ? { company_logo_storage_path: paths.logo } : {}),
    };

    return {
      markComplete,
      business_name: form.business_name.trim(),
      trade_name: form.trade_name.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      pan: form.pan.trim().toUpperCase() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      registered_address: {
        line1: form.addr_line1.trim(),
        city: form.addr_city.trim(),
        state: form.addr_state.trim(),
        pincode: form.addr_pincode.trim(),
        country: "India",
      } as Json,
      operating_regions: splitCsv(form.operating_regions_text),
      service_areas: splitCsv(form.service_areas_text),
      company_type: form.company_type.trim() || null,
      company_registration_number: form.company_registration_number.trim() || null,
      website_url: form.website_url.trim() || null,
      contact_person_name: form.contact_person_name.trim() || null,
      contact_person_role: form.contact_person_role.trim() || null,
      contact_person_phone: form.contact_person_phone.trim() || null,
      contact_person_email: form.contact_person_email.trim() || null,
      experience_summary: form.experience_summary.trim() || null,
      years_in_business: Number.isFinite(yib) ? yib : null,
      equipment_available: splitCsv(form.equipment_text),
      flag_safety_training: form.flag_safety_training,
      flag_ppe_available: form.flag_ppe_available,
      flag_insurance_coverage: form.flag_insurance_coverage,
      bank_detail_last4: last4,
      doc_pan_url: paths.pan ?? null,
      doc_aadhaar_url: paths.aadhaar ?? null,
      doc_gst_url: paths.gst ?? null,
      doc_bank_proof_url: paths.bank_proof ?? null,
      metadata: meta,
    };
  };

  const saveProgress = async (asComplete: boolean): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await buildPayload(asComplete);
      const updated = await vendorApi.completeMyVendorProfile(supabase, payload);
      setVendor(updated);
      setDocPaths(vendorDocPathsFromRow(updated) as Record<string, string | null>);
      setFiles({});
      if (asComplete) {
        if (vendorProfileIsComplete(updated)) {
          navigate("/", { replace: true });
          return true;
        }
        setError("Some required details are still missing. Check each step and try again.");
        return false;
      }
      setDraftMessage("Progress saved.");
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save profile.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const onNext = async () => {
    const sectionErr = validateVendorProfileCompleteSection(currentSection, form, {
      uploadDocPaths: {
        pan: files.pan ? "pending" : docPaths.pan,
        aadhaar: files.aadhaar ? "pending" : docPaths.aadhaar,
        gst: files.gst ? "pending" : docPaths.gst,
        bank_proof: files.bank_proof ? "pending" : docPaths.bank_proof,
      },
      bankOnFile,
      bankAccountRequired: bankAccountRequired || Boolean(form.bank_account_number.trim()),
    });
    if (sectionErr) {
      setError(sectionErr);
      return;
    }

    if (step < totalSteps - 1) {
      const ok = await saveProgress(false);
      if (ok) setStep((s) => s + 1);
      return;
    }

    await saveProgress(true);
  };

  const onBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const statusLabel =
    vendor.approval_status === "approved"
      ? "Your organisation is approved — finish these details to use the partner portal."
      : "Finish these organisation details before you can continue. Approval status does not unlock the portal until this is complete.";

  return (
    <div className="vs-root">
      <div className="vs-inner">
        <h1 className="vs-title">Complete partner profile</h1>
        <p className="vs-lede">{statusLabel}</p>

        <Card padded>
          <p className="vs-progress">
            Step {step + 1} of {totalSteps}: {sectionTitle(currentSection)}
          </p>

          {error ? <div className="vs-error-banner">{error}</div> : null}
          {draftMessage ? <div className="vs-hint vs-draft-banner">{draftMessage}</div> : null}

          {currentSection === "company" ? (
            <div className="vs-fields">
              <Input
                label="Legal business name *"
                value={form.business_name}
                onChange={(e) => setField("business_name", e.target.value)}
              />
              <Input
                label="Trade name *"
                value={form.trade_name}
                onChange={(e) => setField("trade_name", e.target.value)}
              />
              <div className="vs-row">
                <Input
                  label="Company type *"
                  placeholder="e.g. Pvt Ltd / LLP"
                  value={form.company_type}
                  onChange={(e) => setField("company_type", e.target.value)}
                />
                <Input
                  label="CIN / registration no. *"
                  value={form.company_registration_number}
                  onChange={(e) => setField("company_registration_number", e.target.value)}
                />
              </div>
              <div className="vs-row">
                <Input
                  label="GSTIN *"
                  value={form.gstin}
                  onChange={(e) => setField("gstin", e.target.value.toUpperCase())}
                />
                <Input
                  label="PAN *"
                  value={form.pan}
                  onChange={(e) => setField("pan", e.target.value.toUpperCase())}
                />
              </div>
              <Input
                label="Website *"
                value={form.website_url}
                onChange={(e) => setField("website_url", e.target.value)}
                autoComplete="url"
              />
              <Input
                label="Organisation email *"
                type="email"
                value={form.contact_email}
                onChange={(e) => setField("contact_email", e.target.value)}
              />
              <Input
                label="Organisation phone *"
                value={form.contact_phone}
                onChange={(e) => setField("contact_phone", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "contact" ? (
            <div className="vs-fields">
              <Input
                label="Contact person name *"
                value={form.contact_person_name}
                onChange={(e) => setField("contact_person_name", e.target.value)}
              />
              <Input
                label="Designation *"
                value={form.contact_person_role}
                onChange={(e) => setField("contact_person_role", e.target.value)}
              />
              <Input
                label="Contact phone *"
                value={form.contact_person_phone}
                onChange={(e) => setField("contact_person_phone", e.target.value)}
              />
              <Input
                label="Contact email *"
                type="email"
                value={form.contact_person_email}
                onChange={(e) => setField("contact_person_email", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "address" ? (
            <div className="vs-fields">
              <Input
                label="Address line 1 *"
                value={form.addr_line1}
                onChange={(e) => setField("addr_line1", e.target.value)}
              />
              <div className="vs-row">
                <Input
                  label="City *"
                  value={form.addr_city}
                  onChange={(e) => setField("addr_city", e.target.value)}
                />
                <Input
                  label="State *"
                  value={form.addr_state}
                  onChange={(e) => setField("addr_state", e.target.value)}
                />
                <Input
                  label="PIN code *"
                  value={form.addr_pincode}
                  onChange={(e) => setField("addr_pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <p className="vs-hint">Separate regions or cities with commas.</p>
              <TextArea
                label="Service areas *"
                placeholder="e.g. Guwahati"
                rows={3}
                value={form.service_areas_text}
                onChange={(e) => setField("service_areas_text", e.target.value)}
              />
              <TextArea
                label="Operating regions *"
                placeholder="e.g. Assam"
                rows={2}
                value={form.operating_regions_text}
                onChange={(e) => setField("operating_regions_text", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "experience" ? (
            <div className="vs-fields">
              <Input
                label="Years in business *"
                placeholder="e.g. 5"
                value={form.years_in_business}
                onChange={(e) => setField("years_in_business", e.target.value)}
              />
              <Input
                label="Approx. field workforce *"
                value={form.workforce_headcount}
                onChange={(e) => setField("workforce_headcount", e.target.value)}
              />
              <TextArea
                label="Experience summary *"
                rows={4}
                value={form.experience_summary}
                onChange={(e) => setField("experience_summary", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "equipment" ? (
            <div className="vs-fields">
              <TextArea
                label="Equipment available *"
                placeholder="Comma-separated e.g. water-fed poles, RO water"
                rows={3}
                value={form.equipment_text}
                onChange={(e) => setField("equipment_text", e.target.value)}
              />
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: webTypography.size.sm }}>
                <input
                  type="checkbox"
                  checked={form.flag_safety_training}
                  onChange={(e) => setField("flag_safety_training", e.target.checked)}
                />
                Safety training completed for crew *
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: webTypography.size.sm }}>
                <input
                  type="checkbox"
                  checked={form.flag_ppe_available}
                  onChange={(e) => setField("flag_ppe_available", e.target.checked)}
                />
                PPE available *
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: webTypography.size.sm }}>
                <input
                  type="checkbox"
                  checked={form.flag_insurance_coverage}
                  onChange={(e) => setField("flag_insurance_coverage", e.target.checked)}
                />
                Insurance coverage *
              </label>
            </div>
          ) : null}

          {currentSection === "bank" ? (
            <div className="vs-fields">
              {bankOnFile ? (
                <p className="vs-hint" style={{ marginTop: 0 }}>
                  Bank details ending in <strong>{vendor.bank_detail_last4}</strong> are already on file. Leave the
                  account number blank to keep them, or enter a new account number to replace.
                </p>
              ) : null}
              <Input
                label="Bank name *"
                value={form.bank_name}
                onChange={(e) => setField("bank_name", e.target.value)}
              />
              <Input
                label="IFSC *"
                value={form.bank_ifsc}
                onChange={(e) => setField("bank_ifsc", e.target.value.toUpperCase())}
              />
              <Input
                label={bankOnFile ? "Operating bank account number (optional to keep existing)" : "Operating bank account number *"}
                inputMode="numeric"
                autoComplete="off"
                value={form.bank_account_number}
                onChange={(e) => {
                  setBankAccountRequired(true);
                  setField("bank_account_number", e.target.value.replace(/\D/g, ""));
                }}
                placeholder={bankOnFile ? `On file ••••${vendor.bank_detail_last4}` : "Full account number"}
              />
              <p className="vs-hint">Upload bank proof (passbook / cheque / statement) in the next step.</p>
            </div>
          ) : null}

          {currentSection === "uploads" ? (
            <div className="vs-doc-grid">
              <p className="vs-hint">
                PDF or image. PAN, contact person Aadhaar, GST certificate, and bank proof are required.
              </p>
              {(["pan", "aadhaar", "gst", "bank_proof", "logo"] as VendorDocKind[]).map((kind) => {
                const existing = docPaths[kind];
                return (
                  <div key={kind} className="vs-doc-row">
                    <div>
                      <strong style={{ fontSize: webTypography.size.sm }}>{DOC_LABELS[kind]}</strong>
                      <div className="vs-doc-meta">
                        {files[kind]?.name ??
                          (existing ? "Document on file — choose a new file to replace" : "No file chosen")}
                      </div>
                    </div>
                    <label className="web-btn web-btn--outline web-btn--sm" style={{ cursor: "pointer", margin: 0 }}>
                      Choose file
                      <input
                        type="file"
                        hidden
                        accept="application/pdf,image/*"
                        onChange={(e) => pickFile(kind, e.target.files)}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="vs-actions">
            <Button variant="outline" type="button" disabled={step === 0 || submitting} onClick={onBack}>
              Back
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={submitting}
              onClick={() => void saveProgress(false)}
            >
              Save progress
            </Button>
            <Button variant="primary" type="button" disabled={submitting} onClick={() => void onNext()}>
              {step === totalSteps - 1 ? (submitting ? "Saving…" : "Finish & continue") : submitting ? "Saving…" : "Next"}
            </Button>
          </div>

          <p className="vs-hint" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="al-link-strong"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit", textDecoration: "underline" }}
              onClick={() => void authApi.signOut(supabase).then(() => navigate("/login", { replace: true }))}
            >
              Sign out
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
