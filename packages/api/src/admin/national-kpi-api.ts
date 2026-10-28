import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus, Database, Json } from "../database.types";

const IST = "Asia/Kolkata";
const PAGE = 1000;
const CAP = 20000;
const DAY_MS = 86_400_000;

const CONFIRMED: BookingStatus[] = ["confirmed", "vendor_acknowledged", "accepted", "in_progress", "completed"];
const REQUEST_SENT: BookingStatus[] = [...CONFIRMED, "cancelled"];
const PARTNER_ACCEPTED: BookingStatus[] = ["accepted", "in_progress", "completed"];
const SAFETY_KEYS = ["aware_of_safety_measures", "reviewed_guidelines", "ack_job_start_code", "ack_ppe_on_site"] as const;

export type NationalKpiWindow = {
  label: string;
  startIso: string;
  endIso: string;
};

export type NationalKpiFormat = "count" | "money" | "percent" | "ratio";

export type NationalKpiItem = {
  id: string;
  label: string;
  hint: string;
  href: string;
  format: NationalKpiFormat;
  thisWeek: number | null;
  lastWeek: number | null;
  thisDetail: string;
  lastDetail: string;
};

export type NationalKpiGroup = {
  title: string;
  items: NationalKpiItem[];
};

export type NationalKpiScorecard = {
  thisWeek: NationalKpiWindow;
  lastWeek: NationalKpiWindow;
  truncated: boolean;
  groups: NationalKpiGroup[];
};

type BookingSlice = {
  id: string;
  customer_id: string;
  vendor_id: string | null;
  technician_id: string | null;
  status: BookingStatus;
  created_at: string;
  actual_end: string | null;
  final_price_cents: number | null;
  estimated_price_cents: number;
};

type ReportSlice = {
  booking_id: string;
  completed_at: string;
  customer_rating: number | null;
  checklist: Json;
  before_photo_urls: Json;
  after_photo_urls: Json;
};

type VendorSlice = {
  approval_status: string;
  approved_at: string | null;
};

type TechnicianSlice = {
  verification_status: string;
  verification_reviewed_at: string | null;
};

type Span = { startMs: number; endMs: number; label: string; startIso: string; endIso: string };

export type NationalKpiSource = {
  bookings: BookingSlice[];
  reports: ReportSlice[];
  vendors: VendorSlice[];
  technicians: TechnicianSlice[];
  truncated: boolean;
};

export type NationalKpiWeekBounds = {
  mondayYmd: string;
  sundayYmd: string;
};

function istYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function mondayStartIst(date: Date): Date {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: IST, weekday: "short" }).format(date);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const mondayOffset = index <= 0 ? 6 : index - 1;
  const dayStart = new Date(`${istYmd(date)}T00:00:00+05:30`);
  return new Date(dayStart.getTime() - mondayOffset * DAY_MS);
}

function spansFromMonday(thisMonday: Date): { thisWeek: Span; lastWeek: Span } {
  const lastMonday = new Date(thisMonday.getTime() - 7 * DAY_MS);
  return {
    thisWeek: toSpan(thisMonday),
    lastWeek: toSpan(lastMonday),
  };
}

/** Monday and Sunday of the current India week. Sunday is the latest day an admin can pick. */
export function nationalKpiWeekBounds(now = new Date()): NationalKpiWeekBounds {
  const monday = mondayStartIst(now);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  return { mondayYmd: istYmd(monday), sundayYmd: istYmd(sunday) };
}

/** Monday of the India week that contains `date`, never later than the current week. */
export function nationalKpiMondayYmd(date: Date, now = new Date()): string {
  const picked = mondayStartIst(date);
  const current = mondayStartIst(now);
  const monday = picked.getTime() > current.getTime() ? current : picked;
  return istYmd(monday);
}

function toSpan(start: Date): Span {
  const end = new Date(start.getTime() + 7 * DAY_MS);
  const lastDay = new Date(end.getTime() - 1);
  const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short" });
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${fmt.format(start)} – ${fmt.format(lastDay)}`,
  };
}

function inSpan(iso: string | null | undefined, span: Span): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  return ms >= span.startMs && ms < span.endMs;
}

function hasPhotos(value: Json): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0);
}

function checklistDone(checklist: Json): boolean {
  if (!checklist || typeof checklist !== "object" || Array.isArray(checklist)) return false;
  const pre = (checklist as Record<string, unknown>).pre_start;
  if (!pre || typeof pre !== "object" || Array.isArray(pre)) return false;
  const row = pre as Record<string, unknown>;
  return SAFETY_KEYS.every((key) => row[key] === true);
}

function visitValuePaise(booking: BookingSlice): number {
  return Math.max(0, booking.final_price_cents ?? booking.estimated_price_cents ?? 0);
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function countWhere<T>(rows: T[], pred: (row: T) => boolean): number {
  let n = 0;
  for (const row of rows) if (pred(row)) n += 1;
  return n;
}

function buildScorecard(input: {
  spans: { thisWeek: Span; lastWeek: Span };
  bookings: BookingSlice[];
  reports: ReportSlice[];
  vendors: VendorSlice[];
  technicians: TechnicianSlice[];
  truncated: boolean;
}): NationalKpiScorecard {
  const { spans, bookings, reports, vendors, technicians, truncated } = input;
  const completed = bookings.filter((row) => row.status === "completed" && row.actual_end);
  const reportByBooking = new Map<string, ReportSlice>();
  for (const report of reports) {
    const existing = reportByBooking.get(report.booking_id);
    if (!existing || report.completed_at > existing.completed_at) reportByBooking.set(report.booking_id, report);
  }

  const firstCompletionByVendor = new Map<string, number>();
  for (const booking of completed) {
    if (!booking.vendor_id || !booking.actual_end) continue;
    const ms = new Date(booking.actual_end).getTime();
    const prev = firstCompletionByVendor.get(booking.vendor_id);
    if (prev == null || ms < prev) firstCompletionByVendor.set(booking.vendor_id, ms);
  }

  function weekItems(span: Span) {
    const created = bookings.filter((row) => inSpan(row.created_at, span));
    const finished = completed.filter((row) => inSpan(row.actual_end, span));
    const confirmed = countWhere(created, (row) => CONFIRMED.includes(row.status));
    const gmv = finished.reduce((sum, row) => sum + visitValuePaise(row), 0);
    const finishedCustomers = new Set(finished.map((row) => row.customer_id));
    let returning = 0;
    for (const customerId of finishedCustomers) {
      const prior = completed.some(
        (row) => row.customer_id === customerId && new Date(row.actual_end!).getTime() < span.startMs,
      );
      if (prior) returning += 1;
    }
    const rated = reports.filter((row) => inSpan(row.completed_at, span) && row.customer_rating != null);
    const ratingSum = rated.reduce((sum, row) => sum + (row.customer_rating ?? 0), 0);
    const withChecklist = countWhere(finished, (row) => {
      const report = reportByBooking.get(row.id);
      return report ? checklistDone(report.checklist) : false;
    });
    const withPhotos = countWhere(finished, (row) => {
      const report = reportByBooking.get(row.id);
      return report ? hasPhotos(report.before_photo_urls) && hasPhotos(report.after_photo_urls) : false;
    });
    const sent = countWhere(created, (row) => REQUEST_SENT.includes(row.status));
    const accepted = countWhere(created, (row) => PARTNER_ACCEPTED.includes(row.status));
    const createdCompleted = countWhere(created, (row) => row.status === "completed");
    const techs = new Set(finished.map((row) => row.technician_id).filter((id): id is string => Boolean(id)));
    const jobs = countWhere(finished, (row) => Boolean(row.technician_id));
    const approved = countWhere(
      vendors,
      (row) => row.approval_status === "approved" && inSpan(row.approved_at, span),
    );
    let activated = 0;
    for (const ms of firstCompletionByVendor.values()) {
      if (ms >= span.startMs && ms < span.endMs) activated += 1;
    }
    const verified = countWhere(
      technicians,
      (row) => row.verification_status === "verified" && inSpan(row.verification_reviewed_at, span),
    );
    return {
      confirmed,
      gmv,
      returning,
      finishedCustomers: finishedCustomers.size,
      ratingSum,
      rated: rated.length,
      finished: finished.length,
      withChecklist,
      withPhotos,
      sent,
      accepted,
      createdCompleted,
      jobs,
      techs: techs.size,
      approved,
      activated,
      verified,
    };
  }

  const current = weekItems(spans.thisWeek);
  const previous = weekItems(spans.lastWeek);

  const item = (
    id: string,
    label: string,
    hint: string,
    href: string,
    format: NationalKpiFormat,
    thisWeek: number | null,
    lastWeek: number | null,
    thisDetail: string,
    lastDetail: string,
  ): NationalKpiItem => ({ id, label, hint, href, format, thisWeek, lastWeek, thisDetail, lastDetail });

  const share = (part: number, whole: number) => (whole > 0 ? `${part} of ${whole}` : "No finished visits");

  return {
    thisWeek: { label: spans.thisWeek.label, startIso: spans.thisWeek.startIso, endIso: spans.thisWeek.endIso },
    lastWeek: { label: spans.lastWeek.label, startIso: spans.lastWeek.startIso, endIso: spans.lastWeek.endIso },
    truncated,
    groups: [
      {
        title: "Growth and revenue",
        items: [
          item(
            "confirmed",
            "Confirmed bookings",
            "Created in the week and no longer waiting for payment. Cancelled bookings are not included.",
            "/dashboard/bookings",
            "count",
            current.confirmed,
            previous.confirmed,
            "",
            "",
          ),
          item(
            "gmv",
            "Completed visit value",
            "Customer price of visits that finished in the week. This is not the platform fee on Finance.",
            "/dashboard/finance",
            "money",
            current.gmv,
            previous.gmv,
            current.finished === 1 ? "1 finished visit" : `${current.finished} finished visits`,
            previous.finished === 1 ? "1 finished visit" : `${previous.finished} finished visits`,
          ),
          item(
            "repeat",
            "Repeat visit rate",
            "Customers who finished a visit in the week and had already finished an earlier one.",
            "/dashboard/bookings",
            "percent",
            rate(current.returning, current.finishedCustomers),
            rate(previous.returning, previous.finishedCustomers),
            share(current.returning, current.finishedCustomers),
            share(previous.returning, previous.finishedCustomers),
          ),
        ],
      },
      {
        title: "Service quality",
        items: [
          item(
            "csat",
            "Post-visit rating",
            "Average customer rating on visit reports finished in the week, from 1 to 5.",
            "/dashboard/trust-safety",
            "ratio",
            current.rated > 0 ? current.ratingSum / current.rated : null,
            previous.rated > 0 ? previous.ratingSum / previous.rated : null,
            current.rated === 1 ? "1 rating" : `${current.rated} ratings`,
            previous.rated === 1 ? "1 rating" : `${previous.rated} ratings`,
          ),
          item(
            "checklist",
            "Safety checklist",
            "Finished visits whose report has every pre-start safety acknowledgement.",
            "/dashboard/bookings",
            "percent",
            rate(current.withChecklist, current.finished),
            rate(previous.withChecklist, previous.finished),
            share(current.withChecklist, current.finished),
            share(previous.withChecklist, previous.finished),
          ),
          item(
            "photos",
            "Before and after photos",
            "Finished visits with at least one before photo and one after photo.",
            "/dashboard/bookings",
            "percent",
            rate(current.withPhotos, current.finished),
            rate(previous.withPhotos, previous.finished),
            share(current.withPhotos, current.finished),
            share(previous.withPhotos, previous.finished),
          ),
          item(
            "completion",
            "Completion rate",
            "Bookings created in the week that the partner accepted, and that are now completed.",
            "/dashboard/bookings",
            "percent",
            rate(current.createdCompleted, current.accepted),
            rate(previous.createdCompleted, previous.accepted),
            share(current.createdCompleted, current.accepted).replace("finished visits", "accepted bookings"),
            share(previous.createdCompleted, previous.accepted).replace("finished visits", "accepted bookings"),
          ),
        ],
      },
      {
        title: "Network",
        items: [
          item(
            "approved",
            "Partners approved",
            "Partners whose approval date falls in the week.",
            "/dashboard/vendors/approved",
            "count",
            current.approved,
            previous.approved,
            "",
            "",
          ),
          item(
            "activation",
            "Partners activated",
            "Partners whose first finished visit falls in the week.",
            "/dashboard/vendors/approved",
            "count",
            current.activated,
            previous.activated,
            "",
            "",
          ),
          item(
            "verified",
            "Technicians verified",
            "Technicians marked verified in the week. This is the review record, not a separate training exam.",
            "/dashboard/technicians",
            "count",
            current.verified,
            previous.verified,
            "",
            "",
          ),
          item(
            "jobs-per-tech",
            "Jobs per technician",
            "Finished visits with an assigned technician, divided by technicians who finished at least one.",
            "/dashboard/technicians",
            "ratio",
            rate(current.jobs, current.techs),
            rate(previous.jobs, previous.techs),
            current.techs === 1 ? `${current.jobs} jobs · 1 technician` : `${current.jobs} jobs · ${current.techs} technicians`,
            previous.techs === 1
              ? `${previous.jobs} jobs · 1 technician`
              : `${previous.jobs} jobs · ${previous.techs} technicians`,
          ),
          item(
            "acceptance",
            "Acceptance rate",
            "Bookings created in the week that reached a partner, and that the partner then accepted. Visits still acknowledged but not accepted count as not accepted.",
            "/dashboard/partners/quality",
            "percent",
            rate(current.accepted, current.sent),
            rate(previous.accepted, previous.sent),
            share(current.accepted, current.sent).replace("finished visits", "requests"),
            share(previous.accepted, previous.sent).replace("finished visits", "requests"),
          ),
        ],
      },
    ],
  };
}

async function selectPages<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < CAP; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export function nationalKpiScorecardForWeek(source: NationalKpiSource, weekOf: Date = new Date()): NationalKpiScorecard {
  const monday = new Date(`${nationalKpiMondayYmd(weekOf)}T00:00:00+05:30`);
  return buildScorecard({
    spans: spansFromMonday(monday),
    bookings: source.bookings,
    reports: source.reports,
    vendors: source.vendors,
    technicians: source.technicians,
    truncated: source.truncated,
  });
}

export async function adminFetchNationalKpiSource(client: SupabaseClient<Database>): Promise<NationalKpiSource> {
  const [bookings, reports, vendors, technicians] = await Promise.all([
    selectPages<BookingSlice>((from, to) =>
      client
        .from("bookings")
        .select(
          "id, customer_id, vendor_id, technician_id, status, created_at, actual_end, final_price_cents, estimated_price_cents",
        )
        .order("id", { ascending: true })
        .range(from, to),
    ),
    selectPages<ReportSlice>((from, to) =>
      client
        .from("job_reports")
        .select("booking_id, completed_at, customer_rating, checklist, before_photo_urls, after_photo_urls")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    selectPages<VendorSlice>((from, to) =>
      client.from("vendors").select("approval_status, approved_at").order("id", { ascending: true }).range(from, to),
    ),
    selectPages<TechnicianSlice>((from, to) =>
      client
        .from("technicians")
        .select("verification_status, verification_reviewed_at")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  return {
    bookings: bookings.rows,
    reports: reports.rows,
    vendors: vendors.rows,
    technicians: technicians.rows,
    truncated: bookings.truncated || reports.truncated || vendors.truncated || technicians.truncated,
  };
}

export async function adminFetchNationalKpiScorecard(
  client: SupabaseClient<Database>,
  now = new Date(),
): Promise<NationalKpiScorecard> {
  const source = await adminFetchNationalKpiSource(client);
  return nationalKpiScorecardForWeek(source, now);
}
