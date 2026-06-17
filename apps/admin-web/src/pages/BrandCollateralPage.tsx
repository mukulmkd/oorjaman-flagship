import { useEffect, useMemo, useState } from "react";
import { DEFAULT_BRAND_PRINT_CONTACT, normalizeBrandEmail, suggestBrandEmailFromName, slugifyBrandFileName, type BrandPrintContact } from "@oorjaman/utils";
import { Button, Card, Input, PageHeader, Tabs } from "@oorjaman/web-ui";
import {
  downloadBytes,
  downloadText,
  generateBusinessCards,
  generateEmailSignature,
  generateInvoice,
  generateLetterhead,
  type BusinessCardsResult,
  type EmailSignatureResult,
} from "../lib/brand-print/browser-generate";
import "./brand-collateral-page.css";

const BRAND_ICON_URL = `${import.meta.env.BASE_URL}logo-icon.png`;
const BRAND_LOCKUP_PRINT_URL = `${import.meta.env.BASE_URL}logo-lockup-tagline-print.png`;

type BrandPrintTab = "business-cards" | "email-signatures" | "letterheads" | "invoice";

const TABS: { id: BrandPrintTab; label: string }[] = [
  { id: "business-cards", label: "Business cards" },
  { id: "email-signatures", label: "Email signatures" },
  { id: "letterheads", label: "Letterheads" },
  { id: "invoice", label: "Invoice templates" },
];

type TabResults = {
  "business-cards": BusinessCardsResult | null;
  "email-signatures": EmailSignatureResult | null;
  invoice: Uint8Array | null;
};

const EMPTY_TAB_RESULTS: TabResults = {
  "business-cards": null,
  "email-signatures": null,
  invoice: null,
};

function defaultLetterheadContact(): BrandPrintContact {
  const c = DEFAULT_BRAND_PRINT_CONTACT;
  return {
    ...c,
    email: normalizeBrandEmail(c.email),
    url: c.web.startsWith("http") ? c.web : `https://${c.web.replace(/^\/\//, "")}`,
  };
}

type FieldKey = keyof Pick<
  BrandPrintContact,
  "cardName" | "cardTitle" | "phone" | "email" | "web" | "address"
>;

const FIELDS: { key: FieldKey; label: string; placeholder: string }[] = [
  { key: "cardName", label: "Full name", placeholder: "Priya Sharma" },
  { key: "cardTitle", label: "Title", placeholder: "Director" },
  { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { key: "email", label: "Email", placeholder: "priya.sharma@oorjaman.com" },
  { key: "web", label: "Website", placeholder: "www.oorjaman.com" },
  { key: "address", label: "Address", placeholder: "Bengaluru, Karnataka, India" },
];

function useObjectUrl(bytes: Uint8Array | null | undefined, mime: string): string | null {
  return useMemo(() => (bytes ? URL.createObjectURL(new Blob([bytes.slice()], { type: mime })) : null), [bytes, mime]);
}

function useHtmlObjectUrl(html: string | null | undefined): string | null {
  return useMemo(
    () => (html ? URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })) : null),
    [html],
  );
}

export function BrandCollateralPage() {
  const [activeTab, setActiveTab] = useState<BrandPrintTab>("business-cards");
  const [contact, setContact] = useState<BrandPrintContact>({ ...DEFAULT_BRAND_PRINT_CONTACT });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabResults, setTabResults] = useState<TabResults>(EMPTY_TAB_RESULTS);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [letterheadPdf, setLetterheadPdf] = useState<Uint8Array | null>(null);
  const [letterheadLoading, setLetterheadLoading] = useState(true);
  const [letterheadError, setLetterheadError] = useState<string | null>(null);

  const fileSlug = useMemo(() => slugifyBrandFileName(contact.cardName), [contact.cardName]);
  const activeResult = activeTab === "letterheads" ? letterheadPdf : tabResults[activeTab];

  const cards = tabResults["business-cards"];
  const email = tabResults["email-signatures"];
  const invoicePdf = tabResults.invoice;

  const previewFront = useObjectUrl(cards?.cardFront.previewPngBytes, "image/png");
  const previewBack = useObjectUrl(cards?.cardBack.previewPngBytes, "image/png");
  const letterheadPreview = useObjectUrl(letterheadPdf, "application/pdf");
  const invoicePreview = useObjectUrl(invoicePdf, "application/pdf");
  const emailPreview = useHtmlObjectUrl(email?.emailPreviewHtml);

  const brandAssets = useMemo(
    () => ({ iconUrl: BRAND_ICON_URL, lockupUrl: BRAND_LOCKUP_PRINT_URL, lockupPrintUrl: BRAND_LOCKUP_PRINT_URL }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLetterheadLoading(true);
      setLetterheadError(null);
      try {
        const pdf = await generateLetterhead(defaultLetterheadContact(), brandAssets);
        if (!cancelled) setLetterheadPdf(pdf);
      } catch (e) {
        if (!cancelled) {
          setLetterheadError(e instanceof Error ? e.message : "Could not load letterhead");
        }
      } finally {
        if (!cancelled) setLetterheadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandAssets]);

  useEffect(() => {
    return () => {
      if (previewFront) URL.revokeObjectURL(previewFront);
      if (previewBack) URL.revokeObjectURL(previewBack);
      if (letterheadPreview) URL.revokeObjectURL(letterheadPreview);
      if (invoicePreview) URL.revokeObjectURL(invoicePreview);
      if (emailPreview) URL.revokeObjectURL(emailPreview);
    };
  }, [previewFront, previewBack, letterheadPreview, invoicePreview, emailPreview]);

  const normalizedContact = useMemo(
    () => ({
      ...contact,
      email: normalizeBrandEmail(contact.email),
      url: contact.web.startsWith("http") ? contact.web : `https://${contact.web.replace(/^\/\//, "")}`,
    }),
    [contact],
  );

  const onCopyEmailSignature = async () => {
    if (!email) return;
    setCopyStatus("idle");
    const html = `<!DOCTYPE html><html><body>${email.emailClipboardHtml}</body></html>`;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([email.emailClipboardPlain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(email.emailClipboardPlain);
      }
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const onGenerate = async () => {
    setError(null);
    setBusy(true);
    try {
      switch (activeTab) {
        case "business-cards": {
          const next = await generateBusinessCards(normalizedContact, brandAssets);
          setTabResults((r) => ({ ...r, "business-cards": next }));
          break;
        }
        case "email-signatures": {
          const next = await generateEmailSignature(normalizedContact, brandAssets);
          setTabResults((r) => ({ ...r, "email-signatures": next }));
          setCopyStatus("idle");
          break;
        }
        case "invoice": {
          const next = await generateInvoice(normalizedContact, brandAssets);
          setTabResults((r) => ({ ...r, invoice: next }));
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const tabHint = (() => {
    switch (activeTab) {
      case "business-cards":
        return "90×54 mm card — branded front with lockup and wave; back with name, title, and contact details.";
      case "email-signatures":
        return "Lockup image and contact block — copy into Gmail, Outlook, or Apple Mail.";
      case "letterheads":
        return "Standard A4 company letterhead — ready to preview and download.";
      case "invoice":
        return "A4 tax invoice template with bill-to block, line items, and branded footer.";
      default:
        return "";
    }
  })();

  return (
    <>
      <PageHeader
        title="Brand print collateral"
        subtitle="Generate business cards, letterheads, email signatures, and invoice templates for any team member. Files are built in your browser — nothing is uploaded."
      />

      <Tabs
        items={TABS}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as BrandPrintTab)}
        aria-label="Brand print categories"
      />

      <div className={`bc-grid${activeTab === "letterheads" ? " bc-grid--letterhead" : ""}`}>
        {activeTab !== "letterheads" ? (
          <Card padded className="bc-form-card">
            <h2 className="bc-section-title">Person details</h2>
            <p className="bc-section-hint">
              Company defaults (OorjaMan tagline, colours, logo) are fixed. Edit the fields below for each recipient.
            </p>
            <div className="bc-fields">
              {FIELDS.map(({ key, label, placeholder }) => (
                <Input
                  key={key}
                  label={label}
                  value={contact[key]}
                  onChange={(e) => {
                    const value = e.target.value;
                    setContact((c) => {
                      if (key !== "cardName") {
                        return { ...c, [key]: value };
                      }
                      const next = { ...c, cardName: value };
                      const shouldSuggestEmail =
                        !c.email.trim() ||
                        /@oorjaman\.in$/i.test(c.email) ||
                        c.email === DEFAULT_BRAND_PRINT_CONTACT.email ||
                        c.email === suggestBrandEmailFromName(c.cardName);
                      if (shouldSuggestEmail) {
                        next.email = suggestBrandEmailFromName(value);
                      }
                      return next;
                    });
                  }}
                  placeholder={placeholder}
                />
              ))}
            </div>
            <div className="bc-actions">
              <Button type="button" onClick={() => void onGenerate()} disabled={busy}>
                {busy ? "Generating…" : "Generate preview"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setContact({ ...DEFAULT_BRAND_PRINT_CONTACT });
                  setTabResults(EMPTY_TAB_RESULTS);
                  setCopyStatus("idle");
                  setError(null);
                }}
              >
                Reset defaults
              </Button>
            </div>
            {error ? <p className="bc-error">{error}</p> : null}
          </Card>
        ) : null}

        <Card padded className="bc-preview-card">
          <h2 className="bc-section-title">{TABS.find((t) => t.id === activeTab)?.label}</h2>
          <p className="bc-section-hint">{tabHint}</p>

          {activeTab === "letterheads" ? (
            <>
              {letterheadLoading ? <p className="bc-muted">Loading letterhead…</p> : null}
              {letterheadError ? <p className="bc-error">{letterheadError}</p> : null}
              {!letterheadLoading && letterheadPdf ? (
                <>
                  {letterheadPreview ? (
                    <iframe title="Letterhead preview" src={letterheadPreview} className="bc-doc-preview" />
                  ) : null}
                  <div className="bc-downloads">
                    <Button
                      type="button"
                      onClick={() => downloadBytes(letterheadPdf, "oorjaman-letterhead-a4.pdf", "application/pdf")}
                    >
                      Download letterhead PDF
                    </Button>
                  </div>
                  <p className="bc-muted bc-footnote">
                    Standard A4 company letterhead with lockup, contact details, watermark, and wave footer. Ready to
                    print or type over in Word / Google Docs.
                  </p>
                </>
              ) : null}
            </>
          ) : !activeResult ? (
            <p className="bc-muted">Generate to preview and download files for this category.</p>
          ) : (
            <>
              {activeTab === "business-cards" && cards ? (
                <>
                  <div className="bc-preview-row">
                    {previewFront ? (
                      <figure className="bc-preview-figure">
                        <img src={previewFront} alt="Business card front preview" className="bc-card-preview" />
                        <figcaption>Front — lockup &amp; wave</figcaption>
                      </figure>
                    ) : null}
                    {previewBack ? (
                      <figure className="bc-preview-figure">
                        <img src={previewBack} alt="Business card back preview" className="bc-card-preview" />
                        <figcaption>Back — contact details</figcaption>
                      </figure>
                    ) : null}
                  </div>
                  <div className="bc-downloads">
                    <Button
                      type="button"
                      onClick={() =>
                        downloadBytes(cards.cardFront.pdfBytes, `oorjaman-card-front-${fileSlug}.pdf`, "application/pdf")
                      }
                    >
                      Download front PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadBytes(cards.cardBack.pdfBytes, `oorjaman-card-back-${fileSlug}.pdf`, "application/pdf")
                      }
                    >
                      Download back PDF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadBytes(cards.cardFront.pngBytes, `oorjaman-card-front-${fileSlug}.png`, "image/png")
                      }
                    >
                      Front PNG
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadBytes(cards.cardBack.pngBytes, `oorjaman-card-back-${fileSlug}.png`, "image/png")
                      }
                    >
                      Back PNG
                    </Button>
                  </div>
                  <p className="bc-muted bc-footnote">
                    On-screen preview is scaled for clarity. Downloaded PDF/PNG are full 300&nbsp;DPI print files (
                    {1063}×{638}&nbsp;px, 90×54&nbsp;mm).
                  </p>
                </>
              ) : null}

              {activeTab === "email-signatures" && email ? (
                <>
                  <ol className="bc-setup-steps">
                    <li>
                      <strong>Gmail:</strong> Settings → See all settings → General → Signature → Create new → paste (use Chrome).
                    </li>
                    <li>
                      Click <strong>Copy signature</strong> below — layout is Gmail-safe (no emoji icons, table-based columns).
                    </li>
                    <li>
                      Logo uses the admin portal URL when copied over HTTPS so it still shows when you send mail.
                    </li>
                    <li>
                      <strong>Outlook:</strong> File → Options → Mail → Signatures (Windows) · Settings → Signatures (Mac/web).
                    </li>
                  </ol>
                  {emailPreview ? (
                    <iframe title="Email signature preview" src={emailPreview} className="bc-email-preview" />
                  ) : null}
                  <div className="bc-downloads">
                    <Button type="button" onClick={() => void onCopyEmailSignature()} disabled={!email}>
                      {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy failed — use download" : "Copy signature"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadText(email.emailHtml, `oorjaman-email-signature-${fileSlug}.html`, "text/html;charset=utf-8")
                      }
                    >
                      Download HTML
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadBytes(email.emailLockupPng, "oorjaman-email-signature-lockup.png", "image/png")
                      }
                    >
                      Download lockup PNG (for hosting)
                    </Button>
                  </div>
                  <p className="bc-footnote" style={{ color: "var(--wb-fg, #0f2938)", fontSize: "0.9375rem", lineHeight: 1.65 }}>
                    {email.emailHostedLogoUrl
                      ? `Copy uses logo URL: ${email.emailHostedLogoUrl}`
                      : "Copy uses an embedded logo (local dev). On production admin HTTPS, copy uses a hosted logo URL for Gmail."}
                    {copyStatus === "failed" ? " Rich copy was blocked — open the downloaded HTML in Chrome, select the signature, and copy." : null}
                  </p>
                </>
              ) : null}

              {activeTab === "invoice" && invoicePdf ? (
                <>
                  {invoicePreview ? (
                    <iframe title="Invoice template preview" src={invoicePreview} className="bc-doc-preview" />
                  ) : null}
                  <div className="bc-downloads">
                    <Button
                      type="button"
                      onClick={() => downloadBytes(invoicePdf, `oorjaman-invoice-${fileSlug}.pdf`, "application/pdf")}
                    >
                      Download invoice PDF
                    </Button>
                  </div>
                  <p className="bc-muted bc-footnote">
                    Blank tax invoice template with placeholders for invoice number, dates, line items, and GST. Fill in
                    before sending to customers.
                  </p>
                </>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
