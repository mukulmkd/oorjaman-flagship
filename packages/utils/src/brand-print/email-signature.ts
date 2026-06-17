import type { BrandPrintContact } from "./types";
import {
  buildEmailSignatureBlock as buildBlock,
  buildEmailSignatureClipboardHtml as buildClipboard,
  buildEmailSignatureHtml as buildHtml,
  buildEmailSignaturePlainText as buildPlain,
  buildEmailSignatureSetupGuideHtml as buildSetupGuide,
  EMAIL_SIGNATURE_LOCKUP_FILENAME,
} from "./email-signature-html.mjs";

export { EMAIL_SIGNATURE_LOCKUP_FILENAME, buildSetupGuide as buildEmailSignatureSetupGuideHtml };

export type EmailSignatureRenderOptions = {
  logoSrc?: string;
  includeDocumentWrapper?: boolean;
  previewPadding?: boolean;
};

export function buildEmailSignatureBlock(
  contact: BrandPrintContact,
  options: EmailSignatureRenderOptions = {},
): string {
  return buildBlock(contact, options);
}

export function buildEmailSignatureHtml(contact: BrandPrintContact, options: EmailSignatureRenderOptions = {}): string {
  return buildHtml(contact, options);
}

export function buildEmailSignaturePlainText(contact: BrandPrintContact): string {
  return buildPlain(contact);
}

export function buildEmailSignatureClipboardHtml(contact: BrandPrintContact, logoSrc: string): string {
  return buildClipboard(contact, logoSrc);
}
