import type { BrandPrintContact } from "./types";

export type EmailSignatureRenderOptions = {
  logoSrc?: string;
  includeDocumentWrapper?: boolean;
  previewPadding?: boolean;
};

export const EMAIL_SIGNATURE_LOCKUP_FILENAME: string;

export function escapeHtml(value: string): string;

export function buildEmailSignaturePlainText(contact: BrandPrintContact): string;

export function buildEmailSignatureBlock(
  contact: BrandPrintContact,
  options?: { logoSrc?: string },
): string;

export function buildEmailSignatureClipboardHtml(contact: BrandPrintContact, logoSrc: string): string;

export function buildEmailSignatureSetupGuideHtml(): string;

export function buildEmailSignatureHtml(
  contact: BrandPrintContact,
  options?: EmailSignatureRenderOptions,
): string;
