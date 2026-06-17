import {
  CARD_BACK_CONTACT,
  CARD_BACK_CORNER,
  CARD_BACK_HEADER,
  CARD_BACK_PHONE_PATH,
  CARD_BACK_PIN_PATH,
} from "@oorjaman/utils";
import type { BrandPrintContact } from "@oorjaman/utils";

const CARD_W = 90;
const CARD_H = 54;
const GREEN = "#549048";
const NAVY = "#1C4276";
const GREY = "#666666";

function drawPathIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, pathD: string, viewSize = 20) {
  const size = CARD_BACK_CONTACT.iconDrawSize;
  const scale = size / viewSize;
  const path = new Path2D(pathD);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-viewSize / 2, -viewSize / 2);
  ctx.fillStyle = GREEN;
  ctx.fill(path);
  ctx.restore();
}

function drawGlobeIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const size = CARD_BACK_CONTACT.iconDrawSize;
  const scale = size / 20;
  const r = 7.5 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1.15 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, 3 * scale, r, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(3.5 * scale, -4.5 * scale, 3.5 * scale, 4.5 * scale, 0, r);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(-3.5 * scale, -4.5 * scale, -3.5 * scale, 4.5 * scale, 0, r);
  ctx.stroke();
  ctx.restore();
}

function drawLabelIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string, fontSize: number) {
  ctx.save();
  ctx.fillStyle = GREEN;
  ctx.font = `700 ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

function drawCornerWave(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = CARD_BACK_CORNER.fill;
  ctx.fill(new Path2D(CARD_BACK_CORNER.fillPath));
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderCardBackPng(
  contact: BrandPrintContact,
  watermarkImg: HTMLImageElement,
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

  ctx.globalAlpha = 0.11;
  ctx.drawImage(watermarkImg, 48, 0, 48, 48);
  ctx.globalAlpha = 1;

  const { nameX, nameY, nameSize, titleY, titleSize } = CARD_BACK_HEADER;
  ctx.fillStyle = NAVY;
  ctx.font = `700 ${nameSize}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(contact.cardName, nameX, nameY);

  ctx.fillStyle = GREY;
  ctx.font = `400 ${titleSize}px Helvetica, Arial, sans-serif`;
  ctx.fillText(contact.cardTitle, nameX, titleY);

  const { iconCx, textX, rowYs } = CARD_BACK_CONTACT;
  const rows: { cy: number; text: string; kind: "phone" | "at" | "globe" | "pin" }[] = [
    { cy: rowYs[0], text: contact.phone, kind: "phone" },
    { cy: rowYs[1], text: contact.email, kind: "at" },
    { cy: rowYs[2], text: contact.web, kind: "globe" },
    { cy: rowYs[3], text: contact.address, kind: "pin" },
  ];

  for (const row of rows) {
    if (row.kind === "phone") drawPathIcon(ctx, iconCx, row.cy, CARD_BACK_PHONE_PATH);
    else if (row.kind === "at") drawLabelIcon(ctx, iconCx, row.cy, "@", 3.4);
    else if (row.kind === "globe") drawGlobeIcon(ctx, iconCx, row.cy);
    else drawPathIcon(ctx, iconCx, row.cy, CARD_BACK_PIN_PATH);

    ctx.fillStyle = NAVY;
    ctx.font = `500 ${CARD_BACK_CONTACT.textSize}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(row.text, textX, row.cy);
  }

  drawCornerWave(ctx);

  return canvasToPngBytes(canvas);
}
