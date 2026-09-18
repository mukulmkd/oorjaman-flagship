#!/usr/bin/env node
/**
 * Airtel DLT — official "LETTER OF AUTHORITY" wording on OorjaMan letterhead.
 * Source template: Airtel AUTHORITY_LETTER.doc (filled with OORJA MAN LLP details).
 *
 * Usage: node scripts/generate-airtel-dlt-authorization-letter.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawLetterheadHeader,
  drawLetterheadWatermark,
} from "../packages/utils/src/brand-print/letterhead-header.mjs";
import {
  drawLetterheadFooter,
  LETTERHEAD_FOOTER,
} from "../packages/utils/src/brand-print/letterhead-footer.mjs";
import { rasterizeLetterheadIcons } from "./lib/letterhead-icon-raster.mjs";
import { rasterizeLetterheadFooterBackground } from "./lib/letterhead-footer-bg-raster.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(repoRoot, "brand", "source");
const outputDir = join(repoRoot, "brand", "print", "letterhead");
const outputPath = join(outputDir, "oorjaman-airtel-dlt-authority-letter-2026-09-11.pdf");

/** Filled from prior DLT / company details (Airtel AUTHORITY_LETTER blanks). */
const letter = {
  place: "Guwahati",
  day: "11",
  month: "September",
  year: "2026",
  issuerName: "Manas Jyoti Kashyap",
  issuerDesignation: "Partner",
  entityName: "OORJA MAN LLP",
  registeredOffice:
    "House No. 507, Panch Tirtahatti Path, Hengrabari, Guwahati, Kamrup Metropolitan, Assam 781036, India",
  attorneyName: "Amrit Nayan Baruah",
  attorneyDesignation: "Partner",
};

const mm = (value) => (value / 25.4) * 72;
const pageWidth = mm(210);
const pageHeight = mm(297);

const colors = {
  white: rgb(1, 1, 1),
  body: hex("#0f2938"),
  muted: hex("#516a7b"),
  oorja: hex("#549048"),
  man: hex("#1C4276"),
};

const contact = {
  phone: "+91 70022 09739",
  email: "partners@oorjaman.com",
  web: "www.oorjaman.com",
};

function hex(value) {
  const normalized = value.replace("#", "");
  return rgb(
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255,
  );
}

async function pngForPdf(inputPath, width) {
  return sharp(inputPath).resize({ width, withoutEnlargement: true }).png().toBuffer();
}

async function fadedIcon(inputPath, size, opacity) {
  const { data, info } = await sharp(inputPath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.round(data[index] * opacity);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawParagraph(page, text, options) {
  const {
    x,
    y,
    width,
    font,
    size = 9.5,
    lineHeight = 12.5,
    color = colors.body,
    indent = 0,
  } = options;
  const lines = wrapText(text, font, size, width - indent);

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: x + indent,
      y: y - index * lineHeight,
      size,
      font,
      color,
    });
  });

  return y - lines.length * lineHeight;
}

function drawBullet(page, text, options) {
  const { x, y, width, font, size = 9.5, lineHeight = 12.5 } = options;
  page.drawText("•", { x, y, size, font, color: colors.body });
  return drawParagraph(page, text, {
    x,
    y,
    width,
    font,
    size,
    lineHeight,
    indent: 11,
  });
}

function drawSigLine(page, x, y, widthMm = 70) {
  page.drawLine({
    start: { x, y },
    end: { x: x + mm(widthMm), y },
    thickness: 0.7,
    color: colors.muted,
  });
}

async function generate() {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const lockupBytes = await pngForPdf(join(sourceDir, "logo-lockup-tagline.png"), 1800);
  const watermarkBytes = await fadedIcon(join(sourceDir, "logo-icon.png"), 900, 0.08);
  const lockup = await pdf.embedPng(lockupBytes);
  const watermark = await pdf.embedPng(watermarkBytes);
  const iconBytes = await rasterizeLetterheadIcons();
  const icons = {
    phone: await pdf.embedPng(iconBytes.phone),
    email: await pdf.embedPng(iconBytes.email),
    globe: await pdf.embedPng(iconBytes.globe),
  };

  const footerHeight = mm(LETTERHEAD_FOOTER.heightMm);
  const footerBytes = await rasterizeLetterheadFooterBackground(pageWidth, footerHeight);
  const footer = await pdf.embedPng(footerBytes);

  const page = pdf.addPage([pageWidth, pageHeight]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: colors.white,
  });
  const { separatorY } = drawLetterheadHeader(page, {
    pageW: pageWidth,
    pageH: pageHeight,
    contact,
    lockupImg: lockup,
    icons,
    font: regular,
    mm,
    colors: { man: colors.man, oorja: colors.oorja },
  });
  drawLetterheadFooter(page, { pageW: pageWidth, footerH: footerHeight, backgroundImg: footer });
  drawLetterheadWatermark(page, { pageW: pageWidth, wmImg: watermark, footerH: footerHeight, mm });

  const left = mm(16);
  const contentWidth = pageWidth - mm(32);
  let y = separatorY - mm(6);

  page.drawText("LETTER OF AUTHORITY", {
    x: (pageWidth - bold.widthOfTextAtSize("LETTER OF AUTHORITY", 12.5)) / 2,
    y,
    size: 12.5,
    font: bold,
    color: colors.man,
  });
  y -= 18;

  y = drawParagraph(
    page,
    `This letter of Authority is being executed at ${letter.place} on this ${letter.day} Day of ${letter.month}, ${letter.year}.`,
    { x: left, y, width: contentWidth, font: regular },
  );
  y -= 7;

  y = drawParagraph(
    page,
    `This Authority is being issued by ${letter.issuerName}, ${letter.issuerDesignation} of ${letter.entityName} (“hereinafter referred to as a Company”), having its registered office at ${letter.registeredOffice}.`,
    { x: left, y, width: contentWidth, font: regular },
  );
  y -= 7;

  y = drawParagraph(
    page,
    `I further confirm that I am being duly empowered to delegate the powers hereinafter appearing and therefore in exercise of my lawful powers, I do hereby authorize Mr./Ms. ${letter.attorneyName}, ${letter.attorneyDesignation}, so long as he/she continues to be in the employment of the Company, to do the following acts, deeds or things, namely:`,
    { x: left, y, width: contentWidth, font: regular },
  );
  y -= 6;

  const powers = [
    "To apply for registration of our company, for seeking telecom resources and connectivity for sending commercial communication viz; service, transactional and/or promotional either for SMS or Voice or both.",
    "To apply and register for CLI’s/Headers, the message templates for different categories of commercial communication and/or to avail consent acquisition, consent validation, scrubbing, delivery functions as decided by the Company.",
    "To submit, execute and /or endorse all documents and papers required in connection with performing any or all of the above activities.",
    "To avail such services as may be required or incidental in connection with transmission of the commercial communication as per the process specified by Airtel from time to time.",
    "To do all such other acts, deeds and things as may be necessary for the above mentioned purpose(s).",
  ];

  for (const power of powers) {
    y = drawBullet(page, power, { x: left, y, width: contentWidth, font: regular });
    y -= 4.5;
  }

  y -= 2;
  y = drawParagraph(
    page,
    `And the Company hereby authorize that all acts, deeds and things lawfully done by its said attorney ${letter.attorneyName} shall be construed as acts, deeds and things done by them and the Company undertake to/ ratify and confirm all and whatsoever that its said Attorney/s shall lawfully do or comes to be done by them by virtue of this authority.`,
    { x: left, y, width: contentWidth, font: regular },
  );

  // --- Signature blocks (Airtel template layout, blanks filled) ---
  y -= 14;
  page.drawText(`For ${letter.entityName}`, {
    x: left,
    y,
    size: 10,
    font: bold,
    color: colors.body,
  });

  y -= 36;
  drawSigLine(page, left, y, 72);
  y -= 12;
  page.drawText(letter.issuerName, { x: left, y, size: 9.5, font: bold, color: colors.body });
  y -= 11;
  page.drawText(letter.issuerDesignation, {
    x: left,
    y,
    size: 9,
    font: regular,
    color: colors.body,
  });

  y -= 16;
  page.drawText("ACCEPTED", { x: left, y, size: 10.5, font: bold, color: colors.man });

  // Accepted (left) + Signatures Attested (right) — matches Airtel template screenshot
  const rightCol = left + mm(95);
  const acceptedSigY = y - 34;
  drawSigLine(page, left, acceptedSigY, 70);
  drawSigLine(page, rightCol, acceptedSigY, 70);

  page.drawText("Signatures Attested", {
    x: rightCol,
    y: y - 12,
    size: 10,
    font: bold,
    color: colors.man,
  });

  let ly = acceptedSigY - 12;
  let ry = acceptedSigY - 12;

  page.drawText(letter.attorneyName, { x: left, y: ly, size: 9.5, font: bold, color: colors.body });
  page.drawText(letter.issuerName, {
    x: rightCol,
    y: ry,
    size: 9.5,
    font: bold,
    color: colors.body,
  });
  ly -= 11;
  ry -= 11;
  page.drawText(letter.attorneyDesignation, {
    x: left,
    y: ly,
    size: 9,
    font: regular,
    color: colors.body,
  });
  page.drawText(letter.issuerDesignation, {
    x: rightCol,
    y: ry,
    size: 9,
    font: regular,
    color: colors.body,
  });

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, await pdf.save());
  console.log(`wrote ${outputPath}`);
}

await generate();
