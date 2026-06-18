/** Known canonical skill slugs stored in `technicians.skills`. */
const TECHNICIAN_SKILL_LABELS: Record<string, string> = {
  solar_cleaning: "Solar panel cleaning",
  rope_access: "Rope access",
  water_fed_poles: "Water-fed poles",
  high_rise: "High-rise cleaning",
  panel_inspection: "Panel inspection",
};

function snakeCaseToTitle(raw: string): string {
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function skillLookupKey(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Human-readable label for one stored skill value. */
export function formatTechnicianSkill(skill: string): string {
  const trimmed = skill.trim();
  if (!trimmed) return "";
  const key = skillLookupKey(trimmed);
  return TECHNICIAN_SKILL_LABELS[key] ?? (key.includes("_") ? snakeCaseToTitle(key) : trimmed);
}

/** Comma-separated skills for profile and roster UIs. */
export function formatTechnicianSkills(skills: string[] | null | undefined, empty = "-"): string {
  if (!skills?.length) return empty;
  return skills.map(formatTechnicianSkill).filter(Boolean).join(", ");
}
