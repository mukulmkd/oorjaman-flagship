import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import styles from "./marketing-page.module.css";

type Props = {
  title: string;
  lead: string;
  children: ReactNode;
  eyebrow?: string;
  /** Optional full-bleed header photo (public path) */
  mediaSrc?: string | null;
  mediaAlt?: string;
  /** CSS object-position for people-heavy photos (default keeps faces in frame) */
  mediaPosition?: string;
  /** Wider body (~72rem) for visual pages */
  wide?: boolean;
  /** Optional CTA row under the lead in the header */
  cta?: ReactNode;
};

export function MarketingPage({
  title,
  lead,
  children,
  eyebrow = "OorjaMan",
  mediaSrc = null,
  mediaAlt = "",
  mediaPosition,
  wide = false,
  cta,
}: Props) {
  const hasMedia = Boolean(mediaSrc);

  return (
    <div className={`${styles.page}${wide ? ` ${styles.wide}` : ""}`}>
      <header className={`${styles.header}${hasMedia ? ` ${styles.headerMedia}` : ""}`}>
        {hasMedia ? (
          <div
            className={styles.media}
            aria-hidden={!mediaAlt}
            style={mediaPosition ? ({ ["--om-media-pos"]: mediaPosition } as CSSProperties) : undefined}
          >
            <Image
              src={mediaSrc!}
              alt={mediaAlt}
              fill
              priority
              sizes="100vw"
              className={styles.mediaImg}
            />
            <div className={styles.mediaScrim} />
          </div>
        ) : null}
        <div className={`om-container ${styles.headerInner}`}>
          <p className={`om-eyebrow${hasMedia ? ` ${styles.eyebrowOnMedia}` : ""}`}>{eyebrow}</p>
          <h1 className={`om-h1${hasMedia ? ` ${styles.titleOnMedia}` : ""}`}>{title}</h1>
          <p className={`om-lead${hasMedia ? ` ${styles.leadOnMedia}` : ""}`}>{lead}</p>
          {cta ? <div className={styles.headerCta}>{cta}</div> : null}
        </div>
      </header>
      <div className={`om-section ${styles.body}`}>
        <div className={`om-container ${styles.bodyInner}`}>{children}</div>
      </div>
    </div>
  );
}
