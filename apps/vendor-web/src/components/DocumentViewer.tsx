import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@oorjaman/web-ui";
import "./document-viewer.css";

export type DocumentPreviewKind = "image" | "pdf" | "other";

export function basenameFromStoragePath(storagePath: string): string {
  const parts = storagePath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "document";
}

export function documentPreviewKind(storagePath: string): DocumentPreviewKind {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export async function downloadFromSignedUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export type DocumentViewerModalProps = {
  open: boolean;
  title: string;
  url: string | null;
  storagePath?: string | null;
  onClose: () => void;
};

export function DocumentViewerModal({ open, title, url, storagePath, onClose }: DocumentViewerModalProps) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onDownload = useCallback(async () => {
    if (!url) return;
    const filename = storagePath ? basenameFromStoragePath(storagePath) : `${title.replace(/\s+/g, "-").toLowerCase()}.file`;
    setDownloading(true);
    try {
      await downloadFromSignedUrl(url, filename);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Could not download file");
    } finally {
      setDownloading(false);
    }
  }, [url, storagePath, title]);

  if (!open || !url) return null;

  const kind = storagePath ? documentPreviewKind(storagePath) : "image";
  let preview: ReactNode;
  if (kind === "image") {
    preview = <img className="doc-viewer-img" src={url} alt={title} />;
  } else if (kind === "pdf") {
    preview = <iframe className="doc-viewer-frame" src={url} title={title} />;
  } else {
    preview = (
      <div className="doc-viewer-fallback">
        <p style={{ margin: "0 0 0.75rem" }}>Preview is not available for this file type.</p>
        <p style={{ margin: 0 }}>Use Download to save a copy.</p>
      </div>
    );
  }

  return (
    <div className="doc-viewer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="doc-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-viewer-title"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <h3 id="doc-viewer-title">{title}</h3>
        <div className="doc-viewer-body">{preview}</div>
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

export type DocumentViewButtonProps = {
  label: string;
  storagePath: string | null | undefined;
  resolveSignedUrl: (storagePath: string) => Promise<string>;
};

export function DocumentViewButton({ label, storagePath, resolveSignedUrl }: DocumentViewButtonProps) {
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ title: string; url: string; storagePath: string } | null>(null);
  const disabled = !storagePath;

  const onView = async () => {
    if (!storagePath) return;
    setBusy(true);
    try {
      const url = await resolveSignedUrl(storagePath);
      setViewer({ title: label, url, storagePath });
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Could not open document");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" type="button" disabled={disabled || busy} onClick={() => void onView()}>
        {busy ? "Loading…" : label}
      </Button>
      <DocumentViewerModal
        open={Boolean(viewer)}
        title={viewer?.title ?? label}
        url={viewer?.url ?? null}
        storagePath={viewer?.storagePath}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
