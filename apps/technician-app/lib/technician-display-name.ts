import type { TechnicianRow, UserRow } from "@oorjaman/api";

function firstToken(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** First name for home greeting — avoids generic “Partner” when Aadhaar name is not set yet. */
export function technicianGreetingName(
  tech: TechnicianRow | null | undefined,
  user: UserRow | null | undefined,
): string {
  const fromAadhaar = tech?.name_as_per_aadhaar?.trim();
  if (fromAadhaar) return firstToken(fromAadhaar);

  const fromUser = user?.full_name?.trim();
  if (fromUser) return firstToken(fromUser);

  const fromBank = tech?.bank_account_holder_name?.trim();
  if (fromBank) return firstToken(fromBank);

  return "there";
}
