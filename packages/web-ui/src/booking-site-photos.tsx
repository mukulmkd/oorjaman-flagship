import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BookingRow } from "@oorjaman/api";
import { bookingShowsSitePhotos, getSitePhotosForBooking, queryKeys } from "@oorjaman/api";
import { ImageGalleryModal } from "./image-gallery-modal";
import { useSupabase } from "./supabase-client";

type Props = {
  booking: Pick<
    BookingRow,
    "id" | "customer_id" | "metadata" | "status" | "technician_id" | "subscription_id"
  >;
};

export function BookingSitePhotos({ booking }: Props) {
  const supabase = useSupabase();
  const enabled = Boolean(supabase && bookingShowsSitePhotos(booking));
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const query = useQuery({
    queryKey: queryKeys.customers.sitePhotosForBooking(booking.id),
    queryFn: () => getSitePhotosForBooking(supabase!, booking),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const visible = useMemo(
    () => (query.data ?? []).filter((p) => p.signed_url),
    [query.data],
  );

  const galleryItems = useMemo(
    () =>
      visible.map((p) => ({
        id: p.id,
        url: p.signed_url!,
        caption: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
      })),
    [visible],
  );

  if (!enabled) return null;

  if (query.isPending) {
    return <p className="dash-card-body" style={{ marginTop: "0.5rem" }}>Loading site photos…</p>;
  }

  if (query.isError) {
    return (
      <p className="dash-card-body" style={{ marginTop: "0.5rem", color: "var(--wb-muted-fg)" }}>
        Could not load site photos.
      </p>
    );
  }

  if (!query.data?.length) {
    return (
      <p className="dash-card-body" style={{ marginTop: "0.5rem", color: "var(--wb-muted-fg)" }}>
        No customer site photos for this address.
      </p>
    );
  }

  if (!visible.length) {
    return (
      <p className="dash-card-body" style={{ marginTop: "0.5rem", color: "var(--wb-muted-fg)" }}>
        Site photo records exist but could not be opened (storage access or missing files).
      </p>
    );
  }

  return (
    <>
      <div style={{ marginTop: "0.75rem" }}>
        <p className="dash-card-label">Customer site photos</p>
        <p className="dash-card-body" style={{ marginTop: "0.25rem", marginBottom: "0.5rem", color: "var(--wb-muted-fg)" }}>
          Click any photo to browse the full set. Use arrows or ← → keys to move between them.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {visible.map((p, index) => (
            <figure key={p.id} style={{ margin: 0, flex: "0 0 auto", width: 140 }}>
              <button
                type="button"
                onClick={() => setViewerIndex(index)}
                style={{
                  padding: 0,
                  border: "1px solid var(--wb-border)",
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "transparent",
                }}
                aria-label={`View customer site photo ${index + 1} of ${visible.length}`}
              >
                <img
                  src={p.signed_url!}
                  alt={`Customer site ${index + 1}`}
                  style={{
                    width: 140,
                    height: 100,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </button>
              <figcaption
                style={{
                  fontSize: "0.7rem",
                  color: "var(--wb-muted-fg)",
                  marginTop: 4,
                }}
              >
                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <ImageGalleryModal
        open={viewerIndex !== null}
        title="Customer site photos"
        items={galleryItems}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}
