import Image from "next/image";
import { APP_LINKS } from "@/lib/site";
import styles from "./store-badges.module.css";

type StoreBadgesProps = {
  /** When true, stack vertically (narrow hero). Default: row. */
  stack?: boolean;
  className?: string;
};

/**
 * Official App Store + Google Play badges linking to live customer listings.
 * Artwork must stay unmodified (Apple / Google marketing guidelines).
 */
export function StoreBadges({ stack = false, className }: StoreBadgesProps) {
  const ios = APP_LINKS.customerIos;
  const android = APP_LINKS.customerAndroid;
  if (!ios && !android) return null;

  return (
    <div
      className={[styles.row, stack ? styles.stack : "", className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Download OorjaMan"
    >
      {ios ? (
        <a
          href={ios}
          className={styles.link}
          rel="noopener noreferrer"
          target="_blank"
          aria-label="Download on the App Store"
        >
          <Image
            src="/store-badges/app-store-badge.svg"
            alt="Download on the App Store"
            width={120}
            height={40}
            className={styles.appStore}
            unoptimized
            priority
          />
        </a>
      ) : null}
      {android ? (
        <a
          href={android}
          className={styles.link}
          rel="noopener noreferrer"
          target="_blank"
          aria-label="Get it on Google Play"
        >
          <Image
            src="/store-badges/google-play-badge.png"
            alt="Get it on Google Play"
            width={135}
            height={40}
            className={styles.googlePlay}
            unoptimized
            priority
          />
        </a>
      ) : null}
    </div>
  );
}
