import { LETTERHEAD_FOOTER, letterheadFooterBackgroundSvg } from "../../../../../packages/utils/src/brand-print/letterhead-footer-layout";

async function svgToPng(svg: string, pxW: number, pxH: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Footer background SVG failed to load"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    ctx.drawImage(img, 0, 0, pxW, pxH);
    return await new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) {
          reject(new Error("Footer background PNG export failed"));
          return;
        }
        b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rasterizeLetterheadFooterBackground(pageWidthPt: number, footerHeightPt: number): Promise<Uint8Array> {
  const pxW = Math.max(400, Math.round(pageWidthPt * 2.5));
  const pxH = Math.max(80, Math.round(footerHeightPt * 2.5));
  return svgToPng(
    letterheadFooterBackgroundSvg(LETTERHEAD_FOOTER.viewWidthMm, LETTERHEAD_FOOTER.heightMm),
    pxW,
    pxH,
  );
}
