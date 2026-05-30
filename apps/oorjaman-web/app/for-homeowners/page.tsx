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
      lead="Protect your residential yield with professional cleaning and preventive care - without climbing the roof yourself."
    >
      <p>Register your home installation, save site photos for technicians, and pick partners you trust.</p>
      <Link href="/download" className="om-btn om-btn--primary">
        Download for iOS &amp; Android
      </Link>
    </MarketingPage>
  );
}
