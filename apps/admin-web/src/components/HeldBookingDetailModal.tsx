import { useQuery } from "@tanstack/react-query";
import { formatInrFromPaise, getBookingById, type BookingRow, type Json } from "@oorjaman/api";
import { formatDisplayDateTime } from "@oorjaman/utils";
import { Modal, useSupabase } from "@oorjaman/web-ui";

type MetaRow = { label: string; value: string };
type MetaGroup = { title: string; rows: MetaRow[]; groups: MetaGroup[] };

const WORD_LABELS: Record<string, string> = {
  id: "ID",
  kw: "kW",
  upi: "UPI",
  otp: "OTP",
  amc: "AMC",
  gst: "GST",
  pan: "PAN",
};

function fieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const known = WORD_LABELS[word.toLowerCase()];
      if (known) return known;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLeaf(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (/(paise|cents)$/i.test(key)) return formatInrFromPaise(value);
    return String(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return formatDisplayDateTime(value);
    }
    return value;
  }
  return "—";
}

function toGroup(title: string, value: Record<string, unknown>): MetaGroup {
  const rows: MetaRow[] = [];
  const groups: MetaGroup[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (isRecord(child)) {
      groups.push(toGroup(fieldLabel(key), child));
      continue;
    }
    if (Array.isArray(child)) {
      const objects = child.filter(isRecord);
      if (objects.length === child.length && child.length > 0) {
        objects.forEach((item, index) => {
          groups.push(toGroup(`${fieldLabel(key)} ${index + 1}`, item));
        });
        continue;
      }
      rows.push({
        label: fieldLabel(key),
        value: child.length === 0 ? "—" : child.map((item) => formatLeaf(key, item)).join(", "),
      });
      continue;
    }
    rows.push({ label: fieldLabel(key), value: formatLeaf(key, child) });
  }
  return { title, rows, groups };
}

function jsonRecord(value: Json): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  return value;
}

function MetaGroupView({ group }: { group: MetaGroup }) {
  if (group.rows.length === 0 && group.groups.length === 0) return null;
  return (
    <section className="fin-meta-section">
      <h4 className="fin-meta-heading">{group.title}</h4>
      {group.rows.length > 0 ? (
        <dl className="fin-meta-list">
          {group.rows.map((row) => (
            <div key={row.label} className="fin-meta-pair">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {group.groups.length > 0 ? (
        <div className="fin-meta-nested">
          {group.groups.map((child) => (
            <MetaGroupView key={child.title} group={child} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function visitGroup(booking: BookingRow): MetaGroup {
  return {
    title: "Visit",
    rows: [
      { label: "Reference", value: booking.reference_code },
      { label: "Status", value: fieldLabel(booking.status) },
      { label: "Service", value: fieldLabel(booking.service_type) },
      { label: "Payment timing", value: fieldLabel(booking.payment_timing) },
      { label: "Visit code", value: booking.booking_code ?? "—" },
      { label: "Scheduled start", value: formatDisplayDateTime(booking.scheduled_start) },
      { label: "Scheduled end", value: formatDisplayDateTime(booking.scheduled_end) },
      { label: "Started", value: booking.actual_start ? formatDisplayDateTime(booking.actual_start) : "—" },
      { label: "Finished", value: booking.actual_end ? formatDisplayDateTime(booking.actual_end) : "—" },
      {
        label: "Price",
        value: formatInrFromPaise(booking.final_price_cents ?? booking.estimated_price_cents),
      },
      { label: "Currency", value: booking.currency },
      { label: "Customer notes", value: booking.customer_notes?.trim() || "—" },
      { label: "Internal notes", value: booking.internal_notes?.trim() || "—" },
      { label: "Cancellation reason", value: booking.cancellation_reason?.trim() || "—" },
      { label: "Cancelled", value: booking.cancelled_at ? formatDisplayDateTime(booking.cancelled_at) : "—" },
      { label: "Created", value: formatDisplayDateTime(booking.created_at) },
      { label: "Updated", value: formatDisplayDateTime(booking.updated_at) },
    ],
    groups: [],
  };
}

function recordGroup(booking: BookingRow): MetaGroup {
  return {
    title: "Record",
    rows: [
      { label: "Booking ID", value: booking.id },
      { label: "Customer ID", value: booking.customer_id },
      { label: "Vendor ID", value: booking.vendor_id ?? "—" },
      { label: "Technician ID", value: booking.technician_id ?? "—" },
      { label: "Subscription ID", value: booking.subscription_id ?? "—" },
      { label: "Created by", value: booking.created_by ?? "—" },
      { label: "Cancelled by", value: booking.cancelled_by ?? "—" },
    ],
    groups: [],
  };
}

export function HeldBookingDetailModal({
  bookingId,
  onClose,
}: {
  bookingId: string | null;
  onClose: () => void;
}) {
  const supabase = useSupabase();
  const bookingQuery = useQuery({
    queryKey: ["finance", "held-booking", bookingId],
    queryFn: () => getBookingById(supabase!, bookingId!),
    enabled: Boolean(supabase && bookingId),
  });

  const booking = bookingQuery.data;
  const address = booking ? jsonRecord(booking.service_site_address) : null;
  const metadata = booking ? jsonRecord(booking.metadata) : null;

  return (
    <Modal
      open={Boolean(bookingId)}
      size="lg"
      title={booking?.reference_code ?? "Visit"}
      description="Everything stored on this booking."
      onClose={onClose}
    >
      {bookingQuery.isPending ? <p className="fin-held-copy">Loading visit details.</p> : null}
      {bookingQuery.isError ? (
        <p className="fin-error">
          {bookingQuery.error instanceof Error ? bookingQuery.error.message : "Could not load this booking."}
        </p>
      ) : null}
      {booking ? (
        <div className="fin-meta">
          <MetaGroupView group={visitGroup(booking)} />
          {address ? <MetaGroupView group={toGroup("Site", address)} /> : null}
          {metadata ? <MetaGroupView group={toGroup("Details", metadata)} /> : null}
          {!address && typeof booking.service_site_address === "string" && booking.service_site_address.trim() ? (
            <MetaGroupView
              group={{
                title: "Site",
                rows: [{ label: "Address", value: booking.service_site_address }],
                groups: [],
              }}
            />
          ) : null}
          <MetaGroupView group={recordGroup(booking)} />
        </div>
      ) : null}
    </Modal>
  );
}
