import type { Json, VendorRow } from "../database.types";
import {
  type VendorIntakeSignupForm,
  type VendorIntakeSignupSection,
  type VendorIntakeUploadDocPaths,
  validateVendorIntakeSignupSection,
} from "./vendor-intake-validation";

/** Post-login profile wizard steps (no partner_login — already authenticated). */
export const VENDOR_PROFILE_COMPLETE_SECTIONS = [
  "company",
  "contact",
  "address",
  "experience",
  "equipment",
  "bank",
  "uploads",
] as const satisfies readonly VendorIntakeSignupSection[];

export type VendorProfileCompleteSection = (typeof VENDOR_PROFILE_COMPLETE_SECTIONS)[number];

function metaObject(metadata: Json | null | undefined): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function joinList(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .join(", ");
  }
  return str(v);
}

/** True when bank name + IFSC + last4 already stored (full account need not be re-entered). */
export function vendorHasBankDetailsOnFile(vendor: VendorRow | null | undefined): boolean {
  if (!vendor?.bank_detail_last4?.trim()) return false;
  const bank = metaObject(vendor.metadata).bank_details;
  if (!bank || typeof bank !== "object" || Array.isArray(bank)) return false;
  const b = bank as Record<string, unknown>;
  return Boolean(str(b.bank_name).trim() && str(b.ifsc ?? b.bank_ifsc).trim());
}

export function vendorRowToProfileForm(vendor: VendorRow): VendorIntakeSignupForm {
  const m = metaObject(vendor.metadata);
  const draft =
    m.registration_draft && typeof m.registration_draft === "object" && !Array.isArray(m.registration_draft)
      ? (m.registration_draft as Record<string, unknown>)
      : null;
  const draftForm =
    draft?.form && typeof draft.form === "object" && !Array.isArray(draft.form)
      ? (draft.form as Record<string, unknown>)
      : null;

  const addrRaw = vendor.registered_address;
  const addr =
    addrRaw && typeof addrRaw === "object" && !Array.isArray(addrRaw)
      ? (addrRaw as Record<string, unknown>)
      : {};

  const bankMeta =
    m.bank_details && typeof m.bank_details === "object" && !Array.isArray(m.bank_details)
      ? (m.bank_details as Record<string, unknown>)
      : {};

  const pick = (key: keyof VendorIntakeSignupForm, fromVendor: string): string => {
    const fromDraft = draftForm ? str(draftForm[key]).trim() : "";
    if (fromDraft) return fromDraft;
    return fromVendor;
  };

  return {
    partner_login_email: "",
    business_name: pick("business_name", vendor.business_name?.trim() ?? ""),
    trade_name: pick("trade_name", vendor.trade_name?.trim() ?? ""),
    gstin: pick("gstin", vendor.gstin?.trim() ?? ""),
    pan: pick("pan", vendor.pan?.trim() ?? ""),
    company_type: pick("company_type", vendor.company_type?.trim() ?? ""),
    company_registration_number: pick(
      "company_registration_number",
      vendor.company_registration_number?.trim() ?? "",
    ),
    website_url: pick("website_url", vendor.website_url?.trim() ?? ""),
    addr_line1: pick("addr_line1", str(addr.line1)),
    addr_city: pick("addr_city", str(addr.city)),
    addr_state: pick("addr_state", str(addr.state)),
    addr_pincode: pick("addr_pincode", str(addr.pincode ?? addr.postal_code)),
    contact_email: pick("contact_email", vendor.contact_email?.trim() ?? ""),
    contact_phone: pick("contact_phone", vendor.contact_phone?.trim() ?? ""),
    contact_person_name: pick("contact_person_name", vendor.contact_person_name?.trim() ?? ""),
    contact_person_role: pick("contact_person_role", vendor.contact_person_role?.trim() ?? ""),
    contact_person_phone: pick("contact_person_phone", vendor.contact_person_phone?.trim() ?? ""),
    contact_person_email: pick("contact_person_email", vendor.contact_person_email?.trim() ?? ""),
    operating_regions_text: pick("operating_regions_text", joinList(vendor.operating_regions)),
    service_areas_text: pick("service_areas_text", joinList(vendor.service_areas)),
    experience_summary: pick("experience_summary", vendor.experience_summary?.trim() ?? ""),
    years_in_business: pick(
      "years_in_business",
      vendor.years_in_business != null ? String(vendor.years_in_business) : "",
    ),
    workforce_headcount: pick("workforce_headcount", str(m.workforce_headcount)),
    equipment_text: pick("equipment_text", joinList(vendor.equipment_available)),
    flag_safety_training: Boolean(vendor.flag_safety_training),
    flag_ppe_available: Boolean(vendor.flag_ppe_available),
    flag_insurance_coverage: Boolean(vendor.flag_insurance_coverage),
    bank_name: pick("bank_name", str(bankMeta.bank_name)),
    bank_ifsc: pick("bank_ifsc", str(bankMeta.ifsc ?? bankMeta.bank_ifsc)),
    // Never hydrate full account from DB (we only store last4). Empty unless draft has digits.
    bank_account_number: pick("bank_account_number", ""),
  };
}

export function vendorDocPathsFromRow(vendor: VendorRow): VendorIntakeUploadDocPaths {
  return {
    pan: vendor.doc_pan_url,
    aadhaar: vendor.doc_aadhaar_url,
    gst: vendor.doc_gst_url,
    bank_proof: vendor.doc_bank_proof_url,
  };
}

/**
 * Whether the logged-in vendor may leave the forced profile stepper.
 * No vendor row → not complete (caller should send them to public `/signup`).
 */
export function vendorProfileIsComplete(vendor: VendorRow | null | undefined): boolean {
  if (!vendor) return false;
  if (!vendor.business_name?.trim() || vendor.business_name.trim() === "Draft partner application") {
    return false;
  }
  const form = vendorRowToProfileForm(vendor);
  const uploadDocPaths = vendorDocPathsFromRow(vendor);
  const bankOnFile = vendorHasBankDetailsOnFile(vendor);

  for (const section of VENDOR_PROFILE_COMPLETE_SECTIONS) {
    if (section === "bank" && bankOnFile) {
      // Name/IFSC/last4 already stored — do not require re-entry of full account number.
      continue;
    }
    const err = validateVendorIntakeSignupSection(section, form, { uploadDocPaths });
    if (err) return false;
  }
  return true;
}

/** First incomplete step index in `VENDOR_PROFILE_COMPLETE_SECTIONS`, or -1 when complete. */
export function vendorProfileFirstIncompleteStepIndex(
  vendor: VendorRow | null | undefined,
): number {
  if (!vendor) return 0;
  const form = vendorRowToProfileForm(vendor);
  const uploadDocPaths = vendorDocPathsFromRow(vendor);
  const bankOnFile = vendorHasBankDetailsOnFile(vendor);

  for (let i = 0; i < VENDOR_PROFILE_COMPLETE_SECTIONS.length; i++) {
    const section = VENDOR_PROFILE_COMPLETE_SECTIONS[i]!;
    if (section === "bank" && bankOnFile) continue;
    const err = validateVendorIntakeSignupSection(section, form, { uploadDocPaths });
    if (err) return i;
  }
  return -1;
}

export function validateVendorProfileCompleteSection(
  section: VendorProfileCompleteSection,
  form: VendorIntakeSignupForm,
  opts?: {
    uploadDocPaths?: VendorIntakeUploadDocPaths;
    bankOnFile?: boolean;
    bankAccountRequired?: boolean;
  },
): string | null {
  if (section === "bank" && opts?.bankOnFile && !opts.bankAccountRequired) {
    const nameErr = form.bank_name.trim() ? null : "Bank name is required.";
    if (nameErr) return nameErr;
    return validateVendorIntakeSignupSection("bank", {
      ...form,
      // Satisfy account-number check without re-entry when already on file.
      bank_account_number: form.bank_account_number.trim() || "000000000",
    });
  }
  return validateVendorIntakeSignupSection(section, form, {
    uploadDocPaths: opts?.uploadDocPaths,
  });
}
