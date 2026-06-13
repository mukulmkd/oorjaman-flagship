import type { Json, TechnicianRow, VendorTechnicianInviteRow } from "../database.types";
import { normalizePhoneE164 } from "../auth/auth-api";

export type TechnicianDisplayExtras = {
  inviteFullName?: string | null;
  userFullName?: string | null;
};

function readMetadataString(metadata: Json | null | undefined, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Normalize phone strings for invite ↔ technician roster matching. */
export function technicianPhoneLookupKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    return normalizePhoneE164(trimmed);
  } catch {
    const digits = trimmed.replace(/\D/g, "");
    return digits.length >= 10 ? `+${digits}` : null;
  }
}

/** Map invite phone → name from vendor invite rows. */
export function inviteFullNameByPhone(
  invites: VendorTechnicianInviteRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const inv of invites) {
    const phoneKey = technicianPhoneLookupKey(inv.invite_phone_e164);
    const name = inv.full_name?.trim();
    if (phoneKey && name) map.set(phoneKey, name);
  }
  return map;
}

export function inviteFullNameForTechnician(
  technician: Pick<TechnicianRow, "personal_phone">,
  inviteNamesByPhone: Map<string, string>,
): string | null {
  const phoneKey = technicianPhoneLookupKey(technician.personal_phone);
  if (!phoneKey) return null;
  return inviteNamesByPhone.get(phoneKey) ?? null;
}

/** Resolved person name — never falls back to phone (phone is shown separately). */
export function technicianProfileName(
  technician: TechnicianRow,
  extras?: TechnicianDisplayExtras,
): string | null {
  return (
    technician.name_as_per_aadhaar?.trim() ||
    extras?.userFullName?.trim() ||
    readMetadataString(technician.metadata, "full_name") ||
    readMetadataString(technician.metadata, "display_name") ||
    readMetadataString(technician.metadata, "invite_full_name") ||
    extras?.inviteFullName?.trim() ||
    technician.bank_account_holder_name?.trim() ||
    null
  );
}

/** Primary roster / modal label when only a single line is needed. */
export function technicianDisplayLabel(
  technician: TechnicianRow,
  extras?: TechnicianDisplayExtras,
): string {
  const name = technicianProfileName(technician, extras);
  if (name) return name;
  const phone = technician.personal_phone?.trim();
  const email = technician.contact_email?.trim();
  const code = technician.employee_code?.trim();
  return phone || email || code || `Technician ${technician.id.slice(0, 8)}`;
}

/** Assign-technician dropdown: name and mobile together when both are known. */
export function technicianAssignOptionLabel(
  technician: TechnicianRow,
  extras?: TechnicianDisplayExtras,
): string {
  const name = technicianProfileName(technician, extras);
  const phone = technician.personal_phone?.trim();
  const code = technician.employee_code?.trim();
  const parts: string[] = [];
  if (name) parts.push(name);
  if (phone && phone !== name) parts.push(phone);
  if (code) parts.push(code);
  if (parts.length > 0) return parts.join(" · ");
  return technicianDisplayLabel(technician, extras);
}

/** Persist vendor invite name on technician metadata for partner roster labels. */
export function mergeInviteFullNameIntoMetadata(
  metadata: Json | null | undefined,
  inviteFullName: string | null | undefined,
): Json {
  const name = inviteFullName?.trim();
  if (!name) return metadata ?? {};
  const o =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, Json>) }
      : {};
  if (!readMetadataString(o as Json, "invite_full_name")) {
    (o as Record<string, Json>).invite_full_name = name;
  }
  return o as Json;
}
