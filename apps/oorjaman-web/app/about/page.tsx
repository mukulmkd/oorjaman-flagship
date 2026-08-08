import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_LEGAL_NAME,
  INFO_EMAIL,
  SUPPORT_EMAIL,
} from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "About OorjaMan",
  description: "OorjaMan is India's solar rooftop care platform for cleaning, maintenance, and AMC.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <MarketingPage
      title="About OorjaMan"
      lead="We connect property owners with verified solar O&M partners — technology for scheduling, pricing, safety workflows, and settlements."
    >
      <p>
        OorjaMan is a premium clean-tech platform for solar panel cleaning and annual maintenance contracts (AMC).
        Homeowners and businesses book in the customer app; vetted partners accept jobs, assign technicians, and close
        visits with safety checks and photo evidence.
      </p>
      <p>
        Platform operators manage vendor approvals, pricing catalogues, and support from dedicated admin and support
        tools. Our tagline says it simply: we clean so you can keep generating.
      </p>

      <h2 className="om-h3">Company</h2>
      <p>
        <strong>{COMPANY_LEGAL_NAME}</strong>
        <br />
        {COMPANY_ADDRESS}
        {COMPANY_GSTIN ? (
          <>
            <br />
            GSTIN: {COMPANY_GSTIN}
          </>
        ) : null}
      </p>
      <p>
        General enquiries: <a href={`mailto:${INFO_EMAIL}`}>{INFO_EMAIL}</a>
        <br />
        Customer support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>

      <p>
        <Link href="/contact">Contact</Link> · <Link href="/partners">Partner programme</Link> ·{" "}
        <Link href="/safety">Safety &amp; quality</Link> · <Link href="/legal">Legal policies</Link>
      </p>
    </MarketingPage>
  );
}
