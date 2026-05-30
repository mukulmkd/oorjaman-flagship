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
      <ul>
        <li>Job start verification and happy-code completion</li>
        <li>Rooftop access and water availability captured at registration</li>
        <li>Photo evidence for cleaning and inspection steps</li>
        <li>Live location sharing during active visits for customer visibility</li>
      </ul>
      <p>Methods aim to protect manufacturer warranties - follow OEM guidance for your modules and mounting.</p>
    </MarketingPage>
  );
}
