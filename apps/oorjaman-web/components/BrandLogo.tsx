import Image from "next/image";
import Link from "next/link";
import { BrandWordmark } from "./BrandWordmark";
import styles from "./brand-logo.module.css";

type Props = {
  href?: string;
  /** @deprecated Lockup PNG is opaque; always renders transparent icon + wordmark. */
  variant?: "mark" | "lockup";
  showWordmark?: boolean;
  className?: string;
  priority?: boolean;
};

/** Nav/footer brand: transparent `logo-icon.png` + CSS split wordmark. */
export function BrandLogo({
  href = "/",
  showWordmark = true,
  className,
  priority = false,
}: Props) {
  const inner = (
    <span className={styles.markRow}>
      <Image
        src="/logo-icon.png"
        alt=""
        width={40}
        height={40}
        className={styles.icon}
        priority={priority}
      />
      {showWordmark ? <BrandWordmark size="compact" /> : null}
    </span>
  );

  if (!href) {
    return <span className={className}>{inner}</span>;
  }

  return (
    <Link href={href} className={[styles.link, className].filter(Boolean).join(" ")} aria-label="OorjaMan home">
      {inner}
    </Link>
  );
}
