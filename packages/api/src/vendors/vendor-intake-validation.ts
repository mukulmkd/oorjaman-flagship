import { validateEmailFormat, validateLoginNationalPhone, sanitizeLoginNationalDigits } from "../phone-login";

export type VendorIntakeSignupSection =
  | "partner_login"
  | "company"
  | "contact"
  | "address"
  | "experience"
  | "equipment"
  | "bank"
  | "uploads";

/** Wizard form fields for public partner registration (`VendorSignupPage`). */
export type VendorIntakeSignupForm = {
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

export type VendorIntakeRequiredDocKind = "pan" | "aadhaar" | "gst" | "bank_proof";

export type VendorIntakeUploadFiles = Partial<
  Record<VendorIntakeRequiredDocKind | "logo", File | null | undefined>
>;

export type VendorIntakeUploadDocPaths = Partial<
  Record<VendorIntakeRequiredDocKind, string | null | undefined>
>;

function requireText(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return null;
}

function splitCsv(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeVendorPan(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeVendorGstin(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeVendorIfsc(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s/g, "");
}

export function validateVendorPan(raw: string): string | null {
  const err = requireText(raw, "PAN");
  if (err) return err;
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(normalizeVendorPan(raw))) {
    return "Enter a valid 10-character PAN (e.g. ABCDE1234F).";
  }
  return null;
}

export function validateVendorGstin(raw: string): string | null {
  const err = requireText(raw, "GSTIN");
  if (err) return err;
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(normalizeVendorGstin(raw))) {
    return "Enter a valid 15-character GSTIN.";
  }
  return null;
}

export function validateVendorIfsc(raw: string): string | null {
  const err = requireText(raw, "IFSC");
  if (err) return err;
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeVendorIfsc(raw))) {
    return "Enter a valid 11-character IFSC code (e.g. HDFC0001234).";
  }
  return null;
}

export function validateVendorPincode(raw: string): string | null {
  const err = requireText(raw, "PIN code");
  if (err) return err;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return "Enter a valid 6-digit PIN code.";
  return null;
}

export function validateVendorNationalPhone(raw: string, label: string): string | null {
  const err = requireText(raw, label);
  if (err) return err;
  const national = sanitizeLoginNationalDigits(raw);
  return validateLoginNationalPhone(national);
}

export function validateVendorWebsite(raw: string): string | null {
  const err = requireText(raw, "Website");
  if (err) return err;
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t) && !t.includes(".")) {
    return "Enter a valid website URL (e.g. https://example.com).";
  }
  return null;
}

export function validatePositiveYears(raw: string, label: string): string | null {
  const err = requireText(raw, label);
  if (err) return err;
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return `${label} must be a positive number.`;
  return null;
}

export function validatePositiveInteger(raw: string, label: string): string | null {
  const err = requireText(raw, label);
  if (err) return err;
  const t = raw.trim();
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== t) {
    return `${label} must be a whole number greater than zero.`;
  }
  return null;
}

export function validateVendorBankAccountNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) {
    return "Enter the full operating bank account number (at least 9 digits).";
  }
  return null;
}

/**
 * Validate one wizard step. Returns an error message or `null` when valid.
 */
export function validateVendorIntakeSignupSection(
  section: VendorIntakeSignupSection,
  form: VendorIntakeSignupForm,
  opts?: {
    loginNationalPhone?: string;
    uploadFiles?: VendorIntakeUploadFiles;
    uploadDocPaths?: VendorIntakeUploadDocPaths;
  },
): string | null {
  switch (section) {
    case "partner_login": {
      const emailErr = validateEmailFormat(form.partner_login_email);
      if (emailErr) return emailErr;
      const phoneErr = validateLoginNationalPhone(opts?.loginNationalPhone ?? "");
      if (phoneErr) return phoneErr;
      return null;
    }
    case "company": {
      const checks: Array<string | null> = [
        requireText(form.business_name, "Legal business name"),
        requireText(form.trade_name, "Trade name"),
        requireText(form.company_type, "Company type"),
        requireText(form.company_registration_number, "CIN / registration number"),
        validateVendorGstin(form.gstin),
        validateVendorPan(form.pan),
        validateVendorWebsite(form.website_url),
        validateEmailFormat(form.contact_email),
        validateVendorNationalPhone(form.contact_phone, "Organisation phone"),
      ];
      return checks.find(Boolean) ?? null;
    }
    case "contact": {
      const checks: Array<string | null> = [
        requireText(form.contact_person_name, "Contact person name"),
        requireText(form.contact_person_role, "Contact person designation"),
        validateVendorNationalPhone(form.contact_person_phone, "Contact person phone"),
        validateEmailFormat(form.contact_person_email),
      ];
      return checks.find(Boolean) ?? null;
    }
    case "address": {
      const checks: Array<string | null> = [
        requireText(form.addr_line1, "Address line 1"),
        requireText(form.addr_city, "City"),
        requireText(form.addr_state, "State"),
        validateVendorPincode(form.addr_pincode),
        splitCsv(form.service_areas_text).length === 0 ? "Enter at least one service area." : null,
        splitCsv(form.operating_regions_text).length === 0 ? "Enter at least one operating region." : null,
      ];
      return checks.find(Boolean) ?? null;
    }
    case "experience": {
      const checks: Array<string | null> = [
        validatePositiveYears(form.years_in_business, "Years in business"),
        validatePositiveInteger(form.workforce_headcount, "Approx. field workforce"),
        requireText(form.experience_summary, "Experience summary"),
      ];
      return checks.find(Boolean) ?? null;
    }
    case "equipment": {
      if (splitCsv(form.equipment_text).length === 0) {
        return "List at least one item of equipment available.";
      }
      if (!form.flag_safety_training) return "Confirm that safety training is completed for your crew.";
      if (!form.flag_ppe_available) return "Confirm that PPE is available.";
      if (!form.flag_insurance_coverage) return "Confirm that insurance coverage is in place.";
      return null;
    }
    case "bank": {
      const checks: Array<string | null> = [
        requireText(form.bank_name, "Bank name"),
        validateVendorIfsc(form.bank_ifsc),
        validateVendorBankAccountNumber(form.bank_account_number),
      ];
      return checks.find(Boolean) ?? null;
    }
    case "uploads": {
      const files = opts?.uploadFiles ?? {};
      const paths = opts?.uploadDocPaths ?? {};
      const has = (kind: VendorIntakeRequiredDocKind) =>
        Boolean(files[kind]) || Boolean(paths[kind]?.trim());
      if (!has("pan")) return "PAN document is required.";
      if (!has("aadhaar")) return "Contact person Aadhaar document is required.";
      if (!has("gst")) return "GST certificate is required.";
      if (!has("bank_proof")) return "Bank proof document is required.";
      return null;
    }
    default:
      return null;
  }
}

/** Validate every step before final submit. */
export function validateVendorIntakeSignupFull(
  form: VendorIntakeSignupForm,
  opts?: {
    loginNationalPhone?: string;
    uploadFiles?: VendorIntakeUploadFiles;
    uploadDocPaths?: VendorIntakeUploadDocPaths;
  },
): string | null {
  const sections: VendorIntakeSignupSection[] = [
    "partner_login",
    "company",
    "contact",
    "address",
    "experience",
    "equipment",
    "bank",
    "uploads",
  ];
  for (const section of sections) {
    const err = validateVendorIntakeSignupSection(section, form, opts);
    if (err) return err;
  }
  return null;
}

/** Server/RPC: validate submitted intake JSON (same rules as the signup wizard). */
export function validateVendorIntakeFormJson(form: Record<string, unknown>): string | null {
  const str = (key: string) => {
    const v = form[key];
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return "";
  };
  const bool = (key: string) => Boolean(form[key]);

  const signup: VendorIntakeSignupForm = {
    partner_login_email: str("partner_login_email"),
    business_name: str("business_name"),
    trade_name: str("trade_name"),
    gstin: str("gstin"),
    pan: str("pan"),
    company_type: str("company_type"),
    company_registration_number: str("company_registration_number"),
    website_url: str("website_url"),
    addr_line1: "",
    addr_city: "",
    addr_state: "",
    addr_pincode: "",
    contact_email: str("contact_email"),
    contact_phone: str("contact_phone"),
    contact_person_name: str("contact_person_name"),
    contact_person_role: str("contact_person_role"),
    contact_person_phone: str("contact_person_phone"),
    contact_person_email: str("contact_person_email"),
    operating_regions_text: str("operating_regions_text"),
    service_areas_text: str("service_areas_text"),
    experience_summary: str("experience_summary"),
    years_in_business: str("years_in_business"),
    workforce_headcount: str("workforce_headcount"),
    equipment_text: str("equipment_text"),
    flag_safety_training: bool("flag_safety_training"),
    flag_ppe_available: bool("flag_ppe_available"),
    flag_insurance_coverage: bool("flag_insurance_coverage"),
    bank_name: str("bank_name"),
    bank_ifsc: str("bank_ifsc"),
    bank_account_number: str("bank_account_number"),
  };

  const addr = form.registered_address;
  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    const a = addr as Record<string, unknown>;
    signup.addr_line1 = typeof a.line1 === "string" ? a.line1 : "";
    signup.addr_city = typeof a.city === "string" ? a.city : "";
    signup.addr_state = typeof a.state === "string" ? a.state : "";
    signup.addr_pincode = typeof a.pincode === "string" ? a.pincode : "";
  }

  const loginPhoneRaw = str("partner_login_phone_e164") || str("partner_login_phone");
  const loginNational =
    loginPhoneRaw.replace(/\D/g, "").length > 10
      ? loginPhoneRaw.replace(/\D/g, "").slice(-10)
      : loginPhoneRaw.replace(/\D/g, "");

  const uploadDocPaths: VendorIntakeUploadDocPaths = {
    pan: str("doc_pan_url"),
    aadhaar: str("doc_aadhaar_url"),
    gst: str("doc_gst_url"),
    bank_proof: str("doc_bank_proof_url"),
  };

  return validateVendorIntakeSignupFull(signup, {
    loginNationalPhone: loginNational,
    uploadDocPaths,
  });
}
