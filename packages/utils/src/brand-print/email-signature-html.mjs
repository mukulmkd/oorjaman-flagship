/** @typedef {{ cardName: string; cardTitle: string; phone: string; email: string; web: string; url: string; tagline: string }} BrandPrintContact */

/** @typedef {{ logoSrc?: string; includeDocumentWrapper?: boolean; previewPadding?: boolean }} EmailSignatureRenderOptions */

export const EMAIL_SIGNATURE_LOCKUP_FILENAME = "oorjaman-email-signature-lockup.png";

const C = {
  navy: "#1C4276",
  titleGrey: "#666666",
  body: "#333333",
  divider: "#999999",
};

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imgSrcAttr(src) {
  if (src.startsWith("data:")) return src;
  return escapeHtml(src);
}

/** @param {BrandPrintContact} contact */
export function buildEmailSignaturePlainText(contact) {
  return [contact.cardName, contact.cardTitle, `${contact.phone} | ${contact.email}`, contact.web].join("\n");
}

/**
 * Gmail / Outlook-safe signature — tables only, no divs, no emoji icons.
 * @param {BrandPrintContact} contact
 * @param {{ logoSrc?: string }} [options]
 */
export function buildEmailSignatureBlock(contact, options = {}) {
  const logoSrc = options.logoSrc ?? EMAIL_SIGNATURE_LOCKUP_FILENAME;
  const name = escapeHtml(contact.cardName);
  const title = escapeHtml(contact.cardTitle);
  const phone = escapeHtml(contact.phone);
  const email = escapeHtml(contact.email);
  const web = escapeHtml(contact.web);
  const url = escapeHtml(contact.url);
  const tel = escapeHtml(contact.phone.replace(/\s/g, ""));

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;font-family:Arial,Helvetica,sans-serif;color:${C.body};">
  <tr>
    <td width="196" valign="top" style="width:196px;padding:0 18px 0 0;vertical-align:top;">
      <img src="${imgSrcAttr(logoSrc)}" alt="OorjaMan" width="196" border="0" style="display:block;border:0;outline:none;text-decoration:none;width:196px;height:auto;" />
    </td>
    <td valign="top" style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:${C.body};">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td style="font-size:17px;font-weight:bold;color:${C.navy};line-height:1.25;padding:0 0 3px 0;font-family:Arial,Helvetica,sans-serif;">${name}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:${C.titleGrey};line-height:1.3;padding:0 0 11px 0;font-family:Arial,Helvetica,sans-serif;">${title}</td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:1.5;padding:0 0 5px 0;font-family:Arial,Helvetica,sans-serif;">
            <a href="tel:${tel}" style="color:${C.body};text-decoration:none;">${phone}</a><span style="color:${C.divider};">&nbsp;|&nbsp;</span><a href="mailto:${email}" style="color:${C.body};text-decoration:none;">${email}</a>
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;line-height:1.5;padding:0;font-family:Arial,Helvetica,sans-serif;">
            <a href="${url}" style="color:${C.body};text-decoration:none;">${web}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Fragment optimised for rich clipboard paste. */
export function buildEmailSignatureClipboardHtml(contact, logoSrc) {
  const block = buildEmailSignatureBlock(contact, { logoSrc });
  return `<div dir="ltr">${block}</div>`;
}

export function buildEmailSignatureSetupGuideHtml() {
  return `<div style="max-width:640px;margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#0f2938;">
  <p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1C4276;">How to add this signature to your email</p>
  <ol style="margin:0;padding-left:22px;color:#0f2938;">
    <li style="margin-bottom:10px;"><strong>Gmail:</strong> Settings (gear) → See all settings → General → Signature → Create new → paste below the line (use Chrome).</li>
    <li style="margin-bottom:10px;">Open the downloaded HTML in Chrome, select only the signature (logo + details), then copy.</li>
    <li style="margin-bottom:10px;"><strong>Outlook:</strong> File → Options → Mail → Signatures (Windows), or Outlook → Settings → Signatures (Mac/web).</li>
    <li style="margin-bottom:0;">The logo uses a hosted URL when you copy from the admin portal over HTTPS, so it stays visible when you send mail. The downloaded HTML embeds the logo for offline preview.</li>
  </ol>
</div>`;
}

/** @param {BrandPrintContact} contact @param {EmailSignatureRenderOptions} [options] */
export function buildEmailSignatureHtml(contact, options = {}) {
  const block = buildEmailSignatureBlock(contact, options);
  const bodyPad = options.previewPadding ? "padding:20px 16px 16px;" : "margin:0;padding:0;";

  if (options.includeDocumentWrapper) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>OorjaMan email signature</title></head>
<body style="margin:24px;font-family:Arial,Helvetica,sans-serif;">
  ${buildEmailSignatureSetupGuideHtml()}
  <p style="color:#0f2938;font-size:15px;margin:0 0 12px;font-weight:600;">Signature to copy (below):</p>
  <!-- SIGNATURE START -->
  <div dir="ltr">${block}</div>
  <!-- SIGNATURE END -->
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>OorjaMan email signature</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;${bodyPad}">
<div dir="ltr">${block}</div>
</body>
</html>`;
}
