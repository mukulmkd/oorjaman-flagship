import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { MarketingPage } from "@/components/MarketingPage";
import { getLegalDocument, legalDocuments } from "@/lib/legal-docs";
import { buildPageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return legalDocuments.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const doc = getLegalDocument(slug);
  if (!doc) return {};
  return buildPageMetadata({
    title: doc.title,
    description: doc.description,
    path: `/legal/${doc.slug}`,
  });
}

export default async function LegalSlugPage({ params }: Props) {
  const { slug } = await params;
  const doc = getLegalDocument(slug);
  if (!doc) notFound();

  return (
    <MarketingPage title={doc.title} lead={doc.description} eyebrow="Legal">
      <LegalDocumentView doc={doc} hideTitle />
    </MarketingPage>
  );
}
