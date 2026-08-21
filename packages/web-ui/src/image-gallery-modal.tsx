import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Button } from "./button";
import { downloadFromSignedUrl } from "./document-viewer-utils";
import { useBodyScrollLock } from "./use-body-scroll-lock";
import "./document-viewer.css";

export type ImageGalleryItem = {
  id: string;
  url: string;
  caption?: string | null;
};

export type ImageGalleryModalProps = {
  open: boolean;
  title: string;
  items: ImageGalleryItem[];
  initialIndex?: number;
  onClose: () => void;
};

export function ImageGalleryModal({
  open,
  title,
  items,
  initialIndex = 0,
  onClose,
}: ImageGalleryModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);
  useBodyScrollLock(open && items.length > 0);

  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)));
  }, [open, initialIndex, items.length]);

  const current = items[index] ?? null;
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  const onDownload = useCallback(async () => {
    if (!current?.url) return;
    setDownloading(true);
    try {
      await downloadFromSignedUrl(current.url, `site-photo-${index + 1}.jpg`);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Could not download file");
    } finally {
      setDownloading(false);
    }
  }, [current, index]);

  if (!open || !current) return null;

  return (
    <div className="doc-viewer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="doc-viewer-modal doc-viewer-modal--gallery"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-gallery-title"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="doc-viewer-gallery-header">
          <h3 id="image-gallery-title">
            {title}
            {items.length > 1 ? (
              <span className="doc-viewer-gallery-counter">
                {" "}
                · {index + 1} / {items.length}
              </span>
            ) : null}
          </h3>
        </div>

        <div className="doc-viewer-gallery-stage">
          {items.length > 1 ? (
            <button
              type="button"
              className="doc-viewer-nav doc-viewer-nav--prev"
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="Previous photo"
            >
              ‹
            </button>
          ) : null}

          <div className="doc-viewer-body doc-viewer-body--gallery">
            <img
              key={current.id}
              className="doc-viewer-img"
              src={current.url}
              alt={`${title} ${index + 1}`}
            />
          </div>

          {items.length > 1 ? (
            <button
              type="button"
              className="doc-viewer-nav doc-viewer-nav--next"
              onClick={goNext}
              disabled={!hasNext}
              aria-label="Next photo"
            >
              ›
            </button>
          ) : null}
        </div>

        {current.caption ? <p className="doc-viewer-gallery-caption">{current.caption}</p> : null}

        <div className="doc-viewer-actions">
          <Button variant="outline" size="sm" type="button" disabled={downloading} onClick={() => void onDownload()}>
            {downloading ? "Downloading…" : "Download"}
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
