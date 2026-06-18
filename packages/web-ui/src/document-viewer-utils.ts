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
