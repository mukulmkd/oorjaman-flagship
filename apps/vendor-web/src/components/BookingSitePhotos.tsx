import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BookingRow } from "@oorjaman/api";
import { bookingShowsSitePhotos, getSitePhotosForBooking, queryKeys } from "@oorjaman/api";
import { DocumentViewerModal } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";

type Props = {
  booking: Pick<BookingRow, "id" | "customer_id" | "metadata" | "status" | "technician_id">;
};

export function BookingSitePhotos({ booking }: Props) {
  const supabase = useSupabase();
  const enabled = Boolean(supabase && bookingShowsSitePhotos(booking));
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

  const query = useQuery({
    queryKey: queryKeys.customers.sitePhotosForBooking(booking.id),
    queryFn: () => getSitePhotosForBooking(supabase!, booking),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

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

  return (
    <>
      <div style={{ marginTop: "0.75rem" }}>
        <p className="dash-card-label">Customer site photos</p>
        <p className="dash-card-body" style={{ marginTop: "0.25rem", marginBottom: "0.5rem", color: "var(--wb-muted-fg)" }}>
          Click a photo to view full size or download.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {query.data
            .filter((p) => p.signed_url)
            .map((p, index) => (
              <figure key={p.id} style={{ margin: 0, flex: "0 0 auto", width: 140 }}>
                <button
                  type="button"
                  onClick={() =>
                    setViewer({
                      url: p.signed_url!,
                      title: `Customer site photo ${index + 1}`,
                    })
                  }
                  style={{
                    padding: 0,
                    border: "1px solid var(--wb-border)",
                    borderRadius: 8,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "transparent",
                  }}
                  aria-label={`View customer site photo ${index + 1}`}
                >
                  <img
                    src={p.signed_url!}
                    alt="Customer site"
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
      <DocumentViewerModal
        open={Boolean(viewer)}
        title={viewer?.title ?? "Customer site photo"}
        url={viewer?.url ?? null}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
