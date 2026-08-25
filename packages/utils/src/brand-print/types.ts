export const BRAND_EMAIL_DOMAIN = "oorjaman.com" as const;

export type BrandPrintContact = {
  company: string;
  /** Full legal name for letterhead footer. */
  companyLegal: string;
  descriptor: string;
  tagline: string;
  phone: string;
  email: string;
  web: string;
  url: string;
  address: string;
  cardName: string;
  cardTitle: string;
  /** Seller GSTIN for tax invoices. Override when finance confirms a change. */
  gstin: string;
};

export const DEFAULT_BRAND_PRINT_CONTACT: BrandPrintContact = {
  company: "OorjaMan",
  companyLegal: "OORJA MAN LLP",
  descriptor: "Solar panel cleaning & preventive care",
  tagline: "WE CLEAN. YOU GENERATE.",
  phone: "+91 98765 43210",
  email: "info@oorjaman.com",
  web: "www.oorjaman.com",
  url: "https://oorjaman.com",
  address: "House No. 18, Bye Lane 2, Zoo Road Tiniali, Guwahati, Assam 781001, India",
  cardName: "Your Name",
  cardTitle: "Designated Partner",
  gstin: "18AAKFO2664E1Z5",
};

export function slugifyBrandFileName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "oorjaman";
}

/** Staff email on print collateral — always @oorjaman.com. */
export function suggestBrandEmailFromName(name: string): string {
  const parts = name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[^a-z0-9]/g, ""));
  const local = parts.filter(Boolean).join(".");
  return local ? `${local}@${BRAND_EMAIL_DOMAIN}` : `info@${BRAND_EMAIL_DOMAIN}`;
}

export function normalizeBrandEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return `info@${BRAND_EMAIL_DOMAIN}`;
  return trimmed.replace(/@oorjaman\.in$/i, `@${BRAND_EMAIL_DOMAIN}`);
}
