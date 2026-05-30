import type { LegalDocument } from "@/lib/legal-docs";
import styles from "./legal-document.module.css";

export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className={styles.article}>
      <header className={styles.header}>
        <h1 className="om-h1">{doc.title}</h1>
        <p className={styles.meta}>Last updated: {doc.lastUpdated}</p>
        <p className="om-lead">{doc.description}</p>
      </header>
      <nav className={styles.toc} aria-label="On this page">
        <p className={styles.tocTitle}>Contents</p>
        <ol>
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className={styles.body}>
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className={styles.section}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {section.bullets?.length ? (
              <ul>
                {section.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <p className={styles.disclaimer}>
        This document is provided for transparency and app-store compliance. It does not constitute legal advice.
        For contractual questions contact legal@oorjaman.com.
      </p>
    </article>
  );
}
