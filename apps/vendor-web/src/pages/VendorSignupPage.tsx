import { webTypography } from "./../styles/typography";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  authApi,
  buildLoginE164,
  DEFAULT_LOGIN_COUNTRY_DIAL,
  getDummyAuthUiHint,
  LOGIN_PHONE_COUNTRIES,
  uploadVendorIntakeDocument,
  userApi,
  validateEmailFormat,
  validateLoginNationalPhone,
  vendorApi,
  vendorIntakeApi,
} from "@oorjaman/api";
import type { Json } from "@oorjaman/api";
import type { VendorDocKind } from "@oorjaman/api";
import { Button, Card, Input, PhoneCountryLogin, TextArea } from "@oorjaman/web-ui";
import { useSupabase } from "../lib/supabase-context";
import "./vendor-signup.css";

const SECTION_ORDER = [
  "partner_login",
  "company",
  "contact",
  "address",
  "experience",
  "equipment",
  "bank",
  "uploads",
] as const;

type SectionId = (typeof SECTION_ORDER)[number];

function splitCsv(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function sectionTitle(id: SectionId): string {
  switch (id) {
    case "partner_login":
      return "Sign-in after approval";
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

type FormState = {
  partner_login_email: string;
  business_name: string;
  trade_name: string;
  gstin: string;
  pan: string;
  company_type: string;
  company_registration_number: string;
  website_url: string;
  addr_line1: string;
  addr_city: string;
  addr_state: string;
  addr_pincode: string;
  contact_email: string;
  contact_phone: string;
  contact_person_name: string;
  contact_person_role: string;
  contact_person_phone: string;
  contact_person_email: string;
  operating_regions_text: string;
  service_areas_text: string;
  experience_summary: string;
  years_in_business: string;
  workforce_headcount: string;
  equipment_text: string;
  flag_safety_training: boolean;
  flag_ppe_available: boolean;
  flag_insurance_coverage: boolean;
  bank_name: string;
  bank_ifsc: string;
  bank_account_number: string;
};

const emptyForm = (): FormState => ({
  partner_login_email: "",
  business_name: "",
  trade_name: "",
  gstin: "",
  pan: "",
  company_type: "",
  company_registration_number: "",
  website_url: "",
  addr_line1: "",
  addr_city: "",
  addr_state: "",
  addr_pincode: "",
  contact_email: "",
  contact_phone: "",
  contact_person_name: "",
  contact_person_role: "",
  contact_person_phone: "",
  contact_person_email: "",
  operating_regions_text: "",
  service_areas_text: "",
  experience_summary: "",
  years_in_business: "",
  workforce_headcount: "",
  equipment_text: "",
  flag_safety_training: false,
  flag_ppe_available: false,
  flag_insurance_coverage: false,
  bank_name: "",
  bank_ifsc: "",
  bank_account_number: "",
});

const DOC_LABELS: Record<VendorDocKind, string> = {
  pan: "PAN",
  aadhaar: "Aadhaar",
  gst: "GST certificate (optional)",
  bank_proof: "Bank proof",
  logo: "Company logo (optional)",
};

export default function VendorSignupPage() {
  const supabase = useSupabase();

  const [sessionReady, setSessionReady] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [legacyVendorBlock, setLegacyVendorBlock] = useState(false);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [files, setFiles] = useState<Partial<Record<VendorDocKind, File | null>>>({});

  const [countryDial, setCountryDial] = useState(DEFAULT_LOGIN_COUNTRY_DIAL);
  const [nationalPhone, setNationalPhone] = useState("");

  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [intakeHydrated, setIntakeHydrated] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const dummyHint = useMemo(() => getDummyAuthUiHint(import.meta.env), []);

  useEffect(() => {
    if (!supabase || intakeHydrated) return;
    void (async () => {
      try {
        const sid = sessionStorage.getItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_ID_KEY);
        const tok = sessionStorage.getItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_TOKEN_KEY);
        if (!sid || !tok) {
          setIntakeHydrated(true);
          return;
        }
        const row = await vendorIntakeApi.getVendorRegistrationIntakeDraft(supabase, sid, tok);
        if (!row) {
          sessionStorage.removeItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_ID_KEY);
          sessionStorage.removeItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_TOKEN_KEY);
          setIntakeHydrated(true);
          return;
        }
        if (row.status === "submitted" || row.status === "approved" || row.status === "rejected") {
          setAlreadySubmitted(true);
          setIntakeHydrated(true);
          return;
        }
        setIntakeId(sid);
        setDraftToken(tok);
        const fd = row.form_data;
        if (fd && typeof fd === "object" && !Array.isArray(fd)) {
          setForm({ ...emptyForm(), ...(fd as unknown as FormState) });
        }
        const vis = SECTION_ORDER.length - 1;
        if (typeof row.step_index === "number" && row.step_index >= 0) {
          setStep(Math.min(row.step_index, vis));
        }
        const phoneE164 =
          fd && typeof fd === "object" && !Array.isArray(fd)
            ? String((fd as Record<string, unknown>).partner_login_phone_e164 ?? "").trim()
            : "";
        if (phoneE164.startsWith("+")) {
          const dial = LOGIN_PHONE_COUNTRIES.find((c) => phoneE164.startsWith(c.dialCode))?.dialCode;
          if (dial) {
            setCountryDial(dial);
            setNationalPhone(phoneE164.slice(dial.length).replace(/\D/g, ""));
          }
        }
        setDraftMessage("Your saved progress was restored - continue where you left off.");
      } finally {
        setIntakeHydrated(true);
      }
    })();
  }, [supabase, intakeHydrated]);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) {
        setUserRole(null);
        setSessionReady(true);
        return;
      }
      const row = await userApi.getMyUserRecord(supabase);
      setUserRole(row?.role ?? null);
      if (row?.role === "vendor") {
        const v = await vendorApi.getMyVendor(supabase);
        if (
          v &&
          v.approval_status !== "rejected" &&
          v.approval_status !== "approved" &&
          v.business_name.trim() !== "" &&
          v.business_name !== "Draft partner application"
        ) {
          setLegacyVendorBlock(true);
        }
      }
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_ev, sess) => {
      if (!sess?.user) {
        setUserRole(null);
        setLegacyVendorBlock(false);
        return;
      }
      const row = await userApi.getMyUserRecord(supabase);
      setUserRole(row?.role ?? null);
      if (row?.role === "vendor") {
        const v = await vendorApi.getMyVendor(supabase);
        if (
          v &&
          v.approval_status !== "rejected" &&
          v.approval_status !== "approved" &&
          v.business_name.trim() !== "" &&
          v.business_name !== "Draft partner application"
        ) {
          setLegacyVendorBlock(true);
        } else {
          setLegacyVendorBlock(false);
        }
      } else {
        setLegacyVendorBlock(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const hasSession = Boolean(userRole);
  const currentSection = SECTION_ORDER[step] ?? "partner_login";
  const totalSteps = SECTION_ORDER.length;

  const buildFormJson = (): Json => {
    const e164 = buildLoginE164(countryDial, nationalPhone);
    return JSON.parse(
      JSON.stringify({
        ...form,
        partner_login_phone_e164: e164,
        partner_login_email: form.partner_login_email.trim().toLowerCase(),
      }),
    ) as Json;
  };

  const ensureIntake = async (): Promise<{ id: string; token: string }> => {
    if (!supabase) throw new Error("Supabase is not configured.");
    if (intakeId && draftToken) return { id: intakeId, token: draftToken };
    const initial = buildFormJson();
    const created = await vendorIntakeApi.createVendorRegistrationIntake(supabase, initial);
    setIntakeId(created.id);
    setDraftToken(created.draft_token);
    sessionStorage.setItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_ID_KEY, created.id);
    sessionStorage.setItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_TOKEN_KEY, created.draft_token);
    return { id: created.id, token: created.draft_token };
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const pickFile = (kind: VendorDocKind, list: FileList | null) => {
    const f = list?.[0];
    setFiles((prev) => ({ ...prev, [kind]: f ?? null }));
  };

  const next = () => {
    setSubmitError(null);
    if (step < totalSteps - 1) setStep((s) => s + 1);
  };

  const back = () => {
    setSubmitError(null);
    if (step > 0) setStep((s) => s - 1);
  };

  const saveDraft = async () => {
    if (!supabase) return;
    setSavingDraft(true);
    setDraftMessage(null);
    try {
      const { id, token } = await ensureIntake();
      const formJson = buildFormJson();
      await vendorIntakeApi.updateVendorRegistrationIntakeDraft(supabase, id, token, {
        form: formJson,
        stepIndex: step,
      });
      setDraftMessage("Progress saved. You can close this page and return with the same browser to finish.");
    } catch (e: unknown) {
      setDraftMessage(e instanceof Error ? e.message : "Could not save draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  const validateStep = (id: SectionId): string | null => {
    switch (id) {
      case "partner_login": {
        const emailErr = validateEmailFormat(form.partner_login_email);
        if (emailErr) return emailErr;
        const phoneErr = validateLoginNationalPhone(nationalPhone);
        if (phoneErr) return phoneErr;
        return null;
      }
      case "company":
        if (!form.business_name.trim()) return "Legal business name is required.";
        if (form.contact_email.trim()) {
          const ce = validateEmailFormat(form.contact_email);
          if (ce) return ce;
        }
        return null;
      case "contact":
        if (form.contact_person_email.trim()) {
          const pe = validateEmailFormat(form.contact_person_email);
          if (pe) return pe;
        }
        return null;
      case "bank": {
        const digits = form.bank_account_number.replace(/\D/g, "");
        if (digits.length < 4) {
          return "Enter at least the last 4 digits of the operating account.";
        }
        return null;
      }
      case "uploads": {
        if (!files.pan) return "PAN document is required.";
        if (!files.aadhaar) return "Aadhaar document is required.";
        if (!files.bank_proof) return "Bank proof is required.";
        return null;
      }
      default:
        return null;
    }
  };

  const onSubmit = async () => {
    setSubmitError(null);
    const err = validateStep("uploads");
    if (err) {
      setSubmitError(err);
      return;
    }
    if (!supabase) {
      setSubmitError("Supabase is not configured.");
      return;
    }

    setSubmitting(true);
    try {
      const years = form.years_in_business.trim();
      const yib = years === "" ? null : Number.parseFloat(years);
      if (years !== "" && (yib === null || Number.isNaN(yib))) {
        throw new Error("Years in business must be a valid number.");
      }

      const { id, token } = await ensureIntake();

      const paths: Partial<Record<VendorDocKind, string>> = {};
      const kinds: VendorDocKind[] = ["pan", "aadhaar", "gst", "bank_proof", "logo"];
      for (const kind of kinds) {
        const file = files[kind];
        if (!file) continue;
        const buf = await file.arrayBuffer();
        paths[kind] = await uploadVendorIntakeDocument(supabase, id, token, buf, kind, file.name, file.type || undefined);
      }

      if (!paths.pan || !paths.aadhaar || !paths.bank_proof) {
        throw new Error("PAN, Aadhaar, and bank proof uploads are required.");
      }

      const bankDetailsJson: Json = {
        bank_name: form.bank_name.trim() || null,
        ifsc: form.bank_ifsc.trim().toUpperCase() || null,
      };

      const meta: Json = {
        ...(paths.logo ? { company_logo_storage_path: paths.logo } : {}),
        bank_details: bankDetailsJson,
        ...(form.workforce_headcount.trim()
          ? { workforce_headcount: form.workforce_headcount.trim() }
          : {}),
      };

      const formJson = buildFormJson();
      const formBase =
        typeof formJson === "object" && formJson !== null && !Array.isArray(formJson)
          ? (formJson as Record<string, Json>)
          : {};
      const mergedForm: Json = {
        ...formBase,
        trade_name: form.trade_name.trim() || null,
        gstin: form.gstin.trim() || null,
        pan: form.pan.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        registered_address: {
          line1: form.addr_line1.trim(),
          city: form.addr_city.trim(),
          state: form.addr_state.trim(),
          pincode: form.addr_pincode.trim(),
          country: "India",
        },
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
        years_in_business: yib,
        equipment_available: splitCsv(form.equipment_text),
        equipment_text: form.equipment_text,
        operating_regions_text: form.operating_regions_text,
        service_areas_text: form.service_areas_text,
        flag_safety_training: form.flag_safety_training,
        flag_ppe_available: form.flag_ppe_available,
        flag_insurance_coverage: form.flag_insurance_coverage,
        bank_detail_last4: form.bank_account_number.replace(/\D/g, "").slice(-4) || null,
        bank_name: form.bank_name.trim() || null,
        bank_ifsc: form.bank_ifsc.trim().toUpperCase() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        doc_pan_url: paths.pan,
        doc_aadhaar_url: paths.aadhaar,
        doc_gst_url: paths.gst ?? null,
        doc_bank_proof_url: paths.bank_proof,
        metadata: meta,
      };

      await vendorIntakeApi.submitVendorRegistrationIntake(supabase, id, token, mergedForm);
      sessionStorage.removeItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_ID_KEY);
      sessionStorage.removeItem(vendorIntakeApi.VENDOR_INTAKE_SESSION_TOKEN_KEY);
      setDone(true);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!supabase) {
    return (
      <div className="vs-root">
        <p className="vs-lede">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
      </div>
    );
  }

  if (!sessionReady || !intakeHydrated) {
    return (
      <div className="vs-root">
        <p className="vs-lede">Loading…</p>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="vs-root">
        <Card padded className="vs-inner">
          <div className="vs-success">
            <h2>Application already received</h2>
            <p>This browser already submitted a partner application. Use the sign-in details you provided after approval.</p>
            <Button variant="primary" type="button" onClick={() => (window.location.href = "/login")}>
              Back to sign in
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="vs-root">
        <Card padded className="vs-inner">
          <div className="vs-success">
            <h2>Thank you</h2>
            <p>
              Your application is under review. After approval you will receive access at the email and phone you
              provided - use the usual partner sign-in (OTP / email) to open the vendor portal.
            </p>
            <Button variant="primary" type="button" onClick={() => (window.location.href = "/login")}>
              Back to sign in
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (hasSession && userRole && (userRole === "admin" || userRole === "technician")) {
    return (
      <div className="vs-root">
        <Card padded className="vs-inner">
          <h1 className="vs-title">Vendor registration</h1>
          <p className="vs-lede">
            You are signed in with an account that cannot use this public registration form. Sign out first, or open this
            page in a private window.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              void authApi.signOut(supabase).then(() => {
                setUserRole(null);
                setStep(0);
              });
            }}
          >
            Sign out
          </Button>
          <p className="vs-hint" style={{ marginTop: "1rem" }}>
            Or open <Link to="/login">Sign in</Link>.
          </p>
        </Card>
      </div>
    );
  }

  if (legacyVendorBlock) {
    return (
      <div className="vs-root">
        <Card padded className="vs-inner">
          <h1 className="vs-title">Application status</h1>
          <p className="vs-lede">
            You already have a partner application on file. Sign in with your vendor account to check status or continue
            in the app.
          </p>
          <Button variant="primary" type="button" onClick={() => (window.location.href = "/login")}>
            Sign in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="vs-root">
      <div className="vs-inner">
        <h1 className="vs-title">Partner registration</h1>
        <p className="vs-lede">
          Register your organisation for the Oorjaman partner network. No account is created until an administrator
          approves your application - then use partner sign-in with the email and phone you provide below.
        </p>

        <Card padded>
          <p className="vs-progress">
            Step {step + 1} of {totalSteps}: {sectionTitle(currentSection)}
          </p>

          {submitError ? <div className="vs-error-banner">{submitError}</div> : null}
          {draftMessage ? <div className="vs-hint vs-draft-banner">{draftMessage}</div> : null}

          {currentSection === "partner_login" ? (
            <>
              {dummyHint ? <div className="vs-dummy">{dummyHint}</div> : null}
              <div className="vs-fields">
                <p className="vs-hint" style={{ marginTop: 0 }}>
                  After approval, you will sign in with this email and mobile number (OTP / magic link - same as partner
                  login). We do not create your login until an admin approves the application.
                </p>
                <Input
                  label="Email for partner login *"
                  type="email"
                  value={form.partner_login_email}
                  onChange={(e) => setField("partner_login_email", e.target.value)}
                  placeholder="ops@yourcompany.com"
                  autoComplete="email"
                />
                <PhoneCountryLogin
                  label="Mobile for partner login *"
                  countries={LOGIN_PHONE_COUNTRIES}
                  countryDialCode={countryDial}
                  onCountryDialCodeChange={setCountryDial}
                  nationalDigits={nationalPhone}
                  onNationalDigitsChange={setNationalPhone}
                />
              </div>
            </>
          ) : null}

          {currentSection === "company" ? (
            <div className="vs-fields">
              <Input
                label="Legal business name *"
                value={form.business_name}
                onChange={(e) => setField("business_name", e.target.value)}
              />
              <Input label="Trade name" value={form.trade_name} onChange={(e) => setField("trade_name", e.target.value)} />
              <div className="vs-row">
                <Input
                  label="Company type"
                  placeholder="e.g. Pvt Ltd"
                  value={form.company_type}
                  onChange={(e) => setField("company_type", e.target.value)}
                />
                <Input
                  label="CIN / registration no."
                  value={form.company_registration_number}
                  onChange={(e) => setField("company_registration_number", e.target.value)}
                />
              </div>
              <div className="vs-row">
                <Input label="GSTIN" value={form.gstin} onChange={(e) => setField("gstin", e.target.value)} />
                <Input label="PAN (text)" value={form.pan} onChange={(e) => setField("pan", e.target.value)} />
              </div>
              <Input
                label="Website"
                value={form.website_url}
                onChange={(e) => setField("website_url", e.target.value)}
                autoComplete="url"
              />
              <Input
                label="Organisation email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setField("contact_email", e.target.value)}
              />
              <Input
                label="Organisation phone"
                value={form.contact_phone}
                onChange={(e) => setField("contact_phone", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "contact" ? (
            <div className="vs-fields">
              <Input
                label="Contact person name"
                value={form.contact_person_name}
                onChange={(e) => setField("contact_person_name", e.target.value)}
              />
              <Input
                label="Designation"
                value={form.contact_person_role}
                onChange={(e) => setField("contact_person_role", e.target.value)}
              />
              <Input
                label="Contact phone"
                value={form.contact_person_phone}
                onChange={(e) => setField("contact_person_phone", e.target.value)}
              />
              <Input
                label="Contact email"
                type="email"
                value={form.contact_person_email}
                onChange={(e) => setField("contact_person_email", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "address" ? (
            <div className="vs-fields">
              <Input label="Address line 1" value={form.addr_line1} onChange={(e) => setField("addr_line1", e.target.value)} />
              <div className="vs-row">
                <Input label="City" value={form.addr_city} onChange={(e) => setField("addr_city", e.target.value)} />
                <Input label="State" value={form.addr_state} onChange={(e) => setField("addr_state", e.target.value)} />
                <Input label="PIN code" value={form.addr_pincode} onChange={(e) => setField("addr_pincode", e.target.value)} />
              </div>
              <p className="vs-hint">Separate regions or cities with commas.</p>
              <TextArea
                label="Service areas"
                placeholder="e.g. Bengaluru Urban, Mysuru"
                rows={3}
                value={form.service_areas_text}
                onChange={(e) => setField("service_areas_text", e.target.value)}
              />
              <TextArea
                label="Operating regions"
                placeholder="e.g. Karnataka, Tamil Nadu"
                rows={2}
                value={form.operating_regions_text}
                onChange={(e) => setField("operating_regions_text", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "experience" ? (
            <div className="vs-fields">
              <Input
                label="Years in business"
                placeholder="e.g. 5"
                value={form.years_in_business}
                onChange={(e) => setField("years_in_business", e.target.value)}
              />
              <Input
                label="Approx. field workforce (optional)"
                value={form.workforce_headcount}
                onChange={(e) => setField("workforce_headcount", e.target.value)}
              />
              <TextArea
                label="Experience summary"
                rows={4}
                value={form.experience_summary}
                onChange={(e) => setField("experience_summary", e.target.value)}
              />
            </div>
          ) : null}

          {currentSection === "equipment" ? (
            <div className="vs-fields">
              <TextArea
                label="Equipment available"
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
                Safety training completed for crew
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: webTypography.size.sm }}>
                <input
                  type="checkbox"
                  checked={form.flag_ppe_available}
                  onChange={(e) => setField("flag_ppe_available", e.target.checked)}
                />
                PPE available
              </label>
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: webTypography.size.sm }}>
                <input
                  type="checkbox"
                  checked={form.flag_insurance_coverage}
                  onChange={(e) => setField("flag_insurance_coverage", e.target.checked)}
                />
                Insurance coverage
              </label>
            </div>
          ) : null}

          {currentSection === "bank" ? (
            <div className="vs-fields">
              <Input label="Bank name" value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} />
              <Input
                label="IFSC"
                value={form.bank_ifsc}
                onChange={(e) => setField("bank_ifsc", e.target.value.toUpperCase())}
              />
              <Input
                label="Operating bank account number"
                inputMode="numeric"
                autoComplete="off"
                value={form.bank_account_number}
                onChange={(e) => setField("bank_account_number", e.target.value.replace(/\D/g, ""))}
                placeholder="We store only the last 4 digits"
              />
              <p className="vs-hint">Upload bank proof (passbook / cheque / statement) in the next step.</p>
            </div>
          ) : null}

          {currentSection === "uploads" ? (
            <div className="vs-doc-grid">
              <p className="vs-hint">PDF or image. PAN, Aadhaar, and bank proof are required. GST and logo are optional.</p>
              {(["pan", "aadhaar", "gst", "bank_proof", "logo"] as VendorDocKind[]).map((kind) => (
                <div key={kind} className="vs-doc-row">
                  <div>
                    <strong style={{ fontSize: webTypography.size.sm }}>{DOC_LABELS[kind]}</strong>
                    <div className="vs-doc-meta">{files[kind]?.name ?? "No file chosen"}</div>
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
              ))}
            </div>
          ) : null}

          <div className="vs-actions">
            {step > 0 ? (
              <Button variant="outline" type="button" onClick={back}>
                Back
              </Button>
            ) : null}
            {currentSection !== "partner_login" ? (
              <Button variant="outline" type="button" loading={savingDraft} onClick={() => void saveDraft()}>
                Save & continue later
              </Button>
            ) : null}
            {currentSection === "uploads" ? (
              <Button variant="primary" type="button" loading={submitting} onClick={() => void onSubmit()}>
                Submit application
              </Button>
            ) : (
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  void (async () => {
                    const err = validateStep(currentSection);
                    if (err) {
                      setSubmitError(err);
                      return;
                    }
                    if (currentSection === "partner_login") {
                      void (async () => {
                        try {
                          const { id, token } = await ensureIntake();
                          const formJson = buildFormJson();
                          await vendorIntakeApi.updateVendorRegistrationIntakeDraft(supabase, id, token, {
                            form: formJson,
                            stepIndex: 1,
                          });
                          setStep(1);
                          setSubmitError(null);
                        } catch (e: unknown) {
                          setSubmitError(e instanceof Error ? e.message : "Could not start application.");
                        }
                      })();
                      return;
                    }
                    setSubmitError(null);
                    next();
                  })();
                }}
              >
                Next
              </Button>
            )}
          </div>
        </Card>

        <p className="vs-hint" style={{ marginTop: "1rem", textAlign: "center" }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
