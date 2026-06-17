import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BrandPrintContact } from "@oorjaman/utils";
// @ts-expect-error — shared draw module (no .d.ts)
import { drawLetterheadHeader, drawLetterheadWatermark } from "../../../../../packages/utils/src/brand-print/letterhead-header.mjs";
// @ts-expect-error — shared draw module (no .d.ts)
import { drawLetterheadFooter, LETTERHEAD_FOOTER } from "../../../../../packages/utils/src/brand-print/letterhead-footer.mjs";
import { rasterizeLetterheadIcons } from "./letterhead-icon-raster";
import { rasterizeLetterheadFooterBackground } from "./letterhead-footer-bg-raster";

const A4_MM = { w: 210, h: 297 };
const mm = (n: number) => (n / 25.4) * 72;

const C = {
  man: hex("#1C4276"),
  oorja: hex("#549048"),
};

function hex(h: string) {
  const x = h.replace("#", "");
  return rgb(parseInt(x.slice(0, 2), 16) / 255, parseInt(x.slice(2, 4), 16) / 255, parseInt(x.slice(4, 6), 16) / 255);
}

export async function buildLetterheadPdf(
  contact: BrandPrintContact,
  lockupPng: Uint8Array,
  watermarkPng: Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pageW = mm(A4_MM.w);
  const pageH = mm(A4_MM.h);
  const page = pdf.addPage([pageW, pageH]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const lockupImg = await pdf.embedPng(lockupPng);
  const iconPngs = await rasterizeLetterheadIcons();
  const icons = {
    phone: await pdf.embedPng(iconPngs.phone),
    email: await pdf.embedPng(iconPngs.email),
    globe: await pdf.embedPng(iconPngs.globe),
  };

  drawLetterheadHeader(page, {
    pageW,
    pageH,
    contact,
    lockupImg,
    icons,
    font,
    mm,
    colors: { man: C.man, oorja: C.oorja },
  });

  const footerH = mm(LETTERHEAD_FOOTER.heightMm);
  const footerBgPng = await rasterizeLetterheadFooterBackground(pageW, footerH);
  const footerBgImg = await pdf.embedPng(footerBgPng);

  const wmImg = await pdf.embedPng(watermarkPng);

  drawLetterheadFooter(page, { pageW, footerH, backgroundImg: footerBgImg });
  drawLetterheadWatermark(page, { pageW, wmImg, footerH, mm });

  return pdf.save();
}
