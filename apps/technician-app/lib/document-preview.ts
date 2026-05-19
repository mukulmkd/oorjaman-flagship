export type DocumentPreviewKind = "image" | "pdf" | "other";

export function basenameFromStoragePath(storagePath: string): string {
  const parts = storagePath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "document";
}

export function documentPreviewKind(storagePath: string): DocumentPreviewKind {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}
