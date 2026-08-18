import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/site";
import { InstagramIcon } from "./social-icons";
import styles from "./social-links.module.css";

type SocialLinksProps = {
  /** Visual tone for light pages vs dark footer */
  tone?: "onLight" | "onDark";
  /** Show handle text next to icons */
  showLabels?: boolean;
  className?: string;
};

/**
 * Public social profiles. Add new networks here when URLs are available in lib/site.
 */
export function SocialLinks({
  tone = "onLight",
  showLabels = true,
  className = "",
}: SocialLinksProps) {
  return (
    <ul className={`${styles.list} ${tone === "onDark" ? styles.onDark : styles.onLight} ${className}`.trim()}>
      <li>
        <a
          href={INSTAGRAM_URL}
          className={styles.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`OorjaMan on Instagram (${INSTAGRAM_HANDLE})`}
        >
          <span className={styles.iconWrap} aria-hidden>
            <InstagramIcon className={styles.icon} />
          </span>
          {showLabels ? <span className={styles.label}>{INSTAGRAM_HANDLE}</span> : null}
        </a>
      </li>
    </ul>
  );
}
