"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import { heroHeadline } from "@/lib/home-content";
import styles from "@/components/home.module.css";

type HomeHeroProps = {
  primaryCtaLabel: string;
  /** Optional rooftop photo from public/marketing */
  photoSrc?: string | null;
  /** Optional muted looping video (preferred when motion is allowed) */
  videoSrc?: string | null;
};

export function HomeHero({ primaryCtaLabel, photoSrc = null, videoSrc = null }: HomeHeroProps) {
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAllowMotion(!reduced);
  }, []);

  const useVideo = Boolean(videoSrc && allowMotion);
  const hasMedia = Boolean(photoSrc || useVideo);

  return (
    <section
      className={`${styles.hero}${hasMedia ? ` ${styles.heroWithPhoto}` : ""}`}
      aria-label="OorjaMan"
    >
      {useVideo ? (
        <div className={styles.heroPhoto} aria-hidden>
          <video
            className={styles.heroVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={photoSrc ?? undefined}
          >
            <source src={videoSrc!} type="video/mp4" />
          </video>
          <div className={styles.heroPhotoScrim} />
        </div>
      ) : photoSrc ? (
        <div className={styles.heroPhoto} aria-hidden>
          <Image
            src={photoSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroPhotoImg}
          />
          <div className={styles.heroPhotoScrim} />
        </div>
      ) : null}
      <div className={styles.heroGlow} aria-hidden />

      <div className={`om-container ${styles.heroInner}`}>
        <p className={`${styles.brandLine} om-rise`}>
          <BrandWordmark size="hero" tone="onDark" />
        </p>

        <div className={styles.heroCopy}>
          <p className={`${styles.heroEyebrow} om-rise om-rise-delay-1`}>{heroHeadline.eyebrow}</p>
          <h1 className={`${styles.headline} om-rise om-rise-delay-1`}>
            Maximize rooftop <span className={styles.headlineAccent}>performance</span>
          </h1>
          <p className={`${styles.support} om-rise om-rise-delay-2`}>{heroHeadline.support}</p>
        </div>

        <p className={`${styles.ctas} om-rise om-rise-delay-3`}>
          <Link href="/download" className="om-btn om-btn--primary">
            {primaryCtaLabel}
          </Link>
          <Link href="/services/amc-maintenance" className="om-btn om-btn--ghost-light">
            Explore AMC
          </Link>
        </p>
      </div>
    </section>
  );
}
