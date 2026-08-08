import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "For homeowners",
  description: "Residential solar panel cleaning and AMC for Indian homeowners.",
  path: "/for-homeowners",
});

export default function ForHomeownersPage() {
  return (
    <MarketingPage
      title="For homeowners"
      lead="Protect your residential yield with professional cleaning and preventive care — without climbing the roof yourself."
    >
      <p>
        Register your home installation once: capacity, photos, access notes, and water availability. Then book a
        one-time clean or an AMC plan with prices shown before you pay.
      </p>
      <ul>
        <li>Verified partners and trained technicians</li>
        <li>Transparent kW-band pricing plus any city-tier add-ons</li>
        <li>Track the visit and review photo evidence in the app</li>
        <li>Support via in-app chat and support@oorjaman.com</li>
      </ul>
      <p style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
        <Link href="/download" className="om-btn om-btn--primary">
          Get the app
        </Link>
        <Link href="/pricing" className="om-btn om-btn--outline">
          See pricing
        </Link>
        <Link href="/how-it-works" className="om-btn om-btn--outline">
          How it works
        </Link>
      </p>
    </MarketingPage>
  );
}
