import { CARD_FRONT_LOCKUP, CARD_FRONT_WAVE_PATHS } from "@oorjaman/utils";

const CARD_W = 90;
const CARD_H = 54;

function drawLockupMeet(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const aspect = img.naturalWidth / img.naturalHeight;
  let dw = w;
  let dh = w / aspect;
  if (dh > h) {
    dh = h;
    dw = h * aspect;
  }
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawFrontWaves(ctx: CanvasRenderingContext2D) {
  for (const wave of CARD_FRONT_WAVE_PATHS) {
    ctx.save();
    if ("opacity" in wave && wave.opacity != null) {
      ctx.globalAlpha = wave.opacity;
    }
    ctx.fillStyle = wave.fill;
    ctx.fill(new Path2D(wave.d));
    ctx.restore();
  }
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/** 300 DPI card front — canvas composite (avoids SVG/Canvg lockup blur). */
export async function renderCardFrontPng(
  lockupImg: HTMLImageElement,
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(widthPx / CARD_W, heightPx / CARD_H);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const { x, y, w, h } = CARD_FRONT_LOCKUP;
  drawLockupMeet(ctx, lockupImg, x, y, w, h);
  drawFrontWaves(ctx);

  return canvasToPngBytes(canvas);
}
