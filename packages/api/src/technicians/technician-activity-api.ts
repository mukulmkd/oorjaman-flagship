import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus, Database, TechnicianActivityEventRow } from "../database.types";
import { takeRows } from "../result";
import { getMyTechnicianProfile } from "./technician-api";

export type {
  TechnicianActivityEventRow,
  TechnicianActivityKind,
} from "../database.types";

export type TechnicianActivityPage = {
  items: TechnicianActivityEventRow[];
  hasMore: boolean;
  nextOffset: number;
};

const DEFAULT_PAGE_SIZE = 10;

export function readTechnicianActivityReferenceCode(event: TechnicianActivityEventRow): string | null {
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return null;
  const v = (event.payload as Record<string, unknown>).reference_code;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function readTechnicianActivityBookingStatus(
  event: TechnicianActivityEventRow,
): BookingStatus | null {
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) return null;
  const v = (event.payload as Record<string, unknown>).status;
  return typeof v === "string" ? (v as BookingStatus) : null;
}

export function isTechnicianActivityExecutable(event: TechnicianActivityEventRow): boolean {
  return (
    event.kind === "job_status_in_progress" ||
    readTechnicianActivityBookingStatus(event) === "in_progress"
  );
}

/** Paginated activity timeline for the signed-in technician (RLS-scoped events). */
export async function listTechnicianActivityPage(
  client: SupabaseClient<Database>,
  options?: { offset?: number; limit?: number },
): Promise<TechnicianActivityPage> {
  const offset = Math.max(options?.offset ?? 0, 0);
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_PAGE_SIZE, 1), 50);
  const fetchLimit = limit + 1;

  const { data, error } = await client
    .from("technician_activity_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  const rows = takeRows(data, error);
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  return {
    items: pageRows,
    hasMore,
    nextOffset: offset + pageRows.length,
  };
}

export async function subscribeTechnicianActivity(
  client: SupabaseClient<Database>,
  onChange: () => void,
): Promise<() => void> {
  const profile = await getMyTechnicianProfile(client);
  if (!profile) return () => {};

  const channel = client
    .channel(`technician-activity:${profile.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "technician_activity_events",
        filter: `technician_id=eq.${profile.id}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
