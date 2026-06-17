// @ts-expect-error — shared icon SVG module (no .d.ts)
import { LETTERHEAD_ICON_RASTER_PX, letterheadIconSvg } from "../../../../../packages/utils/src/brand-print/letterhead-icons.mjs";

export type LetterheadIconKind = "phone" | "email" | "globe";

async function svgToPng(svg: string, px: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Letterhead icon SVG failed to load"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(img, 0, 0, px, px);
    const out = await new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) {
          reject(new Error("Letterhead icon PNG export failed"));
          return;
        }
        b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      }, "image/png");
    });
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rasterizeLetterheadIcons(): Promise<Record<LetterheadIconKind, Uint8Array>> {
  const px = LETTERHEAD_ICON_RASTER_PX;
  const kinds: LetterheadIconKind[] = ["phone", "email", "globe"];
  const entries = await Promise.all(kinds.map(async (kind) => [kind, await svgToPng(letterheadIconSvg(kind), px)] as const));
  return Object.fromEntries(entries) as Record<LetterheadIconKind, Uint8Array>;
}
