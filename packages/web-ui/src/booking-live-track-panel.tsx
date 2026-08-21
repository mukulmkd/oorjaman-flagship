import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  bookingApi,
  bookingLiveTrackPhase,
  bookingLiveTrackPhaseLabel,
  bookingShowsPortalLiveStatusCard,
  bookingShowsPortalLiveTrack,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsPinUrl,
  buildOsmEmbedTrackUrl,
  portalTrackDistanceKm,
  queryKeys,
  serviceSiteCoordsFromBookingAddress,
} from "@oorjaman/api";
import type { BookingRow, Json } from "@oorjaman/api";
import { useSupabase } from "./supabase-client";

type BookingLiveTrackFields = Pick<
  BookingRow,
  | "id"
  | "technician_id"
  | "status"
  | "technician_en_route_at"
  | "service_site_address"
  | "actual_start"
>;

type Props = {
  booking: BookingLiveTrackFields;
  /** Optional override when address JSON is already parsed elsewhere. */
  serviceSiteAddress?: Json | null;
};

function formatRecordedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** OSM export embed can't disable scroll-zoom; gate pointer events until click. */
function OsmMapEmbed({ src, title }: { src: string; title: string }) {
  const [active, setActive] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--wb-border)",
        background: "var(--wb-muted, #eef3f1)",
        marginBottom: "0.65rem",
        height: 220,
      }}
      onMouseLeave={() => setActive(false)}
    >
      <iframe
        title={title}
        src={src}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          pointerEvents: active ? "auto" : "none",
        }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {!active ? (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label="Enable map interaction"
          style={{
            position: "absolute",
            inset: 0,
            margin: 0,
            padding: 0,
            border: 0,
            cursor: "pointer",
            background: "transparent",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              marginBottom: 10,
              padding: "0.35rem 0.65rem",
              borderRadius: 999,
              background: "rgb(15 41 56 / 0.72)",
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.01em",
              pointerEvents: "none",
            }}
          >
            Click map to pan or zoom
          </span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Live visit status + technician GPS for admin/vendor booking drawers.
 * Map preview uses OpenStreetMap embed (no Maps API key).
 */
export function BookingLiveTrackPanel({ booking, serviceSiteAddress }: Props) {
  const supabase = useSupabase();
  const showCard = bookingShowsPortalLiveStatusCard(booking);
  const pollLive = bookingShowsPortalLiveTrack(booking);
  const phase = bookingLiveTrackPhase(booking);

  const siteCoords = useMemo(
    () => serviceSiteCoordsFromBookingAddress(serviceSiteAddress ?? booking.service_site_address),
    [booking.service_site_address, serviceSiteAddress],
  );

  const locQ = useQuery({
    queryKey: queryKeys.bookings.technicianLastLocation(booking.id),
    queryFn: () => bookingApi.getLastTechnicianLocationForBooking(supabase!, booking.id),
    enabled: Boolean(supabase && pollLive),
    refetchInterval: pollLive ? 15_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });

  if (!showCard) return null;

  const techCoords =
    locQ.data && Number.isFinite(locQ.data.lat) && Number.isFinite(locQ.data.lng)
      ? { lat: locQ.data.lat, lng: locQ.data.lng }
      : null;

  const embedUrl = buildOsmEmbedTrackUrl(siteCoords, techCoords);
  const farApart =
    siteCoords && techCoords ? portalTrackDistanceKm(siteCoords, techCoords) > 80 : false;

  const mapsHref =
    techCoords && siteCoords
      ? buildGoogleMapsDirectionsUrl(techCoords, siteCoords)
      : techCoords
        ? buildGoogleMapsPinUrl(techCoords)
        : siteCoords
          ? buildGoogleMapsPinUrl(siteCoords)
          : null;

  const recordedLabel = formatRecordedAt(locQ.data?.recorded_at ?? null);

  return (
    <section
      style={{
        marginTop: "0.25rem",
        padding: "0.9rem 1rem",
        borderRadius: 12,
        border: "1px solid var(--wb-border)",
        background: "var(--wb-card, var(--wb-bg, #fff))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.65rem",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--wb-fg)" }}>
          {bookingLiveTrackPhaseLabel(phase)}
        </p>
        {pollLive ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--wb-primary, #1f8660)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--wb-primary, #1f8660)",
                boxShadow: "0 0 0 3px rgb(31 134 96 / 0.2)",
              }}
            />
            Live
          </span>
        ) : null}
      </div>

      {phase === "waiting_en_route" ? (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
          Technician is assigned. Live map appears when they mark themselves en route in the partner app.
        </p>
      ) : null}

      {pollLive && locQ.isPending ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--wb-muted-fg)" }}>Loading technician location…</p>
      ) : null}

      {pollLive && locQ.isError ? (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--wb-muted-fg)" }}>
          Could not load technician location. They may not have shared GPS yet.
        </p>
      ) : null}

      {pollLive && !locQ.isPending && !locQ.isError && !techCoords ? (
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
          Waiting for the first GPS update from the technician.
        </p>
      ) : null}

      {farApart ? (
        <p style={{ margin: "0 0 0.65rem", fontSize: "0.8125rem", color: "var(--wb-muted-fg)", lineHeight: 1.45 }}>
          Technician GPS and site are far apart — map is zoomed to the technician. Use Google Maps for the full route.
        </p>
      ) : null}

      {embedUrl ? <OsmMapEmbed src={embedUrl} title="Live technician map" /> : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem 1.25rem",
          fontSize: "0.8125rem",
          color: "var(--wb-muted-fg)",
        }}
      >
        {techCoords ? (
          <span>
            Tech GPS: {techCoords.lat.toFixed(5)}, {techCoords.lng.toFixed(5)}
            {recordedLabel ? ` · ${recordedLabel}` : ""}
          </span>
        ) : null}
        {siteCoords ? (
          <span>
            Site: {siteCoords.lat.toFixed(5)}, {siteCoords.lng.toFixed(5)}
          </span>
        ) : (
          <span>Site GPS not saved on this booking.</span>
        )}
      </div>

      {mapsHref ? (
        <p style={{ margin: "0.75rem 0 0" }}>
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
            Open in Google Maps
          </a>
        </p>
      ) : null}
    </section>
  );
}
