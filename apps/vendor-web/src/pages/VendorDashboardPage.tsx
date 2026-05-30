import { webTypography } from "./../styles/typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingRow, Json, TechnicianRow } from "@oorjaman/api";
import {
  bookingApi,
  createTechnicianDocumentSignedUrl,
  DEFAULT_TABLE_PAGE_SIZE,
  formatInrFromCents,
  listVendorJobReports,
  listVendorPayments,
  queryKeys,
  readBookingCustomerCancellationMeta,
  readBookingOpsMeta,
  readBookingRecipientMeta,
  technicianApi,
  vendorApi,
  isWithinVendorResponseWindow,
  vendorResponseDeadline,
} from "@oorjaman/api";
import { formatDayChip, listSelectableDayKeys, slotsForDay, type BookingSlotOption } from "@oorjaman/utils";
import { DocumentViewButton } from "../components/DocumentViewer";
import { bookingValueCents } from "./vendor-dashboard/metrics";
import { formatInr, formatScheduleRange } from "./vendor-dashboard/formatters";
import { VendorFinanceTab } from "./vendor-dashboard/VendorFinanceTab";
import { VendorInsightsTab } from "./vendor-dashboard/VendorInsightsTab";
import { VendorCoverageTab } from "./vendor-dashboard/VendorCoverageTab";
import {
  isVendorDashTabId,
  VENDOR_DASH_DEFAULT_TAB,
  type VendorDashTabId,
} from "./vendor-dashboard/vendor-dash-tabs";
import {
  Badge,
  Button,
  Card,
  Modal,
  TextArea,
} from "@oorjaman/web-ui";
import { BookingSitePhotos } from "../components/BookingSitePhotos";
import { TablePaginationBar } from "../components/TablePaginationBar";
import { useSupabase } from "../lib/supabase-context";
import "./vendor-dashboard.css";

function formatSiteAddress(addr: Json): string {
  if (addr == null) return "-";
  if (typeof addr === "string") return addr.trim() || "-";
  if (typeof addr === "object" && !Array.isArray(addr)) {
    const o = addr as Record<string, unknown>;
    const line =
      (typeof o.line1 === "string" && o.line1) ||
      (typeof o.line_1 === "string" && o.line_1) ||
      "";
    const city = typeof o.city === "string" ? o.city : "";
    const state = typeof o.state === "string" ? o.state : "";
    const pin = typeof o.pincode === "string" ? o.pincode : "";
    const parts = [line, [city, state].filter(Boolean).join(", "), pin].filter(Boolean);
    const s = parts.join(" · ");
    return s || "-";
  }
  return "-";
}

function readMetadataString(metadata: Json | null | undefined, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const v = (metadata as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Human-readable name for roster and booking labels (avoids raw UUID). */
function technicianDisplayName(t: TechnicianRow): string {
  const legalName = t.name_as_per_aadhaar?.trim();
  const metaName =
    legalName ||
    readMetadataString(t.metadata, "full_name") ||
    readMetadataString(t.metadata, "display_name") ||
    readMetadataString(t.metadata, "invite_full_name");
  const bank = t.bank_account_holder_name?.trim();
  const personal = t.personal_phone?.trim();
  const email = t.contact_email?.trim();
  const code = t.employee_code?.trim();
  const line = metaName || bank || personal || email || code;
  return line ?? `Technician ${t.id.slice(0, 8)}`;
}

function technicianOptionLabel(t: TechnicianRow): string {
  const name = technicianDisplayName(t);
  const code = t.employee_code?.trim();
  return code ? `${name} · ${code}` : name;
}

function techDisplayLabel(map: Map<string, TechnicianRow>, id: string | null): string {
  if (!id) return "-";
  const t = map.get(id);
  if (!t) return id.slice(0, 8) + "…";
  return technicianOptionLabel(t);
}

function readPenaltyPaiseFromMeta(metadata: Json): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const raw = (metadata as Record<string, unknown>).vendor_cancellation_penalty;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const paise = (raw as Record<string, unknown>).penalty_paise;
  return typeof paise === "number" && Number.isFinite(paise) ? Math.max(0, Math.round(paise)) : 0;
}

function statusTone(
  s: BookingRow["status"],
): "neutral" | "warning" | "success" | "danger" {
  switch (s) {
    case "confirmed":
      return "warning";
    case "accepted":
    case "in_progress":
      return "success";
    case "cancelled":
      return "danger";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
}

function vendorBookingStatusLabel(s: BookingRow["status"]): string {
  switch (s) {
    case "pending_payment":
      return "Pending payment";
    case "confirmed":
      return "Awaiting response";
    case "vendor_acknowledged":
      return "Acknowledged";
    case "accepted":
      return "Accepted";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}

function responseSlaTone(ratePercent: number): "success" | "warning" | "danger" {
  if (ratePercent <= 10) return "success";
  if (ratePercent <= 25) return "warning";
  return "danger";
}

function responseSlaLabel(ratePercent: number): "Good" | "Warning" | "Critical" {
  if (ratePercent <= 10) return "Good";
  if (ratePercent <= 25) return "Warning";
  return "Critical";
}

function serviceForLabel(b: BookingRow): string {
  const rec = readBookingRecipientMeta(b.metadata);
  if (!rec) return "Customer";
  if (rec.is_self) return "Customer";
  return rec.recipient_name?.trim() || "Someone else";
}

function opsWatchLabel(b: BookingRow): string | null {
  const ops = readBookingOpsMeta(b.metadata);
  if (!ops || ops.issue_count <= 0) return null;
  return `Ops watch (${ops.issue_count})`;
}

function vdEllipsis(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Vendor may approve/reject after the technician has submitted (not draft). */
function vendorCanActOnTechnicianReview(t: TechnicianRow): boolean {
  return t.verification_status !== "draft";
}

/** E.164 or local mobile: at least 10 digits (India and most regions). */
function invitePhoneMeetsMinimum(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10;
}

type VendorDashRowAction =
  | null
  | { kind: "slot"; slot: BookingSlotOption }
  | { kind: "marketplace"; booking: BookingRow }
  | { kind: "incoming"; booking: BookingRow }
  | { kind: "active"; booking: BookingRow }
  | { kind: "history"; booking: BookingRow };

const VENDOR_BOOKINGS_LIMIT = 500;

export default function VendorDashboardPage() {
  const supabase = useSupabase();
  const resolveTechnicianDocUrl = useCallback(
    (storagePath: string) => createTechnicianDocumentSignedUrl(supabase!, storagePath),
    [supabase],
  );
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const qc = useQueryClient();

  const dashTab: VendorDashTabId = isVendorDashTabId(tab) ? tab : VENDOR_DASH_DEFAULT_TAB;

  useEffect(() => {
    if (tab === "settings") {
      navigate("/dashboard/coverage", { replace: true });
      return;
    }
    if (tab !== undefined && !isVendorDashTabId(tab)) {
      navigate(`/dashboard/${VENDOR_DASH_DEFAULT_TAB}`, { replace: true });
    }
  }, [tab, navigate]);

  const [acceptForId, setAcceptForId] = useState<string | null>(null);
  const [rejectForId, setRejectForId] = useState<string | null>(null);
  const [cancelAcceptedForId, setCancelAcceptedForId] = useState<string | null>(null);
  const [ackTechnicianReady, setAckTechnicianReady] = useState(false);
  const [ackSafetyCompliance, setAckSafetyCompliance] = useState(false);
  const [ackUniformSafetyKit, setAckUniformSafetyKit] = useState(false);
  const [ackProceduresBriefed, setAckProceduresBriefed] = useState(false);
  const [acceptTechnicianId, setAcceptTechnicianId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelAcceptedReason, setCancelAcceptedReason] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled" | "other">("all");
  const [vendorRowAction, setVendorRowAction] = useState<VendorDashRowAction>(null);
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamTechnicianDetailId, setTeamTechnicianDetailId] = useState<string | null>(null);
  const [vendorTeamRejectReason, setVendorTeamRejectReason] = useState("");
  const [availabilityDayKey, setAvailabilityDayKey] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [teamInvitesPage, setTeamInvitesPage] = useState(1);
  const [teamRosterPage, setTeamRosterPage] = useState(1);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const allBookingsQuery = useQuery({
    queryKey: queryKeys.bookings.vendorBookingsAll(VENDOR_BOOKINGS_LIMIT),
    queryFn: () => bookingApi.listVendorBookingsAll(supabase!, { limit: VENDOR_BOOKINGS_LIMIT }),
    enabled: Boolean(supabase),
  });
  const marketplaceBookingsQuery = useQuery({
    queryKey: [...queryKeys.bookings.all(), "vendor-marketplace"] as const,
    queryFn: () => bookingApi.listVendorMarketplaceBookings(supabase!),
    enabled: Boolean(supabase),
  });
  const availabilityDays = useMemo(() => listSelectableDayKeys(new Date(), 7), []);
  useEffect(() => {
    if (!availabilityDayKey && availabilityDays.length > 0) {
      setAvailabilityDayKey(availabilityDays[0] ?? null);
    }
  }, [availabilityDayKey, availabilityDays]);
  const slotRows = useMemo(
    () => (availabilityDayKey ? slotsForDay(availabilityDayKey, new Date()) : []),
    [availabilityDayKey],
  );
  const availabilityQuery = useQuery({
    queryKey: [...queryKeys.vendors.mine(), "slot-availability", availabilityDays.join(",")] as const,
    queryFn: () => vendorApi.listMyVendorSlotAvailability(supabase!, availabilityDays),
    enabled: Boolean(supabase && availabilityDays.length > 0),
  });
  const slotAvailabilityMap = useMemo(() => {
    const m = new Map<string, { is_available: boolean; capacity: number }>();
    for (const r of availabilityQuery.data ?? []) {
      m.set(`${r.day_key}__${r.slot_id}`, { is_available: r.is_available, capacity: r.capacity });
    }
    return m;
  }, [availabilityQuery.data]);

  const technicianIdsFromBookings = useMemo(() => {
    const s = new Set<string>();
    for (const b of allBookingsQuery.data ?? []) {
      if (b.technician_id) s.add(b.technician_id);
    }
    return [...s].sort();
  }, [allBookingsQuery.data]);

  const crewTechsQuery = useQuery({
    queryKey: [...queryKeys.bookings.all(), "partner-dashboard-crew", technicianIdsFromBookings.join(",")] as const,
    queryFn: async () => {
      if (!supabase || technicianIdsFromBookings.length === 0) return [];
      const { data, error } = await supabase.from("technicians").select("*").in("id", technicianIdsFromBookings);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: Boolean(supabase && technicianIdsFromBookings.length > 0),
  });

  const vendorMineQuery = useQuery({
    queryKey: queryKeys.vendors.mine(),
    queryFn: () => vendorApi.getMyVendor(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorPaymentsQuery = useQuery({
    queryKey: queryKeys.vendors.dashboardPayments(),
    queryFn: () => listVendorPayments(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorJobReportsQuery = useQuery({
    queryKey: queryKeys.vendors.dashboardJobReports(300),
    queryFn: () => listVendorJobReports(supabase!, { limit: 300 }),
    enabled: Boolean(supabase),
  });
  const vendorTechRosterQuery = useQuery({
    queryKey: queryKeys.technicians.vendorRoster(),
    queryFn: () => vendorApi.listTechniciansForMyVendor(supabase!),
    enabled: Boolean(supabase),
  });
  const vendorTechInvitesQuery = useQuery({
    queryKey: queryKeys.technicians.vendorInvites(),
    queryFn: () => technicianApi.vendorListMyTechnicianInvites(supabase!),
    enabled: Boolean(supabase),
  });

  const techById = useMemo(() => {
    const m = new Map<string, TechnicianRow>();
    for (const t of crewTechsQuery.data ?? []) m.set(t.id, t);
    return m;
  }, [crewTechsQuery.data]);

  /** Visits per technician assigned to this partner’s bookings. */
  const crewVisitStats = useMemo(() => {
    const map = new Map<string, { visits: number; lastAt: string }>();
    for (const b of allBookingsQuery.data ?? []) {
      if (!b.technician_id) continue;
      const cur = map.get(b.technician_id) ?? { visits: 0, lastAt: b.scheduled_start };
      cur.visits += 1;
      if (new Date(b.scheduled_start) > new Date(cur.lastAt)) cur.lastAt = b.scheduled_start;
      map.set(b.technician_id, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].visits - a[1].visits);
  }, [allBookingsQuery.data]);

  const rowsForVendorUi = useMemo(
    () =>
      (allBookingsQuery.data ?? []).filter(
        (b) => b.status !== "confirmed" || isWithinVendorResponseWindow(b),
      ),
    [allBookingsQuery.data],
  );
  const incoming = useMemo(
    () => rowsForVendorUi.filter((b) => b.status === "confirmed"),
    [rowsForVendorUi],
  );
  const missedResponseWindow = useMemo(
    () =>
      (allBookingsQuery.data ?? []).filter(
        (b) => b.status === "confirmed" && !isWithinVendorResponseWindow(b),
      ),
    [allBookingsQuery.data],
  );
  const responseSlaTrend = useMemo(() => {
    const rows = allBookingsQuery.data ?? [];
    const now = Date.now();
    const ms7 = 7 * 24 * 60 * 60 * 1000;
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const confirmed7 = rows.filter(
      (b) => b.status === "confirmed" && now - new Date(b.created_at).getTime() <= ms7,
    );
    const confirmed30 = rows.filter(
      (b) => b.status === "confirmed" && now - new Date(b.created_at).getTime() <= ms30,
    );
    const missed7 = confirmed7.filter((b) => !isWithinVendorResponseWindow(b));
    const missed30 = confirmed30.filter((b) => !isWithinVendorResponseWindow(b));
    const rate7 = confirmed7.length > 0 ? (missed7.length / confirmed7.length) * 100 : 0;
    const rate30 = confirmed30.length > 0 ? (missed30.length / confirmed30.length) * 100 : 0;
    return { confirmed7: confirmed7.length, confirmed30: confirmed30.length, missed7: missed7.length, missed30: missed30.length, rate7, rate30 };
  }, [allBookingsQuery.data]);

  const verifiedVendorTechnicians = useMemo(
    () =>
      (vendorTechRosterQuery.data ?? []).filter((t) => t.verification_status === "verified" && t.is_verified),
    [vendorTechRosterQuery.data],
  );

  const teamInvitesAll = useMemo(() => vendorTechInvitesQuery.data ?? [], [vendorTechInvitesQuery.data]);
  const teamInvitesTotal = teamInvitesAll.length;
  const teamInvitesWindow = useMemo(
    () =>
      teamInvitesAll.slice(
        (teamInvitesPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        teamInvitesPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [teamInvitesAll, teamInvitesPage],
  );

  const teamRosterAll = useMemo(() => vendorTechRosterQuery.data ?? [], [vendorTechRosterQuery.data]);
  const teamRosterTotal = teamRosterAll.length;
  const teamRosterWindow = useMemo(
    () =>
      teamRosterAll.slice(
        (teamRosterPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        teamRosterPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [teamRosterAll, teamRosterPage],
  );

  const teamTechnicianModal = useMemo(() => {
    if (!teamTechnicianDetailId) return null;
    return teamRosterAll.find((x) => x.id === teamTechnicianDetailId) ?? null;
  }, [teamRosterAll, teamTechnicianDetailId]);

  const active = useMemo(
    () =>
      (allBookingsQuery.data ?? []).filter((b) => b.status === "accepted" || b.status === "in_progress"),
    [allBookingsQuery.data],
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilter]);

  const overviewMetrics = useMemo(() => {
    const rows = allBookingsQuery.data ?? [];
    const completed = rows.filter((b) => b.status === "completed");
    const cancelled = rows.filter((b) => b.status === "cancelled");
    const completedValueCents = completed.reduce((sum, b) => sum + bookingValueCents(b), 0);
    const penaltyPaise = cancelled.reduce((sum, b) => sum + readPenaltyPaiseFromMeta(b.metadata), 0);
    const penalizedCancels = cancelled.filter((b) => readPenaltyPaiseFromMeta(b.metadata) > 0).length;
    return {
      totalBookings: rows.length,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      completedValueCents,
      penaltyPaise,
      penalizedCancels,
    };
  }, [allBookingsQuery.data]);

  const historyRows = useMemo(() => {
    const rows = [...(allBookingsQuery.data ?? [])].sort(
      (a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime(),
    );
    if (historyFilter === "all") return rows;
    if (historyFilter === "completed") return rows.filter((b) => b.status === "completed");
    if (historyFilter === "cancelled") return rows.filter((b) => b.status === "cancelled");
    return rows.filter(
      (b) => b.status !== "completed" && b.status !== "cancelled",
    );
  }, [allBookingsQuery.data, historyFilter]);

  const historyTotal = historyRows.length;
  const historyWindow = historyRows.slice(
    (historyPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
    historyPage * DEFAULT_TABLE_PAGE_SIZE,
  );

  const acceptMut = useMutation({
    mutationFn: async ({
      bookingId,
      technicianReadinessConfirmed,
      safetyComplianceConfirmed,
      uniformSafetyKitConfirmed,
      proceduresBriefedConfirmed,
    }: {
      bookingId: string;
      technicianReadinessConfirmed: boolean;
      safetyComplianceConfirmed: boolean;
      uniformSafetyKitConfirmed: boolean;
      proceduresBriefedConfirmed: boolean;
    }) =>
      bookingApi.vendorAcceptBookingRequest(supabase!, bookingId, {
        technicianId: acceptTechnicianId,
        technicianReadinessConfirmed,
        safetyComplianceConfirmed,
        uniformSafetyKitConfirmed,
        proceduresBriefedConfirmed,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.dashboardSettlements() });
      setAcceptForId(null);
      setAckTechnicianReady(false);
      setAckSafetyCompliance(false);
      setAckUniformSafetyKit(false);
      setAckProceduresBriefed(false);
      setAcceptTechnicianId("");
    },
  });

  const rejectMut = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      bookingApi.vendorRejectBookingRequest(supabase!, bookingId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.dashboardSettlements() });
      setRejectForId(null);
      setRejectReason("");
    },
  });
  const cancelAcceptedMut = useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      bookingApi.vendorCancelAcceptedBooking(supabase!, bookingId, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.vendors.dashboardSettlements() });
      setCancelAcceptedForId(null);
      setCancelAcceptedReason("");
    },
  });
  const claimMarketplaceMut = useMutation({
    mutationFn: async (bookingId: string) => bookingApi.vendorClaimMarketplaceBooking(supabase!, bookingId),
    onSuccess: () => {
      setVendorRowAction(null);
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all() });
      void marketplaceBookingsQuery.refetch();
    },
  });
  const availabilityMut = useMutation({
    mutationFn: async (input: { dayKey: string; slotId: string; isAvailable: boolean; capacity: number }) =>
      vendorApi.upsertMyVendorSlotAvailability(supabase!, input),
    onSuccess: () => {
      void availabilityQuery.refetch();
      void marketplaceBookingsQuery.refetch();
    },
  });
  const inviteMut = useMutation({
    mutationFn: async () =>
      technicianApi.vendorInviteTechnician(supabase!, {
        full_name: inviteName.trim() || undefined,
        invite_phone_e164: invitePhone.trim(),
        invite_email: inviteEmail.trim() || undefined,
        channels: ["email", "sms", "whatsapp"],
      }),
    onSuccess: () => {
      setInviteName("");
      setInvitePhone("");
      setInviteEmail("");
      setInviteModalOpen(false);
      void vendorTechInvitesQuery.refetch();
    },
  });
  const reviewMut = useMutation({
    mutationFn: async ({
      technicianId,
      decision,
      reason,
    }: {
      technicianId: string;
      decision: "approved" | "rejected";
      reason?: string;
    }) => technicianApi.vendorReviewTechnicianProfile(supabase!, technicianId, { decision, reason }),
    onSuccess: (row, variables) => {
      void vendorTechRosterQuery.refetch();
      if (variables.decision === "approved" && row.employee_code?.trim()) {
        window.alert(`Technician approved. OorjaMan ID: ${row.employee_code.trim()}`);
      }
      setTeamTechnicianDetailId((open) => (open === variables.technicianId ? null : open));
      setVendorTeamRejectReason("");
    },
  });

  const rowsForModal = allBookingsQuery.data;
  const acceptBooking =
    acceptForId && rowsForModal ? rowsForModal.find((b) => b.id === acceptForId) : undefined;
  const rejectBooking =
    rejectForId && rowsForModal ? rowsForModal.find((b) => b.id === rejectForId) : undefined;
  const cancelAcceptedBooking =
    cancelAcceptedForId && rowsForModal ? rowsForModal.find((b) => b.id === cancelAcceptedForId) : undefined;

  const refreshAll = () => {
    void allBookingsQuery.refetch();
    void crewTechsQuery.refetch();
    void vendorMineQuery.refetch();
    void vendorPaymentsQuery.refetch();
    void vendorJobReportsQuery.refetch();
    void vendorTechRosterQuery.refetch();
    void vendorTechInvitesQuery.refetch();
    void qc.invalidateQueries({ queryKey: queryKeys.vendors.dashboardSettlements() });
  };

  const onVendorSettingsSaved = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.vendors.mine() });
  };

  const openAccept = (b: BookingRow) => {
    setAcceptForId(b.id);
    setAckTechnicianReady(false);
    setAckSafetyCompliance(false);
    setAckUniformSafetyKit(false);
    setAckProceduresBriefed(false);
    setAcceptTechnicianId(verifiedVendorTechnicians[0]?.id ?? "");
  };

  const closeVendorRowAction = () => setVendorRowAction(null);

  return (
    <div className="vd-root">
      <header className="vd-header">
        <div>
          <h1 className="vd-title">Partner dashboard</h1>
          <p className="vd-sub">Track requests, active visits, and your assigned technicians.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button variant="outline" size="sm" type="button" onClick={() => void refreshAll()}>
            Refresh
          </Button>
        </div>
      </header>

      {!supabase ? (
        <Card padded>
          <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
            Configure Supabase to continue.
          </p>
        </Card>
      ) : allBookingsQuery.isLoading ? (
        <Card padded>
          <p style={{ margin: 0 }}>Loading…</p>
        </Card>
      ) : allBookingsQuery.isError ? (
        <Card padded>
          <p style={{ margin: 0, color: "var(--wb-destructive)" }}>{(allBookingsQuery.error as Error).message}</p>
        </Card>
      ) : (
        <>
          {dashTab === "overview" ? (
            <>
              <div className="vd-kpi-grid">
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Technicians on your jobs</div>
                  <div className="vd-kpi-value">{crewVisitStats.length}</div>
                  <div className="vd-kpi-hint">Distinct vendor technicians ever assigned to your visits</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Needs response</div>
                  <div className="vd-kpi-value">{incoming.length}</div>
                  <div className="vd-kpi-hint">Paid - awaiting accept or reject</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Missed 1h response SLA</div>
                  <div className="vd-kpi-value">{missedResponseWindow.length}</div>
                  <div className="vd-kpi-hint">Confirmed requests where window ended</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Active visits</div>
                  <div className="vd-kpi-value">{active.length}</div>
                  <div className="vd-kpi-hint">Accepted or in progress</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Completed visits</div>
                  <div className="vd-kpi-value">{overviewMetrics.completedCount}</div>
                  <div className="vd-kpi-hint">Of {overviewMetrics.totalBookings} bookings loaded</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Completed visit value</div>
                  <div className="vd-kpi-value">{formatInr(overviewMetrics.completedValueCents)}</div>
                  <div className="vd-kpi-hint">Final price, or estimate if final not set</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Cancelled</div>
                  <div className="vd-kpi-value">{overviewMetrics.cancelledCount}</div>
                  <div className="vd-kpi-hint">Includes vendor declines</div>
                </div>
                <div className="vd-kpi-card">
                  <div className="vd-kpi-label">Late-cancel penalties</div>
                  <div className="vd-kpi-value">{formatInr(overviewMetrics.penaltyPaise)}</div>
                  <div className="vd-kpi-hint">{overviewMetrics.penalizedCancels} penalized cancellations</div>
                </div>
              </div>
              <Card padded style={{ marginTop: "1rem" }}>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>
                  Finance
                </h3>
                <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.45 }}>
                  See OorjaMan payouts, penalties, and settlement status in the <strong>Finance</strong> tab.
                </p>
              </Card>
              <Card padded style={{ marginTop: "1rem" }}>
                <h3 style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.md, fontWeight: webTypography.weight.bold }}>
                  Response SLA trend
                </h3>
                <div className="vd-table-wrap">
                  <table className="vd-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>SLA band</th>
                        <th>Missed</th>
                        <th>Requests</th>
                        <th>Miss rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Last 7 days</td>
                        <td>
                          <Badge tone={responseSlaTone(responseSlaTrend.rate7)}>{responseSlaLabel(responseSlaTrend.rate7)}</Badge>
                        </td>
                        <td>{responseSlaTrend.missed7}</td>
                        <td>{responseSlaTrend.confirmed7}</td>
                        <td>{responseSlaTrend.rate7.toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td>Last 30 days</td>
                        <td>
                          <Badge tone={responseSlaTone(responseSlaTrend.rate30)}>{responseSlaLabel(responseSlaTrend.rate30)}</Badge>
                        </td>
                        <td>{responseSlaTrend.missed30}</td>
                        <td>{responseSlaTrend.confirmed30}</td>
                        <td>{responseSlaTrend.rate30.toFixed(1)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}

          {dashTab === "operations" ? (
            <>
              <Card padded={false} style={{ marginBottom: "1.25rem" }}>
                <div style={{ padding: "1rem 1rem 0" }}>
                  <h2 className="vd-section-title">Slot availability</h2>
                  <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Configure which slots your team can claim in the default vendor marketplace.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    {availabilityDays.map((d: string) => (
                      <Button key={d} size="sm" type="button" variant={availabilityDayKey === d ? "primary" : "outline"} onClick={() => setAvailabilityDayKey(d)}>
                        {formatDayChip(d)}
                      </Button>
                    ))}
                  </div>
                </div>
                {!availabilityDayKey ? (
                  <p className="vd-empty">Pick a day.</p>
                ) : (
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <div className="vd-table-wrap">
                      <table className="vd-table">
                        <thead>
                          <tr>
                            <th>Slot</th>
                            <th>Availability</th>
                            <th>Capacity</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slotRows.map((s: BookingSlotOption) => {
                            const key = `${availabilityDayKey}__${s.id}`;
                            const rowAvail = slotAvailabilityMap.get(key);
                            const isAvailable = rowAvail?.is_available ?? true;
                            const capacity = rowAvail?.capacity ?? 1;
                            return (
                              <tr key={s.id}>
                                <td>{s.label}</td>
                                <td>{isAvailable ? "Open" : "Blocked"}</td>
                                <td>{capacity}</td>
                                <td>
                                  <Button size="sm" type="button" variant="outline" onClick={() => setVendorRowAction({ kind: "slot", slot: s })}>
                                    Action
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>

              <Card padded={false} style={{ marginBottom: "1.25rem" }}>
                <div style={{ padding: "1rem 1rem 0" }}>
                  <h2 className="vd-section-title">Default vendor marketplace</h2>
                  <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Open visits floated to the network ({marketplaceBookingsQuery.data?.length ?? 0}). You typically only see
                    jobs whose service PIN matches your configured coverage; ops can widen delivery in exceptional cases.
                  </p>
                </div>
                {marketplaceBookingsQuery.isLoading ? (
                  <p className="vd-empty">Loading marketplace bookings…</p>
                ) : (marketplaceBookingsQuery.data?.length ?? 0) === 0 ? (
                  <p className="vd-empty">No open marketplace bookings.</p>
                ) : (
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <div className="vd-table-wrap">
                      <table className="vd-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Schedule</th>
                            <th>Site</th>
                            <th>Service for</th>
                            <th>Value</th>
                            <th>Notes</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(marketplaceBookingsQuery.data ?? []).map((b) => (
                            <tr key={b.id}>
                              <td className="vd-mono">{b.reference_code}</td>
                              <td>{formatScheduleRange(b)}</td>
                              <td>{vdEllipsis(formatSiteAddress(b.service_site_address), 44)}</td>
                              <td>{serviceForLabel(b)}</td>
                              <td>{formatInr(b.estimated_price_cents)}</td>
                              <td>{opsWatchLabel(b) ?? "-"}</td>
                              <td>
                                <Button size="sm" type="button" variant="outline" onClick={() => setVendorRowAction({ kind: "marketplace", booking: b })}>
                                  Action
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>

              <Card padded={false} style={{ marginBottom: "1.25rem" }}>
                <div style={{ padding: "1rem 1rem 0" }}>
                  <h2 className="vd-section-title">Needs response</h2>
                  <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Paid bookings awaiting accept or reject ({incoming.length})
                  </p>
                </div>
                {incoming.length === 0 ? (
                  <p className="vd-empty">No incoming requests right now.</p>
                ) : (
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <div className="vd-table-wrap">
                      <table className="vd-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Schedule</th>
                            <th>Site</th>
                            <th>Service for</th>
                            <th>Respond by</th>
                            <th>Value</th>
                            <th>Notes</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incoming.map((b) => {
                            const deadline = vendorResponseDeadline(b);
                            const df = new Intl.DateTimeFormat(undefined, { timeStyle: "short", dateStyle: "short" });
                            return (
                              <tr key={b.id}>
                                <td className="vd-mono">{b.reference_code}</td>
                                <td>{formatScheduleRange(b)}</td>
                                <td>{vdEllipsis(formatSiteAddress(b.service_site_address), 44)}</td>
                                <td>{serviceForLabel(b)}</td>
                                <td>{df.format(deadline)}</td>
                                <td>{formatInr(b.estimated_price_cents)}</td>
                                <td>{opsWatchLabel(b) ?? "-"}</td>
                                <td>
                                  <Button size="sm" type="button" variant="outline" onClick={() => setVendorRowAction({ kind: "incoming", booking: b })}>
                                    Action
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>

              <Card padded={false} style={{ marginTop: "1.25rem" }}>
                <div style={{ padding: "1rem 1rem 0" }}>
                  <h2 className="vd-section-title">Active visits</h2>
                  <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Assigned or on-site ({active.length})
                  </p>
                </div>
                {active.length === 0 ? (
                  <p className="vd-empty">No active visits.</p>
                ) : (
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <div className="vd-table-wrap">
                      <table className="vd-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Status</th>
                            <th>Schedule</th>
                            <th>Site</th>
                            <th>Service for</th>
                            <th>Technician</th>
                            <th>Notes</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {active.map((b) => (
                            <tr key={b.id}>
                              <td className="vd-mono">{b.booking_code ?? b.reference_code}</td>
                              <td>
                                <Badge tone={statusTone(b.status)}>{vendorBookingStatusLabel(b.status)}</Badge>
                              </td>
                              <td>{formatScheduleRange(b)}</td>
                              <td>{vdEllipsis(formatSiteAddress(b.service_site_address), 44)}</td>
                              <td>{serviceForLabel(b)}</td>
                              <td>{techDisplayLabel(techById, b.technician_id)}</td>
                              <td>{opsWatchLabel(b) ?? "-"}</td>
                              <td>
                                <Button size="sm" type="button" variant="outline" onClick={() => setVendorRowAction({ kind: "active", booking: b })}>
                                  Action
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </>
          ) : null}

          {dashTab === "insights" ? (
            <VendorInsightsTab
              bookings={allBookingsQuery.data ?? []}
              jobReports={vendorJobReportsQuery.data}
              technicianLabel={(id) => techDisplayLabel(techById, id)}
              jobReportsLoading={vendorJobReportsQuery.isLoading}
              jobReportsError={vendorJobReportsQuery.isError ? (vendorJobReportsQuery.error as Error) : null}
            />
          ) : null}

          {dashTab === "finance" ? (
            <VendorFinanceTab bookings={allBookingsQuery.data ?? []} />
          ) : null}

          {dashTab === "team" ? (
            <Card padded={false}>
              <div
                style={{
                  padding: "1rem 1rem 0",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ flex: "1 1 240px" }}>
                  <h2 className="vd-section-title">Your technicians</h2>
                  <p style={{ margin: "0.5rem 0 0", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                    Invite technicians, track onboarding, and approve or reject submitted profiles.
                  </p>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="primary"
                  onClick={() => {
                    inviteMut.reset();
                    setInviteModalOpen(true);
                  }}
                >
                  Invite technician
                </Button>
              </div>
              {teamInvitesTotal > 0 ? (
                <>
                  <div style={{ padding: "0 1rem", marginTop: "0.75rem" }}>
                    <h3 className="vd-section-title" style={{ fontSize: webTypography.size.md, margin: "0 0 0.5rem" }}>
                      Pending invites
                    </h3>
                  </div>
                  <div className="bm-table-wrap" style={{ padding: "0 1rem", marginBottom: "1rem" }}>
                    <table className="bm-table">
                      <thead>
                        <tr>
                          <th>Name / phone</th>
                          <th>Phone</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamInvitesWindow.map((inv) => (
                          <tr key={inv.id}>
                            <td>{inv.full_name || "-"}</td>
                            <td className="vd-mono">{inv.invite_phone_e164}</td>
                            <td>
                              <Badge tone={inv.status === "completed" ? "success" : inv.status === "opened" ? "warning" : "neutral"}>
                                {inv.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <TablePaginationBar page={teamInvitesPage} total={teamInvitesTotal} onPageChange={setTeamInvitesPage} />
                  </div>
                </>
              ) : null}
              {vendorTechRosterQuery.isLoading ? (
                <p className="vd-empty">Loading technicians…</p>
              ) : teamRosterTotal === 0 ? (
                <p className="vd-empty">No technicians added yet.</p>
              ) : (
                <>
                  <div style={{ padding: "0 1rem", marginBottom: "0.5rem" }}>
                    <h3 className="vd-section-title" style={{ fontSize: webTypography.size.md, margin: 0 }}>
                      Roster
                    </h3>
                  </div>
                  {reviewMut.isError ? (
                    <p className="vd-error" style={{ margin: "0 1rem 0.75rem" }}>
                      {(reviewMut.error as Error).message}
                    </p>
                  ) : null}
                  <div className="bm-table-wrap" style={{ padding: "0 1rem" }}>
                    <table className="bm-table">
                      <thead>
                        <tr>
                          <th>Technician</th>
                          <th>Available</th>
                          <th>Vendor review</th>
                          <th>Verification</th>
                          <th>Skills</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamRosterWindow.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <div style={{ fontWeight: webTypography.weight.semibold }}>{technicianDisplayName(t)}</div>
                              <div className="vd-caption" style={{ color: "var(--wb-muted-fg)" }}>
                                {[t.personal_phone?.trim(), t.employee_code?.trim()].filter(Boolean).join(" · ") ||
                                  `ID ${t.id.slice(0, 8)}…`}
                              </div>
                            </td>
                            <td>
                              <Badge tone={t.is_available ? "success" : "neutral"}>
                                {t.is_available ? "Available" : "Unavailable"}
                              </Badge>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  t.vendor_review_status === "approved"
                                    ? "success"
                                    : t.vendor_review_status === "rejected"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {t.vendor_review_status}
                              </Badge>
                            </td>
                            <td>{t.verification_status}</td>
                            <td>{t.skills?.length ? t.skills.slice(0, 8).join(", ") : "-"}</td>
                            <td>
                              <button
                                type="button"
                                className="vd-icon-btn"
                                title="View profile & approve or reject"
                                aria-label={`View ${technicianDisplayName(t)}`}
                                onClick={() => {
                                  setTeamTechnicianDetailId(t.id);
                                  setVendorTeamRejectReason("");
                                }}
                              >
                                <EyeIcon />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "0 1rem 1rem" }}>
                    <TablePaginationBar page={teamRosterPage} total={teamRosterTotal} onPageChange={setTeamRosterPage} />
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {dashTab === "history" ? (
            <Card padded={false}>
              <div style={{ padding: "1rem 1rem 0", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
                <h2 className="vd-section-title" style={{ flex: "1 1 auto", marginBottom: 0 }}>
                  Booking history
                </h2>
                <label style={{ fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  Filter
                  <select
                    className="vd-select"
                    style={{ maxWidth: 200 }}
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value as typeof historyFilter)}
                  >
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="other">Other statuses</option>
                  </select>
                </label>
              </div>
              <p style={{ margin: "0 1rem 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                {historyTotal === 0
                  ? ""
                  : `Showing ${historyTotal.toLocaleString()} booking(s), newest schedule first (${DEFAULT_TABLE_PAGE_SIZE} per page).`}
              </p>
              {historyTotal === 0 ? (
                <p className="vd-empty">No bookings match this filter.</p>
              ) : (
                <div style={{ padding: "0 1rem 1rem" }}>
                  <div className="vd-table-wrap">
                    <table className="vd-table">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Status</th>
                          <th>Schedule</th>
                          <th>Site</th>
                          <th>Service for</th>
                          <th>Value</th>
                          <th>Technician</th>
                          <th>Notes</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyWindow.map((b) => {
                          const cc = readBookingCustomerCancellationMeta(b.metadata);
                          const cancelNote =
                            b.status === "cancelled"
                              ? [b.cancellation_reason, cc && !cc.withinGraceWindow && cc.lateFeePaise > 0 ? "Late-cancel fee" : null]
                                .filter(Boolean)
                                .join(" · ") || "-"
                              : "-";
                          return (
                            <tr key={b.id}>
                              <td className="vd-mono">{b.booking_code ?? b.reference_code}</td>
                              <td>
                                <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                              </td>
                              <td>{formatScheduleRange(b)}</td>
                              <td>{vdEllipsis(formatSiteAddress(b.service_site_address), 40)}</td>
                              <td>{serviceForLabel(b)}</td>
                              <td>{formatInr(bookingValueCents(b))}</td>
                              <td>{techDisplayLabel(techById, b.technician_id)}</td>
                              <td>{vdEllipsis(cancelNote === "-" ? (opsWatchLabel(b) ?? "-") : cancelNote, 36)}</td>
                              <td>
                                <Button size="sm" type="button" variant="outline" onClick={() => setVendorRowAction({ kind: "history", booking: b })}>
                                  Action
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePaginationBar page={historyPage} total={historyTotal} onPageChange={setHistoryPage} />
                </div>
              )}
            </Card>
          ) : null}

          {dashTab === "coverage" && supabase ? (
            <VendorCoverageTab
              supabase={supabase}
              vendor={vendorMineQuery.data}
              onSaved={onVendorSettingsSaved}
            />
          ) : null}
        </>
      )}

      <Modal
        open={vendorRowAction !== null}
        onClose={() => {
          if (availabilityMut.isPending || claimMarketplaceMut.isPending) return;
          closeVendorRowAction();
        }}
        title={
          vendorRowAction
            ? vendorRowAction.kind === "slot"
              ? `Slot · ${vendorRowAction.slot.label}`
              : vendorRowAction.kind === "marketplace"
                ? `Marketplace · ${vendorRowAction.booking.reference_code}`
                : vendorRowAction.kind === "incoming"
                  ? `Needs response · ${vendorRowAction.booking.reference_code}`
                  : vendorRowAction.kind === "active"
                    ? `Active visit · ${vendorRowAction.booking.booking_code ?? vendorRowAction.booking.reference_code}`
                    : `Booking · ${vendorRowAction.booking.booking_code ?? vendorRowAction.booking.reference_code}`
            : ""
        }
        description={
          vendorRowAction && vendorRowAction.kind !== "slot"
            ? formatScheduleRange(vendorRowAction.booking)
            : availabilityDayKey
              ? formatDayChip(availabilityDayKey)
              : undefined
        }
      >
        {!vendorRowAction ? null : vendorRowAction.kind === "slot" ? (
          !availabilityDayKey ? (
            <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>Select a day first.</p>
          ) : (
            (() => {
              const s = vendorRowAction.slot;
              const key = `${availabilityDayKey}__${s.id}`;
              const rowAvail = slotAvailabilityMap.get(key);
              const isAvailable = rowAvail?.is_available ?? true;
              const capacity = rowAvail?.capacity ?? 1;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <dl
                    style={{
                      margin: 0,
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "0.35rem 1rem",
                      fontSize: webTypography.size.sm,
                    }}
                  >
                    <dt style={{ color: "var(--wb-muted-fg)" }}>Availability</dt>
                    <dd style={{ margin: 0 }}>{isAvailable ? "Open for marketplace claims" : "Blocked"}</dd>
                    <dt style={{ color: "var(--wb-muted-fg)" }}>Capacity</dt>
                    <dd style={{ margin: 0 }}>{capacity}</dd>
                  </dl>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <Button
                      size="sm"
                      type="button"
                      variant={isAvailable ? "outline" : "primary"}
                      loading={availabilityMut.isPending && availabilityMut.variables?.slotId === s.id}
                      onClick={() =>
                        availabilityMut.mutate({
                          dayKey: availabilityDayKey,
                          slotId: s.id,
                          isAvailable: !isAvailable,
                          capacity,
                        })
                      }
                    >
                      {isAvailable ? "Block slot" : "Open slot"}
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      disabled={!isAvailable}
                      loading={availabilityMut.isPending && availabilityMut.variables?.slotId === s.id}
                      onClick={() =>
                        availabilityMut.mutate({
                          dayKey: availabilityDayKey,
                          slotId: s.id,
                          isAvailable: true,
                          capacity: Math.min(20, capacity + 1),
                        })
                      }
                    >
                      Increase capacity
                    </Button>
                  </div>
                  <div className="web-modal-actions">
                    <Button variant="outline" type="button" disabled={availabilityMut.isPending} onClick={closeVendorRowAction}>
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()
          )
        ) : vendorRowAction.kind === "marketplace" ? (
          (() => {
            const b = vendorRowAction.booking;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, fontSize: webTypography.size.sm, lineHeight: 1.5 }}>
                  <strong>Site:</strong> {formatSiteAddress(b.service_site_address)}
                </p>
                <p style={{ margin: 0, fontSize: webTypography.size.sm, lineHeight: 1.5 }}>
                  <strong>Service for:</strong> {serviceForLabel(b)} · <strong>Estimate:</strong> {formatInr(b.estimated_price_cents)}
                </p>
                {opsWatchLabel(b) ? (
                  <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>{opsWatchLabel(b)}</p>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <Button
                    size="sm"
                    type="button"
                    loading={claimMarketplaceMut.isPending && claimMarketplaceMut.variables === b.id}
                    disabled={claimMarketplaceMut.isPending}
                    onClick={() => void claimMarketplaceMut.mutateAsync(b.id)}
                  >
                    Claim request
                  </Button>
                  {b.status === "accepted" ? (
                    <Button
                      variant="danger"
                      size="sm"
                      type="button"
                      onClick={() => {
                        closeVendorRowAction();
                        setCancelAcceptedForId(b.id);
                        setCancelAcceptedReason("");
                      }}
                    >
                      Cancel & reassign to Oorjaman
                    </Button>
                  ) : null}
                </div>
                <div className="web-modal-actions">
                  <Button variant="outline" type="button" disabled={claimMarketplaceMut.isPending} onClick={closeVendorRowAction}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()
        ) : vendorRowAction.kind === "incoming" ? (
          (() => {
            const b = vendorRowAction.booking;
            const deadline = vendorResponseDeadline(b);
            const df = new Intl.DateTimeFormat(undefined, { timeStyle: "short", dateStyle: "short" });
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, fontSize: webTypography.size.sm, lineHeight: 1.5 }}>
                  <strong>Site:</strong> {formatSiteAddress(b.service_site_address)}
                </p>
                <p style={{ margin: 0, fontSize: webTypography.size.sm }}>
                  <strong>Respond by:</strong> {df.format(deadline)}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      closeVendorRowAction();
                      openAccept(b);
                    }}
                  >
                    Accept…
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    type="button"
                    onClick={() => {
                      closeVendorRowAction();
                      setRejectForId(b.id);
                      setRejectReason("");
                    }}
                  >
                    Reject…
                  </Button>
                </div>
                <div className="web-modal-actions">
                  <Button variant="outline" type="button" onClick={closeVendorRowAction}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()
        ) : vendorRowAction.kind === "active" ? (
          (() => {
            const b = vendorRowAction.booking;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <dl
                  style={{
                    margin: 0,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.35rem 1rem",
                    fontSize: webTypography.size.sm,
                  }}
                >
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Status</dt>
                  <dd style={{ margin: 0 }}>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </dd>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Site</dt>
                  <dd style={{ margin: 0, lineHeight: 1.45 }}>{formatSiteAddress(b.service_site_address)}</dd>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Technician</dt>
                  <dd style={{ margin: 0 }}>{techDisplayLabel(techById, b.technician_id)}</dd>
                </dl>
                <BookingSitePhotos booking={b} />
                <div className="web-modal-actions">
                  <Button variant="outline" type="button" onClick={closeVendorRowAction}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()
        ) : (
          (() => {
            const b = vendorRowAction.booking;
            const cc = readBookingCustomerCancellationMeta(b.metadata);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <dl
                  style={{
                    margin: 0,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.35rem 1rem",
                    fontSize: webTypography.size.sm,
                  }}
                >
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Status</dt>
                  <dd style={{ margin: 0 }}>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </dd>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Site</dt>
                  <dd style={{ margin: 0, lineHeight: 1.45 }}>{formatSiteAddress(b.service_site_address)}</dd>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Value</dt>
                  <dd style={{ margin: 0 }}>{formatInr(bookingValueCents(b))}</dd>
                  <dt style={{ color: "var(--wb-muted-fg)" }}>Technician</dt>
                  <dd style={{ margin: 0 }}>{techDisplayLabel(techById, b.technician_id)}</dd>
                </dl>
                {b.status === "cancelled" && (b.cancellation_reason || cc) ? (
                  <div
                    style={{
                      paddingTop: "0.75rem",
                      borderTop: "1px solid var(--wb-border)",
                      fontSize: webTypography.size.sm,
                    }}
                  >
                    <p style={{ margin: "0 0 0.35rem", fontWeight: webTypography.weight.semibold }}>Cancellation</p>
                    {b.cancellation_reason ? <p style={{ margin: "0 0 0.5rem", lineHeight: 1.45 }}>{b.cancellation_reason}</p> : null}
                    {cc && !cc.withinGraceWindow && cc.lateFeePaise > 0 ? (
                      <p style={{ margin: 0, color: "var(--wb-muted-fg)" }}>
                        Late customer cancel (reference): {formatInrFromCents(cc.lateFeePaise)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="web-modal-actions">
                  <Button variant="outline" type="button" onClick={closeVendorRowAction}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>

      <Modal
        open={inviteModalOpen}
        onClose={() => {
          if (inviteMut.isPending) return;
          inviteMut.reset();
          setInviteModalOpen(false);
        }}
        title="Invite technician"
        description="Phone must include at least 10 digits (country code optional). The technician opens the link and completes the usual onboarding."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label className="bm-label" htmlFor="vendor-invite-name">
            Name (optional)
            <input
              id="vendor-invite-name"
              className="vd-input"
              style={{ marginTop: 6 }}
              placeholder="As it should appear on the invite"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </label>
          <label className="bm-label" htmlFor="vendor-invite-phone">
            Mobile (required)
            <input
              id="vendor-invite-phone"
              className="vd-input"
              style={{ marginTop: 6 }}
              placeholder="+919876543210 or 9876543210"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="bm-label" htmlFor="vendor-invite-email">
            Email (optional)
            <input
              id="vendor-invite-email"
              className="vd-input"
              style={{ marginTop: 6 }}
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          {inviteMut.isError ? (
            <p className="vd-error" style={{ margin: 0, fontSize: webTypography.size.sm }}>
              {(inviteMut.error as Error).message}
            </p>
          ) : null}
        </div>
        <div className="web-modal-actions" style={{ marginTop: "1.25rem" }}>
          <Button
            variant="outline"
            type="button"
            disabled={inviteMut.isPending}
            onClick={() => {
              inviteMut.reset();
              setInviteModalOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={inviteMut.isPending}
            disabled={!invitePhoneMeetsMinimum(invitePhone)}
            onClick={() => void inviteMut.mutateAsync()}
          >
            Send invite
          </Button>
        </div>
      </Modal>

      <Modal
        open={teamTechnicianDetailId !== null}
        onClose={() => {
          if (reviewMut.isPending) return;
          setTeamTechnicianDetailId(null);
          setVendorTeamRejectReason("");
          reviewMut.reset();
        }}
        title={teamTechnicianModal ? technicianDisplayName(teamTechnicianModal) : "Technician"}
        description={
          teamTechnicianModal
            ? [
              teamTechnicianModal.employee_code?.trim()
                ? `OorjaMan ID: ${teamTechnicianModal.employee_code.trim()}`
                : null,
              `Status: ${teamTechnicianModal.verification_status}`,
              `Employer review: ${teamTechnicianModal.vendor_review_status}`,
            ]
              .filter(Boolean)
              .join(" · ")
            : undefined
        }
      >
        {!teamTechnicianModal ? (
          <p style={{ margin: 0, fontSize: webTypography.size.sm }}>Row is no longer available. Close and refresh.</p>
        ) : (
          (() => {
            const tm = teamTechnicianModal;
            const rejectDraft = vendorTeamRejectReason.trim();
            const rejectReasonInvalid = rejectDraft.length > 0 && rejectDraft.length < 4;
            const busyThis = Boolean(reviewMut.isPending && reviewMut.variables?.technicianId === tm.id);
            const canAct = vendorCanActOnTechnicianReview(tm);
            const approveDisabled = !canAct || tm.vendor_review_status === "approved" || busyThis;
            const rejectDisabled = !canAct || rejectReasonInvalid || busyThis;
            const defaultRejectMessage = "Profile rejected by vendor.";
            return (
              <>
                {!canAct ? (
                  <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
                    This profile is still a draft. Ask the technician to submit it for review before you approve or reject.
                  </p>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                    maxHeight: "min(65vh, 600px)",
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.sm, fontWeight: webTypography.weight.semibold }}>
                      Identity & contact
                    </h4>
                    <dl className="dash-dl" style={{ fontSize: webTypography.size.sm, margin: 0 }}>
                      <dt>OorjaMan technician ID</dt>
                      <dd>{tm.employee_code?.trim() ?? (tm.vendor_review_status === "approved" ? "Issuing…" : "-")}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Available for assignments</dt>
                      <dd>{tm.is_available ? "Yes" : "No (on leave / unavailable)"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Name as per Aadhaar</dt>
                      <dd>{tm.name_as_per_aadhaar ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Date of birth</dt>
                      <dd>{tm.date_of_birth ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Home base</dt>
                      <dd>{formatSiteAddress(tm.home_base_address)}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Personal phone</dt>
                      <dd>{tm.personal_phone ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Contact email</dt>
                      <dd>{tm.contact_email ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Father / guardian</dt>
                      <dd>{tm.father_guardian_name ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Gender</dt>
                      <dd>{tm.gender ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>PAN</dt>
                      <dd>{tm.pan_number ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Aadhaar (last 4)</dt>
                      <dd>{tm.aadhaar_last4 ?? "-"}</dd>
                    </dl>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.sm, fontWeight: webTypography.weight.semibold }}>
                      Experience
                    </h4>
                    <dl className="dash-dl" style={{ fontSize: webTypography.size.sm, margin: 0 }}>
                      <dt>Skills</dt>
                      <dd>{tm.skills?.length ? tm.skills.join(", ") : "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Years</dt>
                      <dd>{tm.years_experience != null ? String(tm.years_experience) : "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Solar cleaning</dt>
                      <dd>{tm.flag_solar_cleaning_experience ? "Yes" : "No"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Other skills</dt>
                      <dd>{tm.other_skills ?? "-"}</dd>
                    </dl>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.sm, fontWeight: webTypography.weight.semibold }}>Safety</h4>
                    <dl className="dash-dl" style={{ fontSize: webTypography.size.sm, margin: 0 }}>
                      <dt>Safety training</dt>
                      <dd>{tm.flag_safety_training ? "Yes" : "No"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Training organisation</dt>
                      <dd>{tm.safety_training_org ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Height / rope cert</dt>
                      <dd>{tm.flag_height_work_cert ? "Yes" : "No"}</dd>
                    </dl>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.sm, fontWeight: webTypography.weight.semibold }}>Bank</h4>
                    <dl className="dash-dl" style={{ fontSize: webTypography.size.sm, margin: 0 }}>
                      <dt>Account holder</dt>
                      <dd>{tm.bank_account_holder_name ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>Account (last 4)</dt>
                      <dd>{tm.bank_account_last4 ?? "-"}</dd>
                      <dt style={{ marginTop: "0.5rem" }}>IFSC</dt>
                      <dd>{tm.bank_ifsc ?? "-"}</dd>
                    </dl>
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.sm, fontWeight: webTypography.weight.semibold }}>
                      Documents
                    </h4>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <DocumentViewButton label="Aadhaar" storagePath={tm.doc_aadhaar_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                      <DocumentViewButton label="PAN" storagePath={tm.doc_pan_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                      <DocumentViewButton label="Passport photo" storagePath={tm.doc_passport_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                      <DocumentViewButton label="Safety certificate" storagePath={tm.doc_safety_certificate_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                      <DocumentViewButton label="Bank proof" storagePath={tm.doc_bank_proof_url} resolveSignedUrl={resolveTechnicianDocUrl} />
                    </div>
                  </div>
                  {tm.verification_rejection_reason ? (
                    <p style={{ margin: 0, fontSize: webTypography.size.sm }}>
                      <strong>Platform note:</strong> {tm.verification_rejection_reason}
                    </p>
                  ) : null}
                  {tm.vendor_rejection_reason ? (
                    <p style={{ margin: 0, fontSize: webTypography.size.sm }}>
                      <strong>Previous employer review:</strong> {tm.vendor_rejection_reason}
                    </p>
                  ) : null}
                </div>

                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--wb-border)", paddingTop: "1rem" }}>
                  <TextArea
                    label="Reject reason (optional)"
                    id="vendor-team-reject"
                    value={vendorTeamRejectReason}
                    onChange={(e) => setVendorTeamRejectReason(e.target.value)}
                    rows={3}
                    placeholder={`Leave empty to use: "${defaultRejectMessage}"`}
                  />
                  {rejectReasonInvalid ? (
                    <p className="vd-error" style={{ margin: "0.35rem 0 0", fontSize: webTypography.size.sm }}>
                      If you enter a custom reason, use at least 4 characters - or leave empty for the default.
                    </p>
                  ) : null}
                  {reviewMut.isError ? (
                    <p className="vd-error" style={{ margin: "0.75rem 0 0" }}>
                      {(reviewMut.error as Error).message}
                    </p>
                  ) : null}
                  <div className="web-modal-actions" style={{ marginTop: "0.75rem" }}>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={busyThis}
                      onClick={() => {
                        setTeamTechnicianDetailId(null);
                        setVendorTeamRejectReason("");
                        reviewMut.reset();
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      variant="danger"
                      type="button"
                      disabled={rejectDisabled}
                      loading={busyThis && reviewMut.variables?.decision === "rejected"}
                      onClick={() => {
                        const r = rejectDraft || defaultRejectMessage;
                        void reviewMut.mutateAsync({ technicianId: tm.id, decision: "rejected", reason: r });
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      disabled={approveDisabled}
                      loading={busyThis && reviewMut.variables?.decision === "approved"}
                      onClick={() => void reviewMut.mutateAsync({ technicianId: tm.id, decision: "approved" })}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </>
            );
          })()
        )}
      </Modal>

      <Modal
        open={Boolean(acceptForId)}
        onClose={() => {
          setAcceptForId(null);
          setAckTechnicianReady(false);
          setAckSafetyCompliance(false);
          setAckUniformSafetyKit(false);
          setAckProceduresBriefed(false);
          setAcceptTechnicianId("");
        }}
        title="Accept booking"
        description={
          acceptBooking
            ? `${acceptBooking.reference_code} · ${formatScheduleRange(acceptBooking)}`
            : undefined
        }
      >
        <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
          Accepting this booking requires assigning one of your verified technicians now.
        </p>
        <label className="bm-label" htmlFor="vendor-accept-tech">
          Assigned technician
          <select
            id="vendor-accept-tech"
            className="vd-select bm-select"
            value={acceptTechnicianId}
            onChange={(e) => setAcceptTechnicianId(e.target.value)}
          >
            {verifiedVendorTechnicians.map((t) => (
              <option key={t.id} value={t.id}>
                {technicianOptionLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, fontWeight: webTypography.weight.semibold }}>Pre-confirmation (required)</p>
        <label className="vd-check">
          <input
            type="checkbox"
            checked={ackTechnicianReady}
            onChange={(e) => setAckTechnicianReady(e.target.checked)}
          />
          <span>
            Our organisation can fulfil this slot and this technician is ready with required equipment.
          </span>
        </label>
        <label className="vd-check">
          <input
            type="checkbox"
            checked={ackSafetyCompliance}
            onChange={(e) => setAckSafetyCompliance(e.target.checked)}
          />
          <span>We understand site safety requirements for this job and will support the assigned technician on site.</span>
        </label>
        <label className="vd-check">
          <input
            type="checkbox"
            checked={ackUniformSafetyKit}
            onChange={(e) => setAckUniformSafetyKit(e.target.checked)}
          />
          <span>
            Uniform and safety kit (PPE, harness where applicable) will be available for this visit.
          </span>
        </label>
        <label className="vd-check">
          <input
            type="checkbox"
            checked={ackProceduresBriefed}
            onChange={(e) => setAckProceduresBriefed(e.target.checked)}
          />
          <span>
            Site procedures and safety expectations will be communicated to the assigned technician before arrival.
          </span>
        </label>
        {acceptMut.isError ? (
          <p style={{ margin: "0.75rem 0 0", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
            {(acceptMut.error as Error).message}
          </p>
        ) : null}
        <div className="web-modal-actions">
          <Button variant="outline" type="button" onClick={() => setAcceptForId(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={acceptMut.isPending}
            disabled={
              !acceptForId ||
              !acceptTechnicianId ||
              !ackTechnicianReady ||
              !ackSafetyCompliance ||
              !ackUniformSafetyKit ||
              !ackProceduresBriefed
            }
            onClick={() => {
              if (!acceptForId) return;
              void acceptMut.mutateAsync({
                bookingId: acceptForId,
                technicianReadinessConfirmed: ackTechnicianReady,
                safetyComplianceConfirmed: ackSafetyCompliance,
                uniformSafetyKitConfirmed: ackUniformSafetyKit,
                proceduresBriefedConfirmed: ackProceduresBriefed,
              });
            }}
          >
            Accept booking
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelAcceptedForId)}
        onClose={() => {
          setCancelAcceptedForId(null);
          setCancelAcceptedReason("");
        }}
        title="Cancel accepted booking"
        description={
          cancelAcceptedBooking
            ? `${cancelAcceptedBooking.reference_code} · ${formatScheduleRange(cancelAcceptedBooking)}`
            : undefined
        }
      >
        <p style={{ margin: "0 0 0.75rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
          This removes your assignment and sends the booking back to Oorjaman operations for reassignment.
        </p>
        <TextArea
          label="Reason"
          required
          value={cancelAcceptedReason}
          onChange={(e) => setCancelAcceptedReason(e.target.value)}
          placeholder="Short reason (min. 4 characters)"
        />
        {cancelAcceptedMut.isError ? (
          <p style={{ margin: "0.75rem 0 0", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
            {(cancelAcceptedMut.error as Error).message}
          </p>
        ) : null}
        <div className="web-modal-actions">
          <Button variant="outline" type="button" onClick={() => setCancelAcceptedForId(null)}>
            Back
          </Button>
          <Button
            variant="danger"
            type="button"
            loading={cancelAcceptedMut.isPending}
            disabled={cancelAcceptedReason.trim().length < 4}
            onClick={() => {
              if (!cancelAcceptedForId) return;
              void cancelAcceptedMut.mutateAsync({ bookingId: cancelAcceptedForId, reason: cancelAcceptedReason.trim() });
            }}
          >
            Confirm cancel
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejectForId)}
        onClose={() => {
          setRejectForId(null);
          setRejectReason("");
        }}
        title="Reject booking"
        description={
          rejectBooking
            ? `${rejectBooking.reference_code} · ${formatScheduleRange(rejectBooking)}`
            : undefined
        }
      >
        <TextArea
          label="Reason"
          required
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Short reason (min. 4 characters)"
        />
        {rejectMut.isError ? (
          <p style={{ margin: "0.75rem 0 0", fontSize: webTypography.size.sm, color: "var(--wb-destructive)" }}>
            {(rejectMut.error as Error).message}
          </p>
        ) : null}
        <div className="web-modal-actions">
          <Button variant="outline" type="button" onClick={() => setRejectForId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            loading={rejectMut.isPending}
            disabled={rejectReason.trim().length < 4}
            onClick={() => {
              if (!rejectForId) return;
              void rejectMut.mutateAsync({ bookingId: rejectForId, reason: rejectReason.trim() });
            }}
          >
            Reject booking
          </Button>
        </div>
      </Modal>
    </div>
  );
}
