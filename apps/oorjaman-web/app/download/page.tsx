import Image from "next/image";
import Link from "next/link";
import { BRAND_TAGLINE } from "@oorjaman/config";
import { BrandWordmark } from "@/components/BrandWordmark";
import { buildPageMetadata } from "@/lib/seo";
import {
  APP_LINKS,
  SUPPORT_EMAIL,
  customerStoreListingsLive,
} from "@/lib/site";
import styles from "./download.module.css";

export const metadata = buildPageMetadata({
  title: "Download the OorjaMan app",
  description: "Get the OorjaMan customer app on iOS and Android to book solar panel cleaning and AMC.",
  path: "/download",
});

export default function DownloadPage() {
  const storesLive = customerStoreListingsLive();

  return (
    <div className={styles.page}>
      <div className={`om-container ${styles.inner}`}>
        {/* Transparent icon + CSS wordmark — lockup PNG has an opaque white plate */}
        <div className={styles.brand}>
          <Image
            src="/logo-icon.png"
            alt=""
            width={96}
            height={96}
            className={styles.icon}
            priority
          />
          <BrandWordmark size="splash" />
          <p className={styles.tagline}>{BRAND_TAGLINE}</p>
        </div>
        <h1 className="om-h1">{storesLive ? "Download OorjaMan" : "Get OorjaMan"}</h1>
        <p className="om-lead">
          Book cleaning visits, manage AMC plans, track technicians, and chat with support — all from the customer
          app.
        </p>

        {storesLive ? (
          <>
            <div className={styles.actions}>
              <a href={APP_LINKS.customerIos} className="om-btn om-btn--primary" rel="noopener noreferrer">
                App Store (iOS)
              </a>
              <a href={APP_LINKS.customerAndroid} className="om-btn om-btn--outline" rel="noopener noreferrer">
                Google Play (Android)
              </a>
            </div>
            <p className={styles.note}>
              Already installed? Open <code>{APP_LINKS.customerScheme}</code>
            </p>
          </>
        ) : (
          <>
            <div className={styles.waitlist}>
              <p className={styles.waitlistLead}>
                The customer app is preparing for App Store and Google Play. Leave your details with support and we
                will notify you when downloads are available.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Notify me when the OorjaMan app launches")}`}
                className="om-btn om-btn--primary"
              >
                Notify me at {SUPPORT_EMAIL}
              </a>
            </div>
            <p className={styles.note}>
              Prefer email? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your city and whether
              you need home or business care.
            </p>
          </>
        )}

        <p className={styles.legal}>
          <Link href="/how-it-works">How it works</Link> · <Link href="/pricing">Pricing</Link> ·{" "}
          <Link href="/legal/privacy-policy">Privacy</Link> · <Link href="/legal/terms-of-service">Terms</Link>
        </p>
      </div>
    </div>
  );
}
