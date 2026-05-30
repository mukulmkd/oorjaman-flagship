import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/LegalDocumentView";
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
    <div className="om-section">
      <div className="om-container">
        <LegalDocumentView doc={doc} />
      </div>
    </div>
  );
}
