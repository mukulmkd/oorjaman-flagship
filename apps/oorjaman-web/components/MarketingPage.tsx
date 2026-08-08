import type { ReactNode } from "react";
import styles from "./marketing-page.module.css";

type Props = {
  title: string;
  lead: string;
  children: ReactNode;
  eyebrow?: string;
};

export function MarketingPage({ title, lead, children, eyebrow = "OorjaMan" }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`om-container ${styles.headerInner}`}>
          <p className="om-eyebrow">{eyebrow}</p>
          <h1 className="om-h1">{title}</h1>
          <p className="om-lead">{lead}</p>
        </div>
      </header>
      <div className={`om-section ${styles.body}`}>
        <div className={`om-container ${styles.bodyInner}`}>{children}</div>
      </div>
    </div>
  );
}
