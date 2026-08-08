import Link from "next/link";
import { MarketingPage } from "@/components/MarketingPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Safety & quality",
  description: "How OorjaMan partners follow safety checklists and warranty-conscious cleaning methods.",
  path: "/safety",
});

export default function SafetyPage() {
  return (
    <MarketingPage
      title="Safety & quality"
      lead="Technicians complete safety acknowledgements, on-site checklists, and evidence capture before closing a visit."
    >
      <p>
        Rooftop solar work needs discipline: access, weather, water, and module care. OorjaMan builds those checks into
        the partner and technician apps so jobs do not start casually and do not close without proof.
      </p>
      <h2 className="om-h3">On every visit</h2>
      <ul>
        <li>Booking-code verification with the customer before work begins</li>
        <li>Mandatory safety checklist acknowledgement</li>
        <li>Job timer and status updates visible to the customer</li>
        <li>Before and after photo evidence uploaded to secure storage</li>
        <li>Live location sharing during active visits for customer visibility</li>
      </ul>
      <h2 className="om-h3">Site readiness</h2>
      <p>
        Rooftop access and water availability are captured when you register a site so technicians arrive prepared.
        Methods aim to protect manufacturer warranties — follow OEM guidance for your modules and mounting.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/how-it-works">How it works</Link> · <Link href="/partners">Partner standards</Link> ·{" "}
        <Link href="/legal/terms-of-service">Terms of service</Link>
      </p>
    </MarketingPage>
  );
}
